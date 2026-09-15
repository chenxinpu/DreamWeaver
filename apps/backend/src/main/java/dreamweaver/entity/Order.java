package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 订单。对应表 {@code dw_order}。 */
@Entity
@Table(name = "dw_order")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "no", length = 64)
    public String no = "";
    @Column(name = "product_id")
    public int productId;
    @Column(name = "product_title", length = 255)
    public String productTitle = "";
    @Column(name = "cover", length = 512)
    public String cover = "";
    @Column(name = "creator_id")
    public int creatorId;
    @Enumerated(EnumType.STRING)
    @Column(name = "kind", length = 16)
    public OrderKind kind = OrderKind.DIRECT;
    @Column(name = "buyer_id")
    public int buyerId;

    /** 下单时采用的规格（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "spec_used", columnDefinition = "json")
    public OrderSpecUsed specUsed;

    /** 订单金额（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "amounts", columnDefinition = "json")
    public OrderAmounts amounts;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16)
    public OrderStatus status = OrderStatus.CREATED;

    /** 订单时间线（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "timeline", columnDefinition = "json")
    public List<OrderTimelineItem> timeline;

    /** 履约阶段（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "stage", columnDefinition = "json")
    public OrderStage stage;

    /** 质检报告（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "qc_report", columnDefinition = "json")
    public QcReport qcReport;

    /** 物流信息（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "logistics", columnDefinition = "json")
    public LogisticsInfo logistics;

    /** 售后请求（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "return_req", columnDefinition = "json")
    public ReturnReq returnReq;

    @Column(name = "paid_at", length = 32)
    public String paidAt;
    @Column(name = "shipped_at", length = 32)
    public String shippedAt;
    @Column(name = "received_at", length = 32)
    public String receivedAt;
    @Column(name = "created_at", length = 32)
    public String createdAt;

    /** 内部：渠道种子 / 演示标志 */
    @Column(name = "channel", length = 32)
    public String channel;
    @Column(name = "prod_days")
    public Integer prodDays;
    @Column(name = "simulate")
    public Boolean simulate;
}
