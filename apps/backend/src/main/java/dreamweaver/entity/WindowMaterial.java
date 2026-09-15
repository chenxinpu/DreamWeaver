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

/** 橱窗材料（真人穿搭图 + 规格 + 面料 + 3D/打版文件），审核通过后自动上架商城。对应表 {@code dw_window_material}。 */
@Entity
@Table(name = "dw_window_material")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WindowMaterial {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "work_id")
    public int workId;
    @Column(name = "post_id")
    public Integer postId;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16)
    public WindowStatus status = WindowStatus.DRAFT;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_window_material_photos", joinColumns = @JoinColumn(name = "window_material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "photo")
    public List<String> photos;

    /** 部件-面料对应（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "parts_fabric", columnDefinition = "json")
    public List<FabricPart> partsFabric;

    /** 产品规格（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "spec", columnDefinition = "json")
    public WindowSpec spec;

    @Column(name = "product_name", length = 255)
    public String productName = "";
    @Column(name = "category", length = 64)
    public String category = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_window_material_style_tags", joinColumns = @JoinColumn(name = "window_material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "style_tag")
    public List<String> styleTags;

    @Column(name = "price")
    public double price;
    @Column(name = "base_fee")
    public double baseFee;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_window_material_pattern_mats", joinColumns = @JoinColumn(name = "window_material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> patternMatIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_window_material_model_mats", joinColumns = @JoinColumn(name = "window_material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> modelMatIds;

    /** 审核日志（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "audit_log", columnDefinition = "json")
    public List<AuditLogItem> auditLog;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_window_material_audit_missing", joinColumns = @JoinColumn(name = "window_material_id"))
    @OrderColumn(name = "idx")
    @Column(name = "item")
    public List<String> auditMissing;

    @Column(name = "created_at", length = 32)
    public String createdAt;
    @Column(name = "updated_at", length = 32)
    public String updatedAt;

    /** 生产周期（天） */
    @Column(name = "prod_days")
    public Integer prodDays;
}
