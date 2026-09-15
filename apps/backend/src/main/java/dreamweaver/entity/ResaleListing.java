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

/** 二手集市挂单。对应表 {@code dw_resale_listing}。 */
@Entity
@Table(name = "dw_resale_listing")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ResaleListing {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "order_id")
    public int orderId;
    @Column(name = "product_id")
    public int productId;
    @Column(name = "original_title", length = 255)
    public String originalTitle = "";
    @Column(name = "seller_id")
    public int sellerId;
    @Column(name = "photo", length = 512)
    public String photo = "";
    @Column(name = "size_label", length = 32)
    public String sizeLabel = "";
    @Column(name = "list_price")
    public double listPrice;
    @Column(name = "original_price")
    public Double originalPrice;
    @Column(name = "platform_fee_rate")
    public double platformFeeRate;
    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 16)
    public ResaleStatus status = ResaleStatus.ACTIVE;
    @Column(name = "sold_to")
    public Integer soldTo;
    @Column(name = "sold_at", length = 32)
    public String soldAt;
    @Column(name = "net_to_seller")
    public Double netToSeller;
    @Column(name = "fee_charged")
    public Double feeCharged;
    @Column(name = "created_at", length = 32)
    public String createdAt;
}
