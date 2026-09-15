package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 站内通知。对应表 {@code dw_notification}。 */
@Entity
@Table(name = "dw_notification")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Notification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "user_id")
    public int userId;
    @Column(name = "type", length = 32)
    public String type = "";
    @Column(name = "title", length = 255)
    public String title = "";
    @Column(name = "body", columnDefinition = "TEXT")
    public String body = "";
    @Column(name = "link", length = 512)
    public String link;

    /** 原字段名 `read` 是 MySQL 保留字，列名用 `is_read`（JSON 契约仍是 `read`）。 */
    @Column(name = "is_read")
    public boolean read;

    @Column(name = "created_at", length = 32)
    public String createdAt;
}
