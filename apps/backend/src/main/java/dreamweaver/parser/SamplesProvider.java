package dreamweaver.parser;

import dreamweaver.common.Errors;
import dreamweaver.entity.MaterialKind;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.InvalidPathException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * 示例文件提供者：逻辑对应原 TS `apps/server/src/parsers/samples.ts`（示例文件内容生成，
 * seed 时写入 samples 目录）+ `apps/server/src/db/seed.ts` 的 samples 落盘段
 * + `apps/server/src/routes/materials.ts` 的 import-help / sample-content 读盘段。
 *
 * <p>目录由 {@code dw.data-dir} 推导（= 数据目录的上一级 / samples）。
 * 本类不依赖任何持久层组件，可被播种流程与素材导入流程安全复用。
 * {@link #ensure()} 幂等：缺失的示例文件才写盘（保留使用者改动），随后返回清单；
 * {@link #read(String)} 做 basename 处理后读取原文（文本类 utf8、其他 base64），
 * 文件不存在时抛 {@link Errors#notFound(String)}（等价原 notFound/bad('NOT_FOUND')）。
 */
@Component
public class SamplesProvider {

    private static final Logger log = LoggerFactory.getLogger(SamplesProvider.class);

    /** 数据目录配置项，samples 目录取其上一级下的 samples/ */
    @Value("${dw.data-dir:./data}")
    private String dataDirProp;

    private volatile Path samplesDir;

    /** samples 目录（= 数据目录的上一级 / samples），首次访问时解析 */
    public Path samplesDir() {
        Path dir = samplesDir;
        if (dir == null) {
            Path dataDir = Path.of(dataDirProp).toAbsolutePath().normalize();
            Path parent = dataDir.getParent() == null ? dataDir : dataDir.getParent();
            dir = parent.resolve("samples");
            samplesDir = dir;
        }
        return dir;
    }

    /** 清单条目（对应 import-help 里 samples: {fileName,size,kind}[]）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SampleFile {
        public String fileName;
        public long size;
        public MaterialKind kind;
    }

    /** 示例原文（对应 GET /materials/sample-content 的返回体）。 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class SampleContent {
        public String fileName;
        public MaterialKind kind;
        public String content;
        public long size;
    }

    /* ------------------------------------------------------------------ */
    /* 目录与读取                                                          */
    /* ------------------------------------------------------------------ */

    /** 确保示例文件已生成并落盘，返回清单（等价 fs.readdirSync(SAMPLES_DIR)）。 */
    public synchronized List<SampleFile> ensure() {
        Path dir = samplesDir();
        if (dir == null) return new ArrayList<>();
        try {
            Files.createDirectories(dir);
            writeIfMissing(dir.resolve("dress-front-pattern.dxf"), buildDressFrontDxf());
            writeIfMissing(dir.resolve("shirt-front.dxf"), buildShirtFrontDxf());
            writeIfMissing(dir.resolve("dress.obj"), buildDressObj());
            writeIfMissing(dir.resolve("floral-print.svg"), buildFloralSvg());
        } catch (IOException e) {
            log.warn("[samples] 生成示例文件失败：{}", e.getMessage());
        }
        return list(dir);
    }

    private static void writeIfMissing(Path p, String content) throws IOException {
        if (!Files.exists(p)) {
            Files.writeString(p, content, StandardCharsets.UTF_8);
        }
    }

    private List<SampleFile> list(Path dir) {
        List<SampleFile> out = new ArrayList<>();
        if (!Files.exists(dir)) return out;               // 原实现 try/catch → samples = []
        List<Path> files = new ArrayList<>();
        try (Stream<Path> s = Files.list(dir)) {
            s.filter(Files::isRegularFile).forEach(files::add);
        } catch (IOException e) {
            return out;
        }
        // 原 readdirSync 顺序依赖文件系统；这里按文件名排序以保证输出稳定
        files.sort((a, c) -> a.getFileName().toString().compareTo(c.getFileName().toString()));
        for (Path p : files) {
            SampleFile f = new SampleFile();
            f.fileName = p.getFileName().toString();
            try {
                f.size = Files.size(p);
            } catch (IOException e) {
                f.size = 0L;
            }
            f.kind = guessKindOf(f.fileName);
            out.add(f);
        }
        return out;
    }

    /** 读取示例原文（文本类 utf8 / 其他 base64）；不存在时抛 404。 */
    public SampleContent read(String file) {
        String name = baseName(file);
        Path dir = samplesDir();
        Path p = (dir == null || name.isEmpty()) ? null : dir.resolve(name);
        if (p == null || !Files.exists(p)) throw Errors.notFound("示例文件不存在");
        MaterialKind kind = guessKindOf(name);
        String content;
        long size;
        try {
            if (kind == MaterialKind.DXF || kind == MaterialKind.OBJ || kind == MaterialKind.SVG) {
                content = Files.readString(p, StandardCharsets.UTF_8);
            } else {
                content = Base64.getEncoder().encodeToString(Files.readAllBytes(p));
            }
            size = Files.size(p);
        } catch (IOException e) {
            throw Errors.notFound("示例文件不存在");
        }
        SampleContent c = new SampleContent();
        c.fileName = name;
        c.kind = kind;
        c.content = content;
        c.size = size;
        return c;
    }

    /** 等价 path.basename(file)，防目录穿越。 */
    private static String baseName(String file) {
        if (file == null || file.isEmpty()) return "";
        try {
            Path p = Path.of(file).getFileName();
            return p == null ? "" : p.toString();
        } catch (InvalidPathException e) {
            return "";
        }
    }

    /**
     * 等价 parsers/index.ts 的 guessKindByExt（ext 判型，兜底 pdf）。
     * 放在本类以避免 Parsers ↔ SamplesProvider 的循环引用。
     */
    static MaterialKind guessKindOf(String fileName) {
        String f = fileName == null ? "" : fileName;
        int dot = f.lastIndexOf('.');
        String ext = (dot >= 0 ? f.substring(dot + 1) : f).toLowerCase(Locale.ROOT);
        switch (ext) {
            case "dxf": return MaterialKind.DXF;
            case "obj": return MaterialKind.OBJ;
            case "svg": return MaterialKind.SVG;
            case "png": return MaterialKind.PNG;
            case "jpg": return MaterialKind.JPG;
            case "jpeg": return MaterialKind.JPG;
            case "glb": return MaterialKind.GLB;
            case "zprj": return MaterialKind.ZPRJ;
            case "ai": return MaterialKind.AI;
            case "pdf": return MaterialKind.PDF;
            default: return MaterialKind.PDF;
        }
    }

    /* ------------------------------------------------------------------ */
    /* 示例文件内容（逐行对应 samples.ts）                                   */
    /* ------------------------------------------------------------------ */

    private static final class Pt {
        final double x;
        final double y;
        final double bulge;

        Pt(double x, double y, double bulge) {
            this.x = x;
            this.y = y;
            this.bulge = bulge;
        }
    }

    private static Pt p(double x, double y) {
        return new Pt(x, y, 0);
    }

    private static Pt b(double x, double y, double bulge) {
        return new Pt(x, y, bulge);
    }

    private static void add(List<String> list, String... items) {
        Collections.addAll(list, items);
    }

    private static String dxfHeader() {
        List<String> r = new ArrayList<>();
        add(r, "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC");
        return String.join("\n", r);
    }

    private static String dxfTables(List<DxfParser.LayerDef> layers) {
        List<String> rows = new ArrayList<>();
        for (DxfParser.LayerDef l : layers) {
            add(rows, "0", "LAYER", "2", l.name, "70", "0", "62", String.valueOf(l.color), "6", "CONTINUOUS");
        }
        List<String> all = new ArrayList<>();
        add(all, "0", "SECTION", "2", "TABLES", "0", "TABLE", "2", "LAYER", "70", String.valueOf(layers.size()));
        all.addAll(rows);
        add(all, "0", "ENDTAB", "0", "ENDSEC");
        return String.join("\n", all);
    }

    /** LWPOLYLINE：pts 为 [x,y,bulge?]；bulge=0 或缺省为直线段。 */
    private static String lw(String layer, List<Pt> pts, boolean closed) {
        List<String> rows = new ArrayList<>();
        add(rows, "0", "LWPOLYLINE", "8", layer, "90", String.valueOf(pts.size()), "70", closed ? "1" : "0");
        for (Pt pt : pts) {
            add(rows, "10", fmt1(pt.x), "20", fmt1(pt.y));
            if (pt.bulge != 0) add(rows, "42", fmt2(pt.bulge));
        }
        return String.join("\n", rows);
    }

    private static String line(String layer, double x1, double y1, double x2, double y2) {
        List<String> r = new ArrayList<>();
        add(r, "0", "LINE", "8", layer, "10", fmt1(x1), "20", fmt1(y1), "11", fmt1(x2), "21", fmt1(y2));
        return String.join("\n", r);
    }

    private static String circle(String layer, double cx, double cy, double r) {
        List<String> out = new ArrayList<>();
        add(out, "0", "CIRCLE", "8", layer, "10", fmt1(cx), "20", fmt1(cy), "40", fmt2(r));
        return String.join("\n", out);
    }

    private static String arc(String layer, double cx, double cy, double r, double a0, double a1) {
        List<String> out = new ArrayList<>();
        add(out, "0", "ARC", "8", layer, "10", fmt1(cx), "20", fmt1(cy), "40", fmt2(r), "50", fmt2(a0), "51", fmt2(a1));
        return String.join("\n", out);
    }

    private static String point(String layer, double x, double y) {
        List<String> r = new ArrayList<>();
        add(r, "0", "POINT", "8", layer, "10", fmt1(x), "20", fmt1(y));
        return String.join("\n", r);
    }

    private static String text(String layer, double x, double y, String s, double h) {
        List<String> r = new ArrayList<>();
        add(r, "0", "TEXT", "8", layer, "10", fmt1(x), "20", fmt1(y), "40", Parsers.jsNum(h), "1", s);
        return String.join("\n", r);
    }

    private static String entitiesBody(List<String> ents) {
        List<String> all = new ArrayList<>();
        add(all, "0", "SECTION", "2", "ENTITIES");
        all.addAll(ents);
        add(all, "0", "ENDSEC");
        return String.join("\n", all);
    }

    /** 等价 samples.ts 的 fmt1 = String(Math.round(n * 10) / 10)。 */
    private static String fmt1(double n) {
        return Parsers.jsNum(Parsers.jsRound(n * 10) / 10);
    }

    /** 等价 samples.ts 的 fmt2 = String(Math.round(n * 10000) / 10000)。 */
    private static String fmt2(double n) {
        return Parsers.jsNum(Parsers.jsRound(n * 10000) / 10000);
    }

    /* ---------------- 示例一：连衣裙前片 ---------------- */

    public static String buildDressFrontDxf() {
        List<DxfParser.LayerDef> layers = new ArrayList<>();
        layers.add(new DxfParser.LayerDef("轮廓线", 1));   // 成衣外轮廓
        layers.add(new DxfParser.LayerDef("结构线", 5));   // 胸/腰/臀结构线
        layers.add(new DxfParser.LayerDef("辅助线", 8));   // 布纹/延长线
        layers.add(new DxfParser.LayerDef("标注", 3));     // 文字/尺寸

        // 前片轮廓（沿顺时针：CF下摆→侧缝→袖窿→肩→领口→回CF）
        List<Pt> contour = new ArrayList<>();
        contour.add(p(0, 0));            // 前中心·下摆
        contour.add(p(146, 0));          // 下摆角
        contour.add(p(218, 126));        // 侧缝·裙摆外扩
        contour.add(p(258, 330));        // 侧缝·腰位（A 字）
        contour.add(p(264, 448));        // 侧缝·臀位
        contour.add(p(252, 528));        // 侧缝·腋下
        contour.add(b(250, 552, -0.22)); // 袖窿下弧（bulge）
        contour.add(b(196, 592, 0.18));  // 袖窿顶
        contour.add(p(150, 612));        // 肩端点
        contour.add(p(96, 636));         // 肩颈点
        contour.add(b(34, 618, -0.28));  // 领口弧（bulge 还原圆弧）
        contour.add(p(0, 600));          // 前领口·前中心

        List<String> ents = new ArrayList<>();
        ents.add(lw("轮廓线", contour, true));
        // 结构线：胸/腰/臀
        ents.add(lw("结构线", pts(p(0, 552), p(250, 552), p(264, 448)), false));
        ents.add(lw("结构线", pts(p(0, 330), p(258, 330)), false));
        ents.add(lw("结构线", pts(p(0, 448), p(264, 448)), false));
        // 省道（腰省）
        ents.add(lw("结构线", pts(p(72, 330), p(64, 452)), false));
        ents.add(lw("结构线", pts(p(120, 330), p(112, 452)), false));
        // 辅助：布纹线 + 对位线
        ents.add(line("辅助线", 20, 12, 20, 588));
        ents.add(line("辅助线", 146, -46, 146, 24));
        // 刀口标记
        ents.add(point("标注", 146, 0));
        ents.add(point("标注", 0, 448));
        ents.add(point("标注", 150, 612));
        // 文字
        ents.add(text("标注", 30, 30, "前中心", 20));
        ents.add(text("标注", 12, 340, "腰围线", 18));
        ents.add(text("标注", 12, 458, "臀围线", 18));
        ents.add(text("标注", 40, 560, "胸围线", 18));
        ents.add(text("标注", 232, 560, "袖窿弧(bulge)", 16));
        ents.add(text("标注", 96, 640, "连衣裙·前片 1:1", 24));
        ents.add(text("标注", 60, 588, "肩线", 16));
        ents.add(circle("标注", 146, 486, 5));

        return dxfHeader() + "\n" + dxfTables(layers) + "\n" + entitiesBody(ents);
    }

    private static List<Pt> pts(Pt... items) {
        List<Pt> out = new ArrayList<>();
        Collections.addAll(out, items);
        return out;
    }

    /* ---------------- 示例二：衬衫前片 ---------------- */

    public static String buildShirtFrontDxf() {
        List<DxfParser.LayerDef> layers = new ArrayList<>();
        layers.add(new DxfParser.LayerDef("轮廓线", 1));
        layers.add(new DxfParser.LayerDef("结构线", 5));
        layers.add(new DxfParser.LayerDef("辅助线", 8));
        layers.add(new DxfParser.LayerDef("标注", 3));

        List<Pt> contour = new ArrayList<>();
        contour.add(p(0, 0));           // 下摆
        contour.add(p(280, 0));
        contour.add(p(290, 60));        // 圆摆
        contour.add(p(288, 210));
        contour.add(p(262, 330));       // 腰
        contour.add(p(266, 470));
        contour.add(b(252, 560, -0.2)); // 袖窿
        contour.add(b(212, 640, 0.16));
        contour.add(p(180, 660));       // 肩点
        contour.add(p(126, 684));       // 肩颈
        contour.add(b(48, 668, -0.3));  // 领口
        contour.add(p(0, 650));

        List<String> ents = new ArrayList<>();
        ents.add(lw("轮廓线", contour, true));
        // 前襟(门襟)线、扣位
        ents.add(lw("结构线", pts(p(40, 660), p(40, 0)), false));
        ents.add(circle("标注", 40, 96, 6));
        ents.add(circle("标注", 40, 196, 6));
        ents.add(circle("标注", 40, 296, 6));
        // 腰/胸线
        ents.add(lw("结构线", pts(p(0, 330), p(262, 330)), false));
        ents.add(lw("结构线", pts(p(0, 560), p(252, 560)), false));
        ents.add(line("辅助线", 18, 8, 18, 640));
        ents.add(point("标注", 280, 0));
        ents.add(point("标注", 180, 660));
        ents.add(text("标注", 60, 40, "门襟", 20));
        ents.add(text("标注", 120, 344, "腰围线", 18));
        ents.add(text("标注", 120, 574, "胸围线", 18));
        ents.add(text("标注", 30, 692, "衬衫·前片 1:1", 24));
        ents.add(text("标注", 150, 672, "袖窿(bulge)", 15));
        ents.add(text("标注", 300, 330, "侧缝", 16));

        return dxfHeader() + "\n" + dxfTables(layers) + "\n" + entitiesBody(ents);
    }

    /* ---------------- 示例三：参数化连衣裙 OBJ ---------------- */

    public static String buildDressObj() {
        List<String> out = new ArrayList<>();
        out.add("# 织梦示例：参数化生成连衣裙网格（含几十顶点与三角面）");
        out.add("# 坐标系：y 向上，裙身沿 y 由腰到摆");

        int rings = 9;      // 层数
        int segs = 10;      // 每层分段（角度步长）
        List<double[]> positions = new ArrayList<>();
        List<double[]> profile = new ArrayList<>();
        for (int i = 0; i <= rings; i++) {
            double t = (double) i / rings;    // 0=腰 1=摆
            double r = 24 + t * t * 56;       // A 字外扩
            double y = 130 - t * 118;         // 裙长方向
            profile.add(new double[]{r, y});
        }
        // 顶点（由下往上建环）
        List<Integer> ringStart = new ArrayList<>();
        for (int i = 0; i <= rings; i++) {
            double r = profile.get(i)[0];
            double y = profile.get(i)[1];
            ringStart.add(positions.size());
            for (int k = 0; k < segs; k++) {
                double a = ((double) k / segs) * Math.PI * 2;
                positions.add(new double[]{Math.cos(a) * r, y, Math.sin(a) * r});
            }
        }
        // 底部收口（简化：给底环一个中心点做三角扇，方便封底）
        int bottomCenter = positions.size();
        positions.add(new double[]{0, profile.get(0)[1], 0});

        List<String> lines = new ArrayList<>();
        for (double[] pv : positions) {
            lines.add("v " + Parsers.toFixed(pv[0], 3) + " " + Parsers.toFixed(pv[1], 3) + " " + Parsers.toFixed(pv[2], 3));
        }
        lines.add("v 0 0 0");

        List<String> faces = new ArrayList<>();
        // 每相邻环之间：2 个三角
        for (int i = 0; i < rings; i++) {
            int a0 = ringStart.get(i);
            int a1 = ringStart.get(i + 1);
            for (int k = 0; k < segs; k++) {
                int k2 = (k + 1) % segs;
                // quad (a0+k, a0+k2, a1+k2, a1+k) → 两个三角
                faces.add("f " + (a0 + k + 1) + " " + (a0 + k2 + 1) + " " + (a1 + k2 + 1));
                faces.add("f " + (a0 + k + 1) + " " + (a1 + k2 + 1) + " " + (a1 + k + 1));
            }
        }
        // 封底（最下环）三角扇
        int bottom = ringStart.get(0);
        for (int k = 0; k < segs; k++) {
            int k2 = (k + 1) % segs;
            faces.add("f " + (bottom + k + 1) + " " + (bottom + k2 + 1) + " " + (bottomCenter + 1));
        }

        List<String> all = new ArrayList<>(out);
        all.addAll(lines);
        all.addAll(faces);
        return String.join("\n", all);
    }

    /* ---------------- 示例四：SVG 印花 ---------------- */

    public static String buildFloralSvg() {
        String[] petals = {"#F2B8C0", "#E88DA6", "#F7D6E0", "#D44771"};
        StringBuilder flowers = new StringBuilder();
        double[][] centers = {
                {90, 70, 34, 0}, {200, 46, 26, 1}, {312, 92, 38, 2}, {392, 60, 28, 3},
                {150, 156, 24, 3}, {330, 180, 30, 0}, {238, 212, 20, 2}, {428, 170, 22, 1},
        };
        for (double[] c : centers) {
            double cx = c[0];
            double cy = c[1];
            double r = c[2];
            int ci = (int) c[3];
            String col = petals[ci % petals.length];
            StringBuilder path = new StringBuilder();
            for (int i = 0; i < 5; i++) {
                double a = ((double) i / 5) * Math.PI * 2;
                double x = cx + Math.cos(a) * r * 0.8;
                double y = cy + Math.sin(a) * r * 0.8;
                double x2 = cx + Math.cos(a + 0.6) * r;
                double y2 = cy + Math.sin(a + 0.6) * r;
                double x3 = cx + Math.cos(a + 1.05) * r * 0.7;
                double y3 = cy + Math.sin(a + 1.05) * r * 0.7;
                path.append("M ").append(Parsers.jsNum(cx)).append(' ').append(Parsers.jsNum(cy))
                        .append(" Q ").append(Parsers.jsNum(x)).append(' ').append(Parsers.jsNum(y))
                        .append(' ').append(Parsers.jsNum(x2)).append(' ').append(Parsers.jsNum(y2))
                        .append(" Q ").append(Parsers.jsNum(x3)).append(' ').append(Parsers.jsNum(y3))
                        .append(' ').append(Parsers.jsNum(cx)).append(' ').append(Parsers.jsNum(cy)).append(' ');
            }
            flowers.append("<path d=\"").append(path).append("\" fill=\"").append(col).append("\" opacity=\"0.9\"/>");
            flowers.append("<circle cx=\"").append(Parsers.jsNum(cx)).append("\" cy=\"").append(Parsers.jsNum(cy))
                    .append("\" r=\"").append(Parsers.jsNum(Math.max(5, r * 0.22))).append("\" fill=\"#F9E37C\"/>");
        }
        return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"520\" height=\"260\" viewBox=\"0 0 520 260\">\n"
                + "<rect width=\"520\" height=\"260\" fill=\"#FFF9F5\"/>\n"
                + "<path d=\"M0 208 Q 90 150 150 190 T 300 180 T 520 160 L 520 260 L 0 260 Z\" fill=\"#F7E3E8\" opacity=\"0.8\"/>\n"
                + "<text x=\"24\" y=\"34\" font-size=\"13\" fill=\"#D44771\" font-family=\"sans-serif\" opacity=\"0.85\">织梦 · 花间集印花 1:1</text>\n"
                + flowers + "\n"
                + "</svg>";
    }
}
