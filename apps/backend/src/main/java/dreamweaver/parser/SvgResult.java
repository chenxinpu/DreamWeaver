package dreamweaver.parser;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SVG 解析结果，对应原 TS `apps/server/src/parsers/svg.ts` 的 {@code SvgParseResult}。
 *
 * <p>{@link #width}/{@link #height} 为 {@code Math.round(parseFloat(...))} 的结果；
 * 原 TS 中尺寸解析失败会得到 {@code NaN}，这里保持 {@link Double#NaN} 语义（字段可缺席用 null）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SvgResult {

    public String patternSvg;
    public Double width;
    public Double height;
    public String note;
    public String parseWarn;
}
