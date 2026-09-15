package dreamweaver.parser;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SVG 解析器，逐行对应原 TS `apps/server/src/parsers/svg.ts`：
 * 直接把文件文本作为 patternSvg；尽量从 viewBox/width/height 读取尺寸。
 */
public final class SvgParser {

    private SvgParser() {
    }

    // /viewBox\s*=\s*["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i
    private static final Pattern VIEWBOX = Pattern.compile(
            "viewBox\\s*=\\s*[\"']\\s*([-\\d.]+)[,\\s]+([-\\d.]+)[,\\s]+([-\\d.]+)[,\\s]+([-\\d.]+)\\s*[\"']",
            Pattern.CASE_INSENSITIVE);

    // /\bwidth\s*=\s*["']\s*([-\d.]+)\s*(?:px)?["']/i
    private static final Pattern WIDTH = Pattern.compile(
            "\\bwidth\\s*=\\s*[\"']\\s*([-\\d.]+)\\s*(?:px)?[\"']", Pattern.CASE_INSENSITIVE);

    // /\bheight\s*=\s*["']\s*([-\d.]+)\s*(?:px)?["']/i
    private static final Pattern HEIGHT = Pattern.compile(
            "\\bheight\\s*=\\s*[\"']\\s*([-\\d.]+)\\s*(?:px)?[\"']", Pattern.CASE_INSENSITIVE);

    // /^<\s*(svg|!DOCTYPE|html)/i
    private static final Pattern DOC = Pattern.compile("^<\\s*(svg|!DOCTYPE|html)", Pattern.CASE_INSENSITIVE);

    // /<(path|circle|rect|ellipse|line|polyline|polygon)\b/gi
    private static final Pattern SHAPES = Pattern.compile(
            "<(path|circle|rect|ellipse|line|polyline|polygon)\\b", Pattern.CASE_INSENSITIVE);

    public static SvgResult parseSvgText(String text) {
        String trimmed = text.trim();
        List<String> warns = new ArrayList<>();
        Double width = null;
        Double height = null;

        // 尝试解析 viewBox="x y w h" 或 width="800"
        Matcher vb = VIEWBOX.matcher(trimmed);
        if (vb.find()) {
            width = Parsers.jsParseFloat(vb.group(3));
            height = Parsers.jsParseFloat(vb.group(4));
        }
        if (width == null) {
            Matcher wm = WIDTH.matcher(trimmed);
            if (wm.find()) width = Parsers.jsParseFloat(wm.group(1));
        }
        if (height == null) {
            Matcher hm = HEIGHT.matcher(trimmed);
            if (hm.find()) height = Parsers.jsParseFloat(hm.group(1));
        }

        if (!DOC.matcher(trimmed).find()) {
            warns.add("内容不是标准 SVG 文档，已按原始文本入库");
        }

        SvgResult r = new SvgResult();
        r.patternSvg = trimmed;
        // 等价 Math.round(width)：NaN 保留（原 TS 序列化后为 null）
        r.width = width == null ? null : Double.valueOf(Parsers.jsRound(width.doubleValue()));
        r.height = height == null ? null : Double.valueOf(Parsers.jsRound(height.doubleValue()));
        r.note = "SVG 已直接作为打版/印花图内嵌展示。";
        r.parseWarn = warns.isEmpty() ? null : String.join("；", warns);
        return r;
    }

    /** 从 SVG 文本中计数 path/circle 等（粗糙统计，作 entityCount 展示用）。 */
    public static int svgShapeCount(String text) {
        Matcher m = SHAPES.matcher(text == null ? "" : text);
        int count = 0;
        while (m.find()) count++;
        return count > 0 ? count : 1;
    }
}
