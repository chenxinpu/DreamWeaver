package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** 用户（消费者/创作者/审核员/管理员）。对应表 {@code dw_user}。 */
@Entity
@Table(name = "dw_user")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class User {
    /**
     * 用户主键：**指派式**而非数据库自增。
     *
     * <p>原因：演示账号必须保持固定 id（{@code 1} 小织 / {@code 14} 我的小号 / {@code 99} 平台审核专员），
     * 前端演示、登录入口与回归脚本都直接引用这些 id。若用 {@code GenerationType.IDENTITY}，
     * Hibernate 会**丢弃手工指定的 id** 而改用数据库自增值（99 会变成 19），破坏演示契约。
     *
     * <p>本工程没有「注册新用户」接口，用户仅在演示数据播种时创建，因此指派 id 是安全的。
     */
    @Id
    @Column(name = "id")
    public Integer id;

    @Column(name = "nickname", length = 64)
    public String nickname = "";
    @Column(name = "avatar", length = 512)
    public String avatar = "";
    @Column(name = "bio", columnDefinition = "TEXT")
    public String bio = "";
    @Enumerated(EnumType.STRING)
    @Column(name = "role", length = 16)
    public Role role = Role.CONSUMER;
    @Column(name = "level")
    public int level;
    @Column(name = "followers")
    public int followers;
    @Column(name = "following")
    public int following;

    /** 体型数据（JSON 列）。 */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "body", columnDefinition = "json")
    public BodyMeasurement body;

    @Column(name = "created_at", length = 32)
    public String createdAt;

    /** 内部字段：关注列表（鉴权/关注演示） */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_user_follows", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "idx")
    @Column(name = "follow_user_id")
    public List<Integer> follows;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_user_collect_products", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "idx")
    @Column(name = "product_id")
    public List<Integer> collectProductIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_user_collect_posts", joinColumns = @JoinColumn(name = "user_id"))
    @OrderColumn(name = "idx")
    @Column(name = "post_id")
    public List<Integer> collectPostIds;

    @Column(name = "password_hint", length = 128)
    public String passwordHint;
}
