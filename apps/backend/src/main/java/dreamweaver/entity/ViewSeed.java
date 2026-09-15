package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * 每日浏览量种子。对应表 {@code dw_view_seed}。
 *
 * <p>改造说明：原内存库版本没有主键，MySQL 表必须有主键，故新增自增 {@code id}；
 * 业务唯一性仍由 {@code (productId, dayKey)} 保证（见 {@code ViewSeedRepository}）。
 */
@Entity
@Table(name = "dw_view_seed")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ViewSeed {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "product_id")
    public int productId;
    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "day_key", length = 16)
    public String dayKey;
    @Column(name = "count")
    public int count;
}
