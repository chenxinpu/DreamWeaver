package dreamweaver.parser;

import dreamweaver.common.MiscUtil;
import dreamweaver.entity.MaterialKind;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * 占位解析，逐行对应原 TS `apps/server/src/parsers/meta.ts`：
 * glb / zprj / ai / pdf 等主流软件结果文件——仅元数据 + 按 ext 的封面占位 + parseWarn。
 */
public final class MetaParser {

    private MetaParser() {
    }

    private static final Map<String, String> EXT_NAME = new LinkedHashMap<>();
    private static final Map<String, String> EXT_ICON = new LinkedHashMap<>();

    static {
        EXT_NAME.put("glb", "GLB 3D 模型");
        EXT_NAME.put("zprj", "CLO 项目包");
        EXT_NAME.put("ai", "Adobe Illustrator");
        EXT_NAME.put("pdf", "PDF 打版文件");

        EXT_ICON.put("glb", "🧊");
        EXT_ICON.put("zprj", "🧵");
        EXT_ICON.put("ai", "✒️");
        EXT_ICON.put("pdf", "📄");
    }

    public static MetaResult parseMetaOnly(String ext, String fileName, long bytes) {
        String e = ext == null ? "" : ext;
        String name = EXT_NAME.containsKey(e) ? EXT_NAME.get(e) : e.toUpperCase(Locale.ROOT);
        String icon = EXT_ICON.containsKey(e) ? EXT_ICON.get(e) : "📦";
        String svg =
                "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"240\" viewBox=\"0 0 320 240\">"
                        + "<rect width=\"320\" height=\"240\" fill=\"#F6F1F0\"/>"
                        + "<text x=\"160\" y=\"92\" text-anchor=\"middle\" font-size=\"52\">" + icon + "</text>"
                        + "<text x=\"160\" y=\"132\" text-anchor=\"middle\" font-size=\"16\" fill=\"#D44771\" font-weight=\"600\">" + name + "</text>"
                        + "<text x=\"160\" y=\"158\" text-anchor=\"middle\" font-size=\"12\" fill=\"#9B9398\">" + esc(fileName) + "</text>"
                        + "<text x=\"160\" y=\"180\" text-anchor=\"middle\" font-size=\"11\" fill=\"#B4ABB1\">仅元数据入库 · "
                        + Parsers.toFixed(bytes / 1024.0, 1) + " KB</text>"
                        + "</svg>";

        MetaResult r = new MetaResult();
        r.cover = MiscUtil.svgDataUrl(svg);
        r.width = 320d;
        r.height = 240d;
        r.parseWarn = "该格式暂以元数据入库：已保存文件名/大小/来源，后续可在素材库查看来源信息。";
        r.note = name + " · 仅元数据";
        return r;
    }

    public static MaterialKind metaKindFromExt(String ext) {
        if ("glb".equals(ext) || "zprj".equals(ext) || "ai".equals(ext) || "pdf".equals(ext)) {
            return MaterialKind.of(ext);
        }
        return MaterialKind.GLB;
    }

    private static String esc(String s) {
        String v = s == null ? "" : s;
        return v.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
