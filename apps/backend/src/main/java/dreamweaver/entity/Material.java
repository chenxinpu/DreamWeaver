package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 素材（导入的 DXF/OBJ/SVG/图片等设计结果文件）。对应表 {@code dw_material}。 */
@Entity
@Table(name = "dw_material")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Material {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "title", length = 255)
    public String title = "";
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 16)
    public MaterialKind kind = MaterialKind.PDF;
    @Column(name = "ext", length = 16)
    public String ext = "";
    @Column(name = "size")
    public long size;
    @Column(name = "file_name", length = 255)
    public String fileName = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_material_layer_names", joinColumns = @JoinColumn(name = "material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "layer_name")
    public List<String> layerNames;

    @Column(name = "entity_count")
    public Integer entityCount;

    /** 解析出的 SVG 内容，可能很大：用 LONGTEXT 避免 64KB 截断。 */
    @Column(name = "pattern_svg", columnDefinition = "LONGTEXT")
    public String patternSvg;

    /** 3D 预览摘要（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "obj_preview", columnDefinition = "json")
    public ObjPreview objPreview;

    @Column(name = "cover", length = 512)
    public String cover;
    @Column(name = "width")
    public Double width;
    @Column(name = "height")
    public Double height;
    @Column(name = "note", columnDefinition = "TEXT")
    public String note;
    @Column(name = "parse_warn", columnDefinition = "TEXT")
    public String parseWarn;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_material_tags", joinColumns = @JoinColumn(name = "material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "tag")
    public List<String> tags;

    @Column(name = "created_at", length = 32)
    public String createdAt;
}
