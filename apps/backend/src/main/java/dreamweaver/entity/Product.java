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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 商城商品。对应表 {@code dw_product}。 */
@Entity
@Table(name = "dw_product")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "work_id")
    public int workId;
    @Column(name = "window_id")
    public int windowId;
    @Column(name = "title", length = 255)
    public String title = "";
    @Column(name = "category", length = 64)
    public String category = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_product_style_tags", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "idx")
    @Column(name = "style_tag")
    public List<String> styleTags;

    @Column(name = "price")
    public double price;
    @Column(name = "base_fee")
    public double baseFee;
    @Column(name = "cover", length = 512)
    public String cover = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_product_images", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "idx")
    @Column(name = "image")
    public List<String> images;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_product_pattern_mats", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> patternMatIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_product_model_mats", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> modelMatIds;

    /** AI 生成的详情页内容（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_detail", columnDefinition = "json")
    public AiDetail aiDetail;

    /** 创作者人工修改（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "detail_edits", columnDefinition = "json")
    public DetailEdits detailEdits;

    @Column(name = "views")
    public int views;
    @Column(name = "sales")
    public int sales;

    /** draft | onSale | offShelf */
    @Column(name = "status", length = 16)
    public String status = "draft";
    @Column(name = "created_at", length = 32)
    public String createdAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_product_liked_by", joinColumns = @JoinColumn(name = "product_id"))
    @OrderColumn(name = "idx")
    @Column(name = "user_id")
    public List<Integer> likedBy;

    @Column(name = "prod_days")
    public Integer prodDays;
}
