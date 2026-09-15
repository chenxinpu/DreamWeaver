package dreamweaver.parser;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * DXF R12 子集解析器（纯 Java 标准库），逐行对应原 TS `apps/server/src/parsers/dxf.ts`：
 * 支持 HEADER(跳过)、TABLES/Layer(名字+颜色号)、ENTITIES 中
 * LINE / LWPOLYLINE(含 bulge→圆弧样条化) / CIRCLE / ARC / POINT / TEXT / INSERT(跳过)。
 *
 * <p>输出 layerNames、entityCount、patternSvg（各实体按图层上色、自动包围盒/视图变换、
 * 内联 SVG，含比例说明与标注线）。解析失败或残缺返回 parseWarn（部分仍可渲染）。
 */
public final class DxfParser {

    private DxfParser() {
    }

    /* ------------------------------------------------------------------ */
    /* 内部数据结构                                                         */
    /* ------------------------------------------------------------------ */

    /** DXF 组码对。 */
    static final class Pair {
        final String code;
        final String val;

        Pair(String code, String val) {
            this.code = code;
            this.val = val;
        }
    }

    /** 二维点。 */
    static final class Vec {
        final double x;
        final double y;

        Vec(double x, double y) {
            this.x = x;
            this.y = y;
        }
    }

    /** LWPOLYLINE 顶点（含 bulge）。 */
    static final class LwPoint {
        double x;
        double y;
        double bulge;
    }

    /** 原始实体（等价 TS RawEnt 联合类型，字段按 type 取用）。 */
    static final class RawEnt {
        String type;
        String layer;
        Vec a;
        Vec b;
        Vec c;
        Vec p;
        double r;
        double a0;
        double a1;
        double height;
        String text;
        boolean closed;
        List<LwPoint> pts;
    }

    /** 图层定义。 */
    static final class LayerDef {
        final String name;
        final int color;

        LayerDef(String name, int color) {
            this.name = name;
            this.color = color;
        }
    }

    /** 几何图元（采样点路径）。 */
    static final class PathShape {
        String layer;
        List<Vec> pts;
        boolean closed;
        boolean fill;
        String kind;    // 'curve' | 'line'
    }

    /** 文字实体。 */
    static final class TextItem {
        double x;
        double y;
        String text;
        double height;
        String layer;
    }

    /** entityToShapes 的返回值。 */
    static final class Shapes {
        final List<PathShape> shapes = new ArrayList<>();
        final List<TextItem> texts = new ArrayList<>();
        final List<Vec> notes = new ArrayList<>();
    }

    /** bulge 圆弧参数。 */
    static final class BulgeArc {
        Vec center;
        double r;
        double a0;
        double theta;
    }

    /** 视口变换（DXF Y 向上 → SVG Y 向下）。 */
    private static final class View {
        final double marginL;
        final double marginT;
        final double minX;
        final double maxY;
        final double s;

        View(double marginL, double marginT, double minX, double maxY, double s) {
            this.marginL = marginL;
            this.marginT = marginT;
            this.minX = minX;
            this.maxY = maxY;
            this.s = s;
        }

        double sx(double x) {
            return marginL + (x - minX) * s;
        }

        double sy(double y) {
            return marginT + (maxY - y) * s;
        }
    }

    /* ------------------------------------------------------------------ */
    /* 基础读取                                                             */
    /* ------------------------------------------------------------------ */

    private static List<Pair> readPairs(String text) {
        String[] lines = text.split("\\r?\\n", -1);
        List<Pair> out = new ArrayList<>();
        for (int i = 0; i + 1 < lines.length; i += 2) {
            String code = lines[i].trim();
            if (code.isEmpty()) {
                i -= 1;      // 容忍空行
                continue;
            }
            out.add(new Pair(code, lines[i + 1].trim()));
        }
        return out;
    }

    private static List<Pair> sectionContent(List<Pair> pairs, String name) {
        for (int i = 0; i + 1 < pairs.size(); i++) {
            if ("0".equals(pairs.get(i).code) && "SECTION".equals(pairs.get(i).val)
                    && "2".equals(pairs.get(i + 1).code) && name.equals(pairs.get(i + 1).val)) {
                List<Pair> c = new ArrayList<>();
                int j = i + 2;
                while (j < pairs.size() && !("0".equals(pairs.get(j).code) && "ENDSEC".equals(pairs.get(j).val))) {
                    c.add(pairs.get(j));
                    j++;
                }
                return c;
            }
        }
        return new ArrayList<>();
    }

    private static String get(List<Pair> pairs, int start, String code) {
        for (int i = start; i < pairs.size(); i++) {
            if ("0".equals(pairs.get(i).code)) break;
            if (code.equals(pairs.get(i).code)) return pairs.get(i).val;
        }
        return "";
    }

    /** 等价 TS 的 num()：parseFloat 失败按 0 处理。 */
    private static double num(String s) {
        double v = Parsers.jsParseFloat(s);
        return Double.isFinite(v) ? v : 0;
    }

    /** 解析 LAYER 表。 */
    private static List<LayerDef> parseLayers(List<Pair> content) {
        List<LayerDef> layers = new ArrayList<>();
        int i = 0;
        while (i < content.size()) {
            if ("0".equals(content.get(i).code) && "LAYER".equals(content.get(i).val)) {
                String name = "0";
                int color = 7;
                int j = i + 1;
                while (j < content.size() && !"0".equals(content.get(j).code)) {
                    if ("2".equals(content.get(j).code)) name = content.get(j).val;
                    if ("62".equals(content.get(j).code)) color = (int) num(content.get(j).val);
                    j++;
                }
                layers.add(new LayerDef(name, color));
                i = j;
            } else {
                i++;
            }
        }
        return layers;
    }

    /** 解析 ENTITIES。 */
    private static List<RawEnt> parseEntities(List<Pair> content) {
        List<RawEnt> ents = new ArrayList<>();
        int i = 0;
        while (i < content.size()) {
            if ("0".equals(content.get(i).code)) {
                String t = content.get(i).val;
                int j = i + 1;
                String layer = get(content, j, "8");
                if (layer.isEmpty()) layer = "0";
                if ("LINE".equals(t)) {
                    RawEnt e = ent("LINE", layer);
                    e.a = new Vec(num(get(content, j, "10")), num(get(content, j, "20")));
                    e.b = new Vec(num(get(content, j, "11")), num(get(content, j, "21")));
                    ents.add(e);
                } else if ("LWPOLYLINE".equals(t)) {
                    List<LwPoint> pts = new ArrayList<>();
                    boolean closed = false;
                    int k = j;
                    while (k < content.size() && !"0".equals(content.get(k).code)) {
                        if ("70".equals(content.get(k).code)) {
                            closed = (((long) num(content.get(k).val)) & 1L) == 1L;
                        }
                        // '90' 顶点数（可选）忽略
                        if ("10".equals(content.get(k).code)) {
                            double x = num(content.get(k).val);
                            double y = 0;
                            double bulge = 0;
                            if (k + 1 < content.size() && "20".equals(content.get(k + 1).code)) {
                                y = num(content.get(k + 1).val);
                                k++;
                            }
                            if (k + 1 < content.size() && "42".equals(content.get(k + 1).code)) {
                                bulge = num(content.get(k + 1).val);
                                k++;
                            }
                            LwPoint lp = new LwPoint();
                            lp.x = x;
                            lp.y = y;
                            lp.bulge = bulge;
                            pts.add(lp);
                        }
                        k++;
                    }
                    RawEnt e = ent("LWPOLYLINE", layer);
                    e.closed = closed;
                    e.pts = pts;
                    ents.add(e);
                } else if ("CIRCLE".equals(t)) {
                    RawEnt e = ent("CIRCLE", layer);
                    e.c = new Vec(num(get(content, j, "10")), num(get(content, j, "20")));
                    e.r = num(get(content, j, "40"));
                    ents.add(e);
                } else if ("ARC".equals(t)) {
                    RawEnt e = ent("ARC", layer);
                    e.c = new Vec(num(get(content, j, "10")), num(get(content, j, "20")));
                    e.r = num(get(content, j, "40"));
                    e.a0 = num(get(content, j, "50"));
                    e.a1 = num(get(content, j, "51"));
                    ents.add(e);
                } else if ("POINT".equals(t)) {
                    RawEnt e = ent("POINT", layer);
                    e.p = new Vec(num(get(content, j, "10")), num(get(content, j, "20")));
                    ents.add(e);
                } else if ("TEXT".equals(t)) {
                    RawEnt e = ent("TEXT", layer);
                    e.p = new Vec(num(get(content, j, "10")), num(get(content, j, "20")));
                    double h = num(get(content, j, "40"));
                    e.height = h != 0 ? h : 30;      // 等价 num(field('40')) || 30
                    e.text = get(content, j, "1");
                    ents.add(e);
                } else if ("INSERT".equals(t)) {
                    ents.add(ent("INSERT", layer));
                } else {
                    ents.add(ent("UNKNOWN", layer));
                }
                // 跳到下一个 0 组
                while (j < content.size() && !"0".equals(content.get(j).code)) j++;
                i = j;
            } else {
                i++;
            }
        }
        return ents;
    }

    private static RawEnt ent(String type, String layer) {
        RawEnt e = new RawEnt();
        e.type = type;
        e.layer = layer;
        return e;
    }

    /* ------------------------------------------------------------------ */
    /* 几何 → 采样点                                                        */
    /* ------------------------------------------------------------------ */

    /** 圆弧采样（bulge/ARC/CIRCLE 通用），theta>0 逆时针。 */
    private static List<Vec> arcSamples(Vec c, double r, double a0, double theta, int n) {
        List<Vec> out = new ArrayList<>();
        for (int k = 0; k <= n; k++) {
            double a = a0 + (theta * k) / n;
            out.add(new Vec(c.x + r * Math.cos(a), c.y + r * Math.sin(a)));
        }
        return out;
    }

    /** 由 bulge 计算圆心与圆心角（P0→P1）。 */
    private static BulgeArc bulgeArc(Vec c0, Vec c1, double bulge) {
        BulgeArc out = new BulgeArc();
        double theta = 4 * Math.atan(bulge);            // 圆心角(带符号)
        double dx = c1.x - c0.x;
        double dy = c1.y - c0.y;
        double chord = Parsers.jsHypot(dx, dy);
        if (chord < 1e-9) {
            out.center = c0;
            out.r = 0;
            out.a0 = 0;
            out.theta = 0;
            return out;
        }
        double sin2 = Math.sin(theta / 2);
        double r = Math.abs(chord / (2 * Math.max(1e-9, sin2)));
        double h = chord / (2 * Math.max(1e-9, Math.tan(theta / 2)));   // 弦中点到圆心距离（带符号）
        // 圆心在 P0→P1 前进方向的左侧(+theta 即逆时针)
        double mx = (c0.x + c1.x) / 2;
        double my = (c0.y + c1.y) / 2;
        double nx = -dy / chord;
        double ny = dx / chord;                          // 单位左法向
        Vec center = new Vec(mx + nx * h, my + ny * h);
        out.center = center;
        out.r = r;
        out.a0 = Math.atan2(c0.y - center.y, c0.x - center.x);
        out.theta = theta;
        return out;
    }

    private static PathShape shape(String layer, List<Vec> pts, boolean closed, boolean fill, String kind) {
        PathShape s = new PathShape();
        s.layer = layer;
        s.pts = pts;
        s.closed = closed;
        s.fill = fill;
        s.kind = kind;
        return s;
    }

    private static Shapes entityToShapes(RawEnt e) {
        Shapes out = new Shapes();
        if ("LINE".equals(e.type)) {
            out.shapes.add(shape(e.layer, List.of(e.a, e.b), false, false, "line"));
        } else if ("LWPOLYLINE".equals(e.type)) {
            List<LwPoint> pts = e.pts;
            List<Vec> ptsOut = new ArrayList<>();
            int n = pts.size();
            for (int i = 0; i < n; i++) {
                LwPoint p0 = pts.get(i);
                LwPoint p1 = pts.get((i + 1) % n);
                ptsOut.add(new Vec(p0.x, p0.y));
                if (p0.bulge != 0) {
                    BulgeArc ba = bulgeArc(new Vec(p0.x, p0.y), new Vec(p1.x, p1.y), p0.bulge);
                    if (ba.r > 0) {
                        int segs = (int) Math.max(3, Math.min(24, Math.ceil(Math.abs(ba.theta) / (Math.PI / 10))));
                        List<Vec> arcs = arcSamples(ba.center, ba.r, ba.a0, ba.theta, segs);
                        for (int s = 1; s < arcs.size(); s++) ptsOut.add(arcs.get(s));   // 去掉首点(重复 p0)
                    }
                }
            }
            out.shapes.add(shape(e.layer, ptsOut, e.closed, e.closed, "curve"));
        } else if ("CIRCLE".equals(e.type)) {
            int segs = 32;
            out.shapes.add(shape(e.layer, arcSamples(e.c, e.r, 0, Math.PI * 2, segs), true, false, "curve"));
        } else if ("ARC".equals(e.type)) {
            double d = e.a1 - e.a0;   // 角度为度数；DXF ARC 方向逆时针（默认）
            int segs = (int) Math.max(6, Math.min(48, Math.ceil(Math.abs(d) / 8)));
            out.shapes.add(shape(e.layer,
                    arcSamples(e.c, e.r, (e.a0 * Math.PI) / 180, (d * Math.PI) / 180, segs),
                    false, false, "curve"));
        } else if ("POINT".equals(e.type)) {
            out.notes.add(e.p);
        } else if ("TEXT".equals(e.type)) {
            TextItem t = new TextItem();
            t.x = e.p.x;
            t.y = e.p.y;
            t.text = e.text;
            t.height = e.height != 0 ? e.height : 30;
            t.layer = e.layer;
            out.texts.add(t);
        }
        // INSERT / UNKNOWN 跳过
        return out;
    }

    /* ------------------------------------------------------------------ */
    /* 图层配色                                                            */
    /* ------------------------------------------------------------------ */

    private static final String[][] PALETTE = {
            {"#D44771", "#E85C87"}, {"#3B82F6", "#60A5FA"}, {"#10B981", "#34D399"}, {"#F59E0B", "#FBBF24"},
            {"#8B5CF6", "#A78BFA"}, {"#06B6D4", "#22D3EE"}, {"#EF4444", "#F87171"}, {"#64748B", "#94A3B8"},
            {"#0EA5E9", "#38BDF8"}, {"#84CC16", "#A3E635"}, {"#EC4899", "#F472B6"}, {"#78716C", "#A8A29E"},
    };

    private static String layerColor(List<LayerDef> layers, String name) {
        LayerDef def = null;
        for (LayerDef l : layers) {
            if (l.name.equals(name)) {
                def = l;
                break;
            }
        }
        int c = def != null ? def.color : 7;
        if (c <= 0) c = 7;
        if (c == 7) return "#2E2E33";      // 白/黑按近黑处理
        if (c == 1) return "#D44771";      // 结构主色（品牌色）红
        if (c == 2) return "#E8A13A";      // 黄
        if (c == 3) return "#3FA66B";      // 绿
        if (c == 4) return "#3A9BD5";      // 青
        if (c == 5) return "#3B6FE0";      // 蓝
        if (c == 6) return "#C04FC9";      // 品红
        if (c == 8) return "#9AA0A6";      // 灰
        if (c == 9) return "#C9CDD3";
        String[] k = PALETTE[Math.abs(c) % PALETTE.length];
        return k != null ? k[0] : "#2E2E33";
    }

    private static final Map<String, String> LAYER_LABEL = new LinkedHashMap<>();

    static {
        LAYER_LABEL.put("轮廓线", "轮廓线");
        LAYER_LABEL.put("结构线", "结构线");
        LAYER_LABEL.put("辅助线", "辅助线");
        LAYER_LABEL.put("标注", "标注");
        LAYER_LABEL.put("0", "图层 0");
    }

    /* ------------------------------------------------------------------ */
    /* SVG 生成                                                            */
    /* ------------------------------------------------------------------ */

    private static String fmt(double n) {
        return Parsers.fmtFixed(n, 1);
    }

    private static String esc(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    /** 解析 DXF 文本（title 为空时回落 'DXF 打版图'）。 */
    public static DxfResult parseDxf(String text, String title) {
        List<Pair> pairs = readPairs(text);
        List<LayerDef> layers = parseLayers(sectionContent(pairs, "TABLES"));
        List<RawEnt> rawEnts = parseEntities(sectionContent(pairs, "ENTITIES"));
        int entityCount = rawEnts.size();
        List<String> warns = new ArrayList<>();
        if (layers.isEmpty()) warns.add("未找到 LAYER 表，按默认图层渲染");
        if (entityCount == 0) warns.add("ENTITIES 中未解析到可渲染实体（LINE/LWPOLYLINE/CIRCLE/ARC/POINT/TEXT）");

        List<String> layerNames = new ArrayList<>();
        if (!layers.isEmpty()) {
            for (LayerDef l : layers) layerNames.add(l.name);
        } else if (entityCount > 0) {
            layerNames.add("0");
        }

        // 实体 → 形状
        List<PathShape> allShapes = new ArrayList<>();
        List<TextItem> allTexts = new ArrayList<>();
        List<Vec> allNotes = new ArrayList<>();
        for (RawEnt e : rawEnts) {
            Shapes sh = entityToShapes(e);
            allShapes.addAll(sh.shapes);
            allTexts.addAll(sh.texts);
            allNotes.addAll(sh.notes);
        }

        // 包围盒
        double minX = Double.POSITIVE_INFINITY;
        double maxX = Double.NEGATIVE_INFINITY;
        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (PathShape s : allShapes) {
            for (Vec v : s.pts) {
                minX = Math.min(minX, v.x);
                maxX = Math.max(maxX, v.x);
                minY = Math.min(minY, v.y);
                maxY = Math.max(maxY, v.y);
            }
        }
        for (TextItem t : allTexts) {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        }
        for (Vec n : allNotes) {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x);
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y);
        }

        if (!Double.isFinite(minX) || !Double.isFinite(maxX) || maxX - minX < 1e-6 || maxY - minY < 1e-6) {
            // 无可渲染内容：返回占位 SVG
            DxfResult r = new DxfResult();
            r.layerNames = layerNames;
            r.entityCount = entityCount;
            r.width = 0;
            r.height = 0;
            r.patternSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"420\" height=\"260\" viewBox=\"0 0 420 260\"><rect width=\"420\" height=\"260\" fill=\"#ffffff\"/><text x=\"210\" y=\"128\" text-anchor=\"middle\" fill=\"#9AA0A6\" font-size=\"16\">未解析到可渲染几何（请确认 DXF 为 R12 且包含 ENTITIES）</text></svg>";
            String joined = String.join("；", warns);
            r.parseWarn = joined.isEmpty() ? "文件无可用实体" : joined;
            return r;
        }

        double wModel = maxX - minX;
        double hModel = maxY - minY;

        // 视口变换：Y 轴翻转（DXF Y 向上 → SVG Y 向下），留白放标注
        double marginL = 84;
        double marginR = 30;
        double marginT = 66;
        double marginB = 62;
        double viewW = Math.max(200, 940 - marginL - marginR);
        double viewH = Math.max(200, 620 - marginT - marginB);
        double s = Math.min(viewW / wModel, viewH / hModel);
        double canvasW = Math.ceil(marginL + wModel * s + marginR);
        double canvasH = Math.ceil(marginT + hModel * s + marginB);
        View view = new View(marginL, marginT, minX, maxY, s);

        List<String> parts = new ArrayList<>();
        parts.add("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + Parsers.jsNum(canvasW)
                + "\" height=\"" + Parsers.jsNum(canvasH)
                + "\" viewBox=\"0 0 " + Parsers.jsNum(canvasW) + " " + Parsers.jsNum(canvasH)
                + "\" font-family=\"PingFang SC, Microsoft YaHei, sans-serif\">");
        parts.add("<rect x=\"0\" y=\"0\" width=\"" + Parsers.jsNum(canvasW) + "\" height=\"" + Parsers.jsNum(canvasH) + "\" fill=\"#ffffff\"/>");

        // 标题 + 图例
        String titleText = (title == null || title.isEmpty()) ? "DXF 打版图" : title;
        parts.add("<text x=\"" + Parsers.jsNum(marginL) + "\" y=\"26\" font-size=\"15\" font-weight=\"600\" fill=\"#2E2E33\">" + esc(titleText) + "</text>");
        parts.add("<text x=\"" + Parsers.jsNum(marginL) + "\" y=\"46\" font-size=\"10.5\" fill=\"#8A8F98\">图层 " + layerNames.size()
                + " · 实体 " + entityCount + " · 1 比例示意（DXF 单位）</text>");
        // 标注线/标尺外框
        String layerJoin = String.join(" / ", layerNames);
        parts.add("<text x=\"" + Parsers.jsNum(canvasW - marginR) + "\" y=\"26\" text-anchor=\"end\" font-size=\"10.5\" fill=\"#8A8F98\">"
                + esc(layerJoin.isEmpty() ? "-" : layerJoin) + "</text>");

        // 实体描边
        Map<String, String> uniq = new LinkedHashMap<>();
        for (PathShape sh : allShapes) {
            String color = layerColor(layers, sh.layer);
            List<Vec> pts = sh.pts;
            if (pts.size() < 2) continue;
            StringBuilder d = new StringBuilder("M " + fmt(view.sx(pts.get(0).x)) + " " + fmt(view.sy(pts.get(0).y)));
            for (int i = 1; i < pts.size(); i++) {
                d.append(" L ").append(fmt(view.sx(pts.get(i).x))).append(" ").append(fmt(view.sy(pts.get(i).y)));
            }
            if (sh.closed) d.append(" Z");
            String fill = sh.closed && sh.fill ? color + "14" : "none";
            String extra = "line".equals(sh.kind) ? " stroke-dasharray=\"6 4\"" : "";
            parts.add("<path d=\"" + d + "\" fill=\"" + fill + "\" stroke=\"" + color
                    + "\" stroke-width=\"" + ("line".equals(sh.kind) ? "1.1" : "1.6")
                    + "\" stroke-linejoin=\"round\"" + extra + "/>");
            uniq.put(sh.layer, color);
        }
        // POINT → 十字刀口标记
        for (Vec n : allNotes) {
            String color = layerColor(layers, "辅助线");
            parts.add("<path d=\"M " + fmt(view.sx(n.x) - 4) + " " + fmt(view.sy(n.y))
                    + " L " + fmt(view.sx(n.x) + 4) + " " + fmt(view.sy(n.y))
                    + " M " + fmt(view.sx(n.x)) + " " + fmt(view.sy(n.y) - 4)
                    + " L " + fmt(view.sx(n.x)) + " " + fmt(view.sy(n.y) + 4)
                    + "\" stroke=\"" + color + "\" stroke-width=\"1.2\"/>");
            parts.add("<circle cx=\"" + fmt(view.sx(n.x)) + "\" cy=\"" + fmt(view.sy(n.y)) + "\" r=\"1.6\" fill=\"" + color + "\"/>");
        }
        // TEXT
        for (TextItem t : allTexts) {
            if (t.text == null || t.text.isEmpty()) continue;
            double fs = Math.max(9, Math.min(13, t.height * s * 0.9));
            parts.add("<text x=\"" + fmt(view.sx(t.x)) + "\" y=\"" + fmt(view.sy(t.y) - 4)
                    + "\" font-size=\"" + fmt(fs) + "\" fill=\"#565B63\">" + esc(t.text) + "</text>");
        }

        // 图例（图层配色）
        List<LayerDef> legendLayers = new ArrayList<>(layers);   // 原 filter(l => uniq.has(l.name) || true) 恒真
        if (legendLayers.size() > 8) legendLayers = new ArrayList<>(legendLayers.subList(0, 8));
        if (layers.isEmpty() && entityCount > 0) legendLayers.add(new LayerDef("0", 7));
        double lx = canvasW - marginR;
        for (int i = legendLayers.size() - 1; i >= 0; i--) {
            LayerDef l = legendLayers.get(i);
            String color = layerColor(layers, l.name);
            String label = LAYER_LABEL.getOrDefault(l.name, l.name);
            double w = 12 + label.length() * 9 + 26;
            lx -= w;
            parts.add("<rect x=\"" + fmt(lx) + "\" y=\"32\" width=\"9\" height=\"9\" rx=\"1.5\" fill=\"" + color + "\"/>");
            parts.add("<text x=\"" + fmt(lx + 13) + "\" y=\"40\" font-size=\"10\" fill=\"#8A8F98\">" + esc(label) + "</text>");
        }

        // 尺寸标注：底宽 + 右高（模型单位）
        double dimY = canvasH - 26;
        parts.add("<line x1=\"" + fmt(view.sx(minX)) + "\" y1=\"" + fmt(dimY) + "\" x2=\"" + fmt(view.sx(maxX)) + "\" y2=\"" + fmt(dimY) + "\" stroke=\"#C2C6CC\" stroke-width=\"1\"/>");
        parts.add("<line x1=\"" + fmt(view.sx(minX)) + "\" y1=\"" + fmt(dimY - 5) + "\" x2=\"" + fmt(view.sx(minX)) + "\" y2=\"" + fmt(dimY + 5) + "\" stroke=\"#C2C6CC\"/>");
        parts.add("<line x1=\"" + fmt(view.sx(maxX)) + "\" y1=\"" + fmt(dimY - 5) + "\" x2=\"" + fmt(view.sx(maxX)) + "\" y2=\"" + fmt(dimY + 5) + "\" stroke=\"#C2C6CC\"/>");
        parts.add("<rect x=\"" + fmt((view.sx(minX) + view.sx(maxX)) / 2 - 40) + "\" y=\"" + fmt(dimY - 13) + "\" width=\"80\" height=\"14\" fill=\"#ffffff\"/>");
        parts.add("<text x=\"" + fmt((view.sx(minX) + view.sx(maxX)) / 2) + "\" y=\"" + fmt(dimY - 2) + "\" text-anchor=\"middle\" font-size=\"10.5\" fill=\"#565B63\">" + fmt(wModel) + " 单位</text>");
        double dimXR = canvasW - 12;
        parts.add("<line x1=\"" + fmt(dimXR) + "\" y1=\"" + fmt(view.sy(minY)) + "\" x2=\"" + fmt(dimXR) + "\" y2=\"" + fmt(view.sy(maxY)) + "\" stroke=\"#C2C6CC\" stroke-width=\"1\"/>");
        parts.add("<line x1=\"" + fmt(dimXR - 5) + "\" y1=\"" + fmt(view.sy(minY)) + "\" x2=\"" + fmt(dimXR + 5) + "\" y2=\"" + fmt(view.sy(minY)) + "\" stroke=\"#C2C6CC\"/>");
        parts.add("<line x1=\"" + fmt(dimXR - 5) + "\" y1=\"" + fmt(view.sy(maxY)) + "\" x2=\"" + fmt(dimXR + 5) + "\" y2=\"" + fmt(view.sy(maxY)) + "\" stroke=\"#C2C6CC\"/>");
        double midY = (view.sy(minY) + view.sy(maxY)) / 2;
        parts.add("<text x=\"" + fmt(dimXR + 4) + "\" y=\"" + fmt(midY + 3) + "\" font-size=\"10.5\" fill=\"#565B63\">" + fmt(hModel) + "</text>");

        parts.add("</svg>");

        DxfResult r = new DxfResult();
        r.layerNames = layerNames;
        r.entityCount = entityCount;
        r.width = Parsers.jsRound(wModel);
        r.height = Parsers.jsRound(hModel);
        r.patternSvg = String.join("\n", parts);
        r.parseWarn = warns.isEmpty() ? null : String.join("；", warns);
        r.note = "DXF R12 解析：" + rawEnts.size() + " 个实体 / " + layers.size() + " 个图层；圆弧(bulge)已还原为路径。";
        return r;
    }

    /** 供 seed/import 使用：DxfResult 转 Material 需要的摘要（等价 dxfMaterialSummary）。 */
    public static ParsedFields dxfMaterialSummary(DxfResult r) {
        ParsedFields f = new ParsedFields();
        f.layerNames = r.layerNames;
        f.entityCount = r.entityCount;
        f.patternSvg = r.patternSvg;
        f.width = r.width;
        f.height = r.height;
        f.parseWarn = r.parseWarn;
        f.note = r.note;
        return f;
    }
}
