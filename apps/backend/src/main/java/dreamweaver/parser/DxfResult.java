package dreamweaver.parser;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * DXF 解析结果，对应原 TS `apps/server/src/parsers/dxf.ts` 的 {@code DxfParseResult}。
 *
 * <p>{@link #width}/{@link #height} 为 {@code Math.round()} 之后的模型尺寸（模型单位）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DxfResult {

    public List<String> layerNames;
    public int entityCount;
    public String patternSvg;
    public double width;
    public double height;
    public String parseWarn;
    public String note;
}
