package dreamweaver.repository;

import dreamweaver.entity.ViewSeed;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 每日浏览量种子表持久层。 */
@Repository
public interface ViewSeedRepository extends JpaRepository<ViewSeed, Integer> {

    Optional<ViewSeed> findByProductIdAndDayKey(int productId, String dayKey);

    List<ViewSeed> findByCreatorIdAndDayKey(int creatorId, String dayKey);

    List<ViewSeed> findByCreatorId(int creatorId);
}
