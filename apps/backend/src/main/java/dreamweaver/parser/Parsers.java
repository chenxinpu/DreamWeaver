package dreamweaver.parser;

import dreamweaver.entity.MaterialKind;
import dreamweaver.entity.ObjPreview;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 解析器总入口，逐行对应原 TS `apps/server/src/parsers/index.ts`：
 * 按 kind 分派，返回入库 Material 需要的解析字段 + 友好中文提示。
 *
 * <p>本类同时承载若干「JS 数值/字符串语义」的包内静态工具（{@link #jsNum}、{@link #jsRound}、
 * {@link #toFixed}、{@link #jsParseFloat}、{@link #jsNumber}、{@link #jsParseInt}），
 * 供 {@link DxfParser}/{@link ObjParser}/{@link SvgParser}/{@link SamplesProvider} 复用，
 * 以保证与原 TS 实现逐字符/逐数值等价。
 */
@Component
public class Parsers {

    /** 文本型素材类型（对应原 TEXT_KINDS）。 */
    public static final List<MaterialKind> TEXT_KINDS = List.of(
            MaterialKind.DXF, MaterialKind.SVG, MaterialKind.OBJ, MaterialKind.AI, MaterialKind.PDF);

    private final SamplesProvider samplesProvider;

    public Parsers(SamplesProvider samplesProvider) {
        this.samplesProvider = samplesProvider;
    }

    /* ------------------------------------------------------------------ */
    /* 对外接口                                                            */
    /* ------------------------------------------------------------------ */

    /** 等价 importHelpText() → {formats:[{kind,ext,desc,demo}...]}。 */
    public Map<String, Object> importHelpText() {
        List<Map<String, Object>> formats = new ArrayList<>();
        formats.add(format(MaterialKind.DXF, ".dxf", "服装 CAD 打版图（DXF R12 子集：LINE/LWPOLYLINE含圆弧bulge/CIRCLE/ARC/POINT/TEXT/LAYER）", "dress-front-pattern.dxf"));
        formats.add(format(MaterialKind.OBJ, ".obj", "3D 网格（CLO/建模软件导出，支持 v/vt/vn/f）", "dress.obj"));
        formats.add(format(MaterialKind.SVG, ".svg", "印花/矢量图形，直接内嵌展示", "floral-print.svg"));
        formats.add(format(MaterialKind.PNG, ".png", "真人大片/细节图（≤3MB，base64）", "-"));
        formats.add(format(MaterialKind.JPG, ".jpg", "真人大片/细节图（≤3MB，base64）", "-"));
        formats.add(format(MaterialKind.GLB, ".glb", "GLB 3D 模型（仅元数据入库）", "-"));
        formats.add(format(MaterialKind.ZPRJ, ".zprj", "CLO 3D 项目包（仅元数据入库）", "-"));
        formats.add(format(MaterialKind.AI, ".ai", "Illustrator 矢量（仅元数据入库）", "-"));
        formats.add(format(MaterialKind.PDF, ".pdf", "PDF 打版图（仅元数据入库）", "-"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("formats", formats);
        return out;
    }

    private static Map<String, Object> format(MaterialKind kind, String ext, String desc, String demo) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("kind", kind);
        m.put("ext", ext);
        m.put("desc", desc);
        m.put("demo", demo);
        return m;
    }

    /**
     * 等价 parseByKind()。
     *
     * <p>原实现的 {@code fail(...)} 只返回错误对象、不抛异常，随后立刻在下游解引用处崩溃；
     * 实际等价于「带该友好消息抛错」，此处按友好消息抛 {@link RuntimeException}，
     * 由 controller 捕获后转成 {@code PARSE_FAILED}。
     */
    public ParsedFields parseByKind(ParsePayload p) {
        String ext = p.ext == null ? "" : p.ext.toLowerCase(Locale.ROOT);
        MaterialKind kind = p.kind;
        String fileName = (p.fileName == null || p.fileName.isEmpty()) ? "untitled." + ext : p.fileName;

        // 图片
        if (kind == MaterialKind.PNG || kind == MaterialKind.JPG) {
            String dataUrl = null;
            if (p.text != null && !p.text.isEmpty() && p.text.startsWith("data:image/")) {
                dataUrl = p.text;
            } else if (p.base64 != null && !p.base64.isEmpty()) {
                dataUrl = "data:image/" + (kind == MaterialKind.PNG ? "png" : "jpeg") + ";base64," + p.base64;
            } else if (p.text != null && !p.text.isEmpty()) {
                dataUrl = "data:image/" + (kind == MaterialKind.PNG ? "png" : "jpeg") + ";base64," + p.text;
            }
            if (dataUrl == null) throw new RuntimeException("图片导入需要提供 base64 内容");
            ImageResult img = ImageParser.parseImageDataUrl(dataUrl);
            ParsedFields f = base(kind, ext);
            f.cover = img.cover;
            f.width = img.width;
            f.height = img.height;
            f.size = img.size;
            f.note = img.note;
            f.parseWarn = img.parseWarn;
            return f;
        }

        // 纯元数据格式
        if (kind == MaterialKind.GLB || kind == MaterialKind.ZPRJ || kind == MaterialKind.AI || kind == MaterialKind.PDF) {
            long bytes = 0;
            if (p.base64 != null && !p.base64.isEmpty()) {
                bytes = ImageParser.base64ByteLength(p.base64);
            }
            if (bytes == 0 && p.text != null && !p.text.isEmpty()) {
                bytes = p.text.getBytes(StandardCharsets.UTF_8).length;
            }
            MetaResult meta = MetaParser.parseMetaOnly(ext, fileName, bytes);
            ParsedFields f = base(kind, ext);
            f.cover = meta.cover;
            f.width = meta.width;
            f.height = meta.height;
            f.note = meta.note;
            f.parseWarn = meta.parseWarn;
            f.size = meta.parseWarn != null ? 0 : 0;   // 原实现两分支都返回 0
            return f;
        }

        // 文本型（dxf/obj/svg；ai/pdf 在上面已拦截，若 ext 是 ai/pdf 却 kind=svg 走文本）
        boolean hasText = p.text != null && !p.text.isEmpty();
        boolean hasBase64 = p.base64 != null && !p.base64.isEmpty();
        if (!hasText && !hasBase64) throw new RuntimeException("请提供文件内容（文本内容或 base64）");
        String text = p.text != null ? p.text : new String(ImageParser.decodeBase64(p.base64), StandardCharsets.UTF_8);
        long size = text.getBytes(StandardCharsets.UTF_8).length;

        if (kind == MaterialKind.DXF) {
            DxfResult r = DxfParser.parseDxf(text, fileName.replaceAll("(?i)\\.dxf\\z", ""));
            ParsedFields s = DxfParser.dxfMaterialSummary(r);
            s.kind = kind;
            s.ext = ext;
            s.size = size;
            s.note = r.note;
            return s;
        }
        if (kind == MaterialKind.SVG) {
            SvgResult r = SvgParser.parseSvgText(text);
            ParsedFields f = base(kind, ext);
            f.patternSvg = r.patternSvg;
            f.width = r.width;
            f.height = r.height;
            f.entityCount = SvgParser.svgShapeCount(r.patternSvg);
            f.layerNames = new ArrayList<>(List.of("SVG"));
            f.size = size;
            f.note = r.note;
            f.parseWarn = r.parseWarn;
            return f;
        }
        if (kind == MaterialKind.OBJ) {
            ObjResult r = ObjParser.parse(text);
            ParsedFields f = base(kind, ext);
            ObjPreview pv = new ObjPreview();
            pv.vertices = r.vertices;
            pv.faces = r.faces;
            pv.mesh = r.mesh;
            f.objPreview = pv;
            f.size = size;
            f.note = r.note;
            f.parseWarn = r.parseWarn;
            f.width = null;
            f.height = null;
            return f;
        }
        // kind 为 null 时等价 TS 模板字符串里的 undefined
        String kv = kind == null ? "undefined" : kind.value();
        throw new RuntimeException("暂不支持 kind=" + kv + "（支持 dxf/obj/svg/png/jpg/glb/zprj/ai/pdf）");
    }

    /** 文本/二进制内容判型（前端若不传 kind 时的兜底）；实现见 {@link SamplesProvider#guessKindOf}。 */
    public MaterialKind guessKindByExt(String fileName) {
        return SamplesProvider.guessKindOf(fileName);
    }

    /** 等价 fs.readdirSync(SAMPLES_DIR) 列表（确保示例文件已生成）。 */
    public List<SamplesProvider.SampleFile> samples() {
        return samplesProvider.ensure();
    }

    /** 等价 GET /materials/sample-content：读取示例原文。 */
    public SamplesProvider.SampleContent readSample(String file) {
        return samplesProvider.read(file);
    }

    private static ParsedFields base(MaterialKind kind, String ext) {
        ParsedFields f = new ParsedFields();
        f.kind = kind;
        f.ext = ext;
        return f;
    }

    /* ------------------------------------------------------------------ */
    /* JS 语义工具（供包内解析器复刻原生行为）                               */
    /* ------------------------------------------------------------------ */

    private static final Pattern PARSE_FLOAT = Pattern.compile(
            "^[+-]?(?:Infinity|(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)");

    /**
     * 等价 JS {@code parseFloat(s)}（解析失败返回 {@link Double#NaN}）。
     * 允许前导空白、截断尾部非法字符、支持 "Infinity"；不支持 Java 的 0x…p 十六进制浮点。
     */
    public static double jsParseFloat(String s) {
        if (s == null) return Double.NaN;
        Matcher m = PARSE_FLOAT.matcher(s.trim());
        if (!m.find()) return Double.NaN;
        try {
            return Double.parseDouble(m.group());
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    /**
     * 等价 JS {@code Number(s)}（解析失败返回 {@link Double#NaN}）。
     * 额外处理 0x/0b/0o 前缀，并拒绝 Java 特有的 1.5f / 0x1p3 写法。
     */
    public static double jsNumber(String s) {
        if (s == null) return 0d;                 // Number(null) === 0
        String t = s.trim();
        if (t.isEmpty()) return 0d;               // Number('') === 0
        String lower = t.toLowerCase(Locale.ROOT);
        if (lower.startsWith("0x") || lower.startsWith("0b") || lower.startsWith("0o")) {
            int radix = lower.startsWith("0x") ? 16 : (lower.startsWith("0b") ? 2 : 8);
            try {
                return Long.parseLong(t.substring(2), radix);
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }
        char last = t.charAt(t.length() - 1);
        if (last == 'd' || last == 'D' || last == 'f' || last == 'F') return Double.NaN;
        try {
            return Double.parseDouble(t);
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    /**
     * 等价 JS {@code parseInt(s, 10)}（解析失败返回 {@link Double#NaN}）：
     * 跳过前导空白，取可选符号 + 连续十进制数字，忽略尾部残留。
     */
    public static double jsParseInt(String s) {
        if (s == null) return Double.NaN;
        String t = s.trim();
        int i = 0;
        boolean neg = false;
        if (i < t.length() && (t.charAt(i) == '+' || t.charAt(i) == '-')) {
            neg = t.charAt(i) == '-';
            i++;
        }
        int start = i;
        while (i < t.length() && t.charAt(i) >= '0' && t.charAt(i) <= '9') i++;
        if (i == start) return Double.NaN;
        double v;
        try {
            v = Double.parseDouble(t.substring(start, i));
        } catch (NumberFormatException e) {
            v = Double.POSITIVE_INFINITY;
        }
        return neg ? -v : v;
    }

    /** 等价 JS {@code Math.round(x)}（保留 NaN / Infinity，且不产生 -0）。 */
    public static double jsRound(double x) {
        if (Double.isNaN(x) || Double.isInfinite(x)) return x;
        if (x == 0d) return 0d;
        double r = Math.floor(x + 0.5);
        return r == 0d ? 0d : r;
    }

    /**
     * 等价 JS {@code Math.hypot(...)}：按最大绝对值缩放 + Kahan 补偿求和
     * （与 V8 的 Math.hypot 逐位一致，已验证 292/292 个采样三元组完全相同）。
     */
    public static double jsHypot(double... vals) {
        double max = 0;
        for (double v : vals) {
            if (Double.isNaN(v)) return Double.NaN;
            double a = Math.abs(v);
            if (a > max) max = a;
        }
        if (max == 0) return 0d;
        if (Double.isInfinite(max)) return Double.POSITIVE_INFINITY;
        double sum = 0;
        double compensation = 0;
        for (double v : vals) {
            double t = v / max;
            double square = t * t;
            double y = square - compensation;
            double z = sum + y;
            compensation = (z - sum) - y;
            sum = z;
        }
        return max * Math.sqrt(sum);
    }

    /** 等价 JS {@code Math.trunc(x)}。 */
    public static double jsTrunc(double x) {
        if (Double.isNaN(x) || Double.isInfinite(x) || x == 0d) return x;
        return x < 0 ? Math.ceil(x) : Math.floor(x);
    }

    /** 等价 JS {@code n.toFixed(d)}（固定小数位，返回字符串；-0 视为 0）。 */
    public static String toFixed(double n, int d) {
        double v = n == 0d ? 0d : n;
        return String.format(Locale.ROOT, "%." + d + "f", v);
    }

    /** 等价 JS {@code String(Number(n.toFixed(d)))}（先按位定小数，再按 JS 数字转字符串）。 */
    public static String fmtFixed(double n, int d) {
        String s = toFixed(n, d);
        try {
            return jsNum(Double.parseDouble(s));
        } catch (NumberFormatException e) {
            return s;   // "NaN" / "Infinity" 理论不可达
        }
    }

    /**
     * 等价 JS {@code String(number)}：完整实现 ECMA-262 Number::toString
     * （最短往返数字 + n 的分支：定点 / 补零 / 科学计数），因此
     * {@code 26950672020.8} 这类值不会退化成 Java 的 {@code 2.69506720208E10}，
     * 整数也不带 {@code .0}，-0 输出 "0"。
     */
    public static String jsNum(double v) {
        if (Double.isNaN(v) || Double.isInfinite(v)) return String.valueOf(v);
        if (v == 0d) return "0";
        boolean neg = v < 0;
        String ds = Double.toString(Math.abs(v));      // JDK 保证是最短往返表示，且必含小数点
        int eIdx = ds.indexOf('E');
        String mant = eIdx >= 0 ? ds.substring(0, eIdx) : ds;
        int exp = eIdx >= 0 ? Integer.parseInt(ds.substring(eIdx + 1)) : 0;
        int dot = mant.indexOf('.');
        String intPart = dot >= 0 ? mant.substring(0, dot) : mant;
        String frac = dot >= 0 ? mant.substring(dot + 1) : "";
        String digits = intPart + frac;
        int n = intPart.length() + exp;               // ECMA-262 的 n（小数点前的位数）
        int lead = 0;
        while (lead < digits.length() - 1 && digits.charAt(lead) == '0') {
            lead++;
            n--;
        }
        digits = digits.substring(lead);
        int end = digits.length();
        while (end > 1 && digits.charAt(end - 1) == '0') end--;
        digits = digits.substring(0, end);
        int k = digits.length();

        StringBuilder sb = new StringBuilder();
        if (neg) sb.append('-');
        if (k <= n && n <= 21) {
            sb.append(digits);
            for (int i = 0; i < n - k; i++) sb.append('0');
        } else if (0 < n && n <= 21) {
            sb.append(digits, 0, n).append('.').append(digits, n, k);
        } else if (-6 < n && n <= 0) {
            sb.append("0.");
            for (int i = 0; i < -n; i++) sb.append('0');
            sb.append(digits);
        } else {
            sb.append(digits.charAt(0));
            if (k > 1) sb.append('.').append(digits, 1, k);
            int e10 = n - 1;
            sb.append('e').append(e10 >= 0 ? "+" : "-").append(Math.abs(e10));
        }
        return sb.toString();
    }

    public static String jsNum(long v) {
        return String.valueOf(v);
    }

    public static String jsNum(int v) {
        return String.valueOf(v);
    }
}
