package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/** 作品。对应表 {@code dw_work}。 */
@Entity
@Table(name = "dw_work")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Work {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "title", length = 255)
    public String title = "";
    @Column(name = "category", length = 64)
    public String category = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_work_style_tags", joinColumns = @JoinColumn(name = "work_id"))
    @OrderColumn(name = "idx")
    @Column(name = "style_tag")
    public List<String> styleTags;

    @Column(name = "fabric", length = 128)
    public String fabric = "";

    /** 原字段名 `desc` 是 MySQL 保留字，列名用 `description`（JSON 契约仍是 `desc`）。 */
    @Column(name = "description", columnDefinition = "TEXT")
    public String desc = "";

    @Column(name = "cover", length = 512)
    public String cover = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_work_pattern_mats", joinColumns = @JoinColumn(name = "work_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> patternMatIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_work_model_mats", joinColumns = @JoinColumn(name = "work_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> modelMatIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_work_media_images", joinColumns = @JoinColumn(name = "work_id"))
    @OrderColumn(name = "idx")
    @Column(name = "image")
    public List<String> mediaImages;

    @Column(name = "created_at", length = 32)
    public String createdAt;
}
