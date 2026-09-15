package dreamweaver.repository;

import dreamweaver.entity.PoolEntry;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 资源池条目表持久层。 */
@Repository
public interface PoolEntryRepository extends JpaRepository<PoolEntry, Integer> {

    List<PoolEntry> findByCreatorIdOrderByQualifiedAtDesc(int creatorId);

    List<PoolEntry> findByPostId(int postId);

    List<PoolEntry> findByWorkId(int workId);

    boolean existsByPostIdAndDateKey(int postId, String dateKey);

    long countByCreatorId(int creatorId);
}
