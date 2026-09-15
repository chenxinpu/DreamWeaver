package dreamweaver.repository;

import dreamweaver.entity.CommentItem;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 推文评论表持久层。 */
@Repository
public interface CommentRepository extends JpaRepository<CommentItem, Integer> {

    List<CommentItem> findByPostIdOrderByIdAsc(int postId);
}
