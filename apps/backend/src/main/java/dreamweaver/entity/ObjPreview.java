package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 3D 预览摘要。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ObjPreview {
    public int vertices;
    public int faces;
    public ObjMesh mesh;
}
