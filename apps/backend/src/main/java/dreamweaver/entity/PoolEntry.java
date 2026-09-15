package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** 资源池条目（作品通过市场认可筛选后入池）。对应表 {@code dw_pool_entry}。 */
@Entity
@Table(name = "dw_pool_entry")
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PoolEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    public Integer id;

    @Column(name = "post_id")
    public int postId;
    @Column(name = "work_id")
    public Integer workId;
    @Column(name = "creator_id")
    public int creatorId;
    @Column(name = "qualified_at", length = 32)
    public String qualifiedAt;
    @Column(name = "date_key", length = 16)
    public String dateKey;
    @Column(name = "reason", columnDefinition = "TEXT")
    public String reason = "";
    @Column(name = "like_p60")
    public double likeP60;
    @Column(name = "like_at_qualify")
    public int likeAtQualify;
    @Column(name = "comment_at_qualify")
    public int commentAtQualify;
    @Column(name = "notified_at", length = 32)
    public String notifiedAt;
}
