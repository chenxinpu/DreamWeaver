package dreamweaver.repository;

import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 橱窗材料表持久层。 */
@Repository
public interface WindowMaterialRepository extends JpaRepository<WindowMaterial, Integer> {

    List<WindowMaterial> findByCreatorIdOrderByUpdatedAtDesc(int creatorId);

    List<WindowMaterial> findByCreatorIdAndStatusOrderByUpdatedAtDesc(int creatorId, WindowStatus status);

    List<WindowMaterial> findByStatus(WindowStatus status);

    List<WindowMaterial> findByWorkId(int workId);

    boolean existsByWorkIdAndStatus(int workId, WindowStatus status);
}
