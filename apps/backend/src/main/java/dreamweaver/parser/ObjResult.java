package dreamweaver.parser;

import dreamweaver.entity.ObjMesh;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * OBJ 解析结果，对应原 TS `apps/server/src/parsers/obj.ts` 的 {@code ObjParseResult}。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ObjResult {

    public int vertices;
    public int faces;
    public ObjMesh mesh;
    public String note;
    public String parseWarn;
}
