package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 资金流水。对应表 {@code dw_ledger_event}。 */
@Entity
@Table(name = "dw_ledger_event")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LedgerEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "user_id")
    public int userId;
    @Column(name = "kind", length = 32)
    public String kind = "";
    @Column(name = "amount")
    public double amount;
    @Column(name = "balance")
    public double balance;
    @Column(name = "ref_no", length = 64)
    public String refNo = "";
    @Column(name = "created_at", length = 32)
    public String createdAt;
}
