package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** 轻量三角网格。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ObjMesh {
    public List<Double> positions;
    public List<Integer> faces;
    public List<Double> normals;
}
