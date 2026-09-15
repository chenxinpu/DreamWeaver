package dreamweaver.repository;

import dreamweaver.entity.Post;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 推文表持久层。 */
@Repository
public interface PostRepository extends JpaRepository<Post, Integer> {

    List<Post> findByDateKey(String dateKey);

    List<Post> findByAuthorIdOrderByCreatedAtDesc(int authorId);

    List<Post> findAllByOrderByCreatedAtDesc();

    List<Post> findByAuthorId(int authorId);

    long countByAuthorId(int authorId);
}
