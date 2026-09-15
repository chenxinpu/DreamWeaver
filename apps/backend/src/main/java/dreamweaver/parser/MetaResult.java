package dreamweaver.parser;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 占位解析结果，对应原 TS `apps/server/src/parsers/meta.ts` 的 {@code MetaParseResult}。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MetaResult {

    /** 内联 SVG 占位（含格式标签）的 data-url，前端可直接 &lt;img&gt;。 */
    public String cover;
    public String note;
    public String parseWarn;
    public Double width;
    public Double height;
}
