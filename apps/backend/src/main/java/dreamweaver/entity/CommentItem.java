package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** 推文评论。对应表 {@code dw_comment}。 */
@Entity
@Table(name = "dw_comment")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CommentItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    /** 所属推文（父实体，JSON 序列化时忽略以避免循环）。 */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "post_id")
    @JsonIgnore
    public Post post;

    @Column(name = "user_id")
    public int userId;
    @Column(name = "content", columnDefinition = "TEXT")
    public String content = "";
    @Column(name = "created_at", length = 32)
    public String createdAt;
    @Column(name = "likes")
    public int likes;
}
