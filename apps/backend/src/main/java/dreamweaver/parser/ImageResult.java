package dreamweaver.parser;

import dreamweaver.entity.MaterialKind;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 图片解析结果，对应原 TS `apps/server/src/parsers/image.ts` 的 {@code ImageParseResult}。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ImageResult {

    /** data:image/...;base64,... */
    public String cover;
    public Double width;
    public Double height;
    public long size;
    public MaterialKind kind;
    public String note;
    public String parseWarn;
}
