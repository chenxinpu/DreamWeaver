package dreamweaver.repository;

import dreamweaver.entity.Material;
import dreamweaver.entity.MaterialKind;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 素材表持久层。 */
@Repository
public interface MaterialRepository extends JpaRepository<Material, Integer> {

    List<Material> findByCreatorIdOrderByCreatedAtDesc(int creatorId);

    List<Material> findByCreatorIdAndKindOrderByCreatedAtDesc(int creatorId, MaterialKind kind);

    long countByCreatorId(int creatorId);

    List<Material> findByCreatorId(int creatorId);
}
