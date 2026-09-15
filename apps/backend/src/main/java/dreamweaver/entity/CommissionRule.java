package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 佣金规则。对应表 {@code dw_commission_rule}。 */
@Entity
@Table(name = "dw_commission_rule")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommissionRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "name", length = 128)
    public String name = "";

    /** 原字段名 `desc` 是 MySQL 保留字，列名用 `description`（JSON 契约仍是 `desc`）。 */
    @Column(name = "description", columnDefinition = "TEXT")
    public String desc = "";

    @Column(name = "active")
    public boolean active;

    /** level | penalty */
    @Column(name = "kind", length = 16)
    public String kind = "level";

    /** 原字段名 `when` 是 MySQL 保留字，列名用 `when_expr`（JSON 契约仍是 `when`）。 */
    @Column(name = "when_expr", length = 128)
    public String when = "";
}
