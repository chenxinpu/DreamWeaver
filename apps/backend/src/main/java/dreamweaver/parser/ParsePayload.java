package dreamweaver.parser;

import dreamweaver.entity.MaterialKind;

/**
 * 解析入参，逐字段对应原 TS `apps/server/src/parsers/index.ts` 的 {@code ParsePayload}。
 *
 * <ul>
 *   <li>{@link #text} 文本型(kind=dxf/obj/svg/ai/pdf...)的原始文本；或任意 kind 的 base64 / data-url</li>
 *   <li>{@link #base64} 二进制 base64（无 data url 头时配合 kind 使用）</li>
 * </ul>
 */
public class ParsePayload {

    public MaterialKind kind;
    public String ext;
    public String fileName;
    public String text;
    public String base64;

    public ParsePayload() {
    }

    public ParsePayload(MaterialKind kind, String ext, String fileName, String text, String base64) {
        this.kind = kind;
        this.ext = ext;
        this.fileName = fileName;
        this.text = text;
        this.base64 = base64;
    }

    public static ParsePayload of(MaterialKind kind, String ext, String fileName, String text, String base64) {
        return new ParsePayload(kind, ext, fileName, text, base64);
    }
}
