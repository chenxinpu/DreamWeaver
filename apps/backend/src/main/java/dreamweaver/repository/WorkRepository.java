package dreamweaver.repository;

import dreamweaver.entity.Work;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 作品表持久层。 */
@Repository
public interface WorkRepository extends JpaRepository<Work, Integer> {

    List<Work> findByCreatorIdOrderByCreatedAtDesc(int creatorId);

    List<Work> findByCreatorIdOrderByIdAsc(int creatorId);

    long countByCreatorId(int creatorId);
}
