package dreamweaver.parser;

import dreamweaver.entity.MaterialKind;
import dreamweaver.entity.ObjPreview;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * 入库 Material 所需的解析字段，逐字段对应原 TS `apps/server/src/parsers/index.ts` 的
 * {@code ParsedMaterialFields}。
 *
 * <p>TS 里可能为 undefined 的字段用包装类型（{@link Integer}/{@link Double}）+
 * {@code NON_NULL}，序列化时与「对象展开省略该键」等价；
 * {@link #size} 与 TS 的 {@code size: number} 一样始终存在。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ParsedFields {

    public List<String> layerNames;
    public Integer entityCount;
    public String patternSvg;
    public ObjPreview objPreview;
    public String cover;
    public Double width;
    public Double height;
    public String note;
    public String parseWarn;
    public long size;
    public MaterialKind kind;
    public String ext;
}
