package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.CascadeType;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.util.List;

/** 推文（信息流主体）。对应表 {@code dw_post}。 */
@Entity
@Table(name = "dw_post")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "author_id")
    public int authorId;
    @Column(name = "work_id")
    public Integer workId;
    @Column(name = "content", columnDefinition = "TEXT")
    public String content = "";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_post_images", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "idx")
    @Column(name = "image")
    public List<String> images;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_post_tags", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "idx")
    @Column(name = "tag")
    public List<String> tags;

    @Column(name = "created_at", length = 32)
    public String createdAt;
    @Column(name = "date_key", length = 16)
    public String dateKey;
    @Column(name = "likes")
    public int likes;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_post_liked_by", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "idx")
    @Column(name = "user_id")
    public List<Integer> likedBy;

    /** 唯一的真父子关系：Post 1 — N CommentItem。 */
    @OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @OrderBy("id ASC")
    public List<CommentItem> comments;

    @Column(name = "comment_count")
    public int commentCount;
    @Column(name = "share_count")
    public int shareCount;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_post_pattern_mats", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> patternMatIds;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "dw_post_model_mats", joinColumns = @JoinColumn(name = "post_id"))
    @OrderColumn(name = "idx")
    @Column(name = "mat_id")
    public List<Integer> modelMatIds;
}
