package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 运行期杂项设置（开放式键值）。对应表 {@code dw_app_settings}。
 *
 * <p>由原 {@code Settings} 改名而来：单行记录，{@code id} 恒为 {@code 1}，
 * 因此主键用**指派式**（不是 {@code IDENTITY}），保存时直接写 {@code id = 1}。
 */
@Entity
@Table(name = "dw_app_settings")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AppSettings {
    /** 单行记录固定主键。 */
    @Id
    @Column(name = "id")
    public Integer id = 1;

    @Column(name = "last_pool_eval", length = 32)
    public String lastPoolEval;
    @Column(name = "last_window_audit", length = 32)
    public String lastWindowAudit;
    @Column(name = "seed_version")
    public Integer seedVersion;

    /** 原 {@code @JsonAnyGetter/@JsonAnySetter} 的开放键值，改为 JSON 列。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "extra", columnDefinition = "json")
    public Map<String, Object> extra;
}
