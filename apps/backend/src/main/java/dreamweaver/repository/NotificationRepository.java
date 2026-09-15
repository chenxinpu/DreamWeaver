package dreamweaver.repository;

import dreamweaver.entity.Notification;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** 站内通知表持久层。 */
@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(int userId);

    List<Notification> findByUserIdAndReadFalseOrderByCreatedAtDesc(int userId);

    List<Notification> findByUserIdAndTypeOrderByCreatedAtDesc(int userId, String type);

    List<Notification> findByUserIdAndReadFalseAndTypeOrderByCreatedAtDesc(int userId, String type);

    long countByUserIdAndReadFalse(int userId);

    @Modifying
    @Query("update Notification n set n.read = true where n.userId = :userId")
    int markAllRead(@Param("userId") int userId);

    @Modifying
    @Query("update Notification n set n.read = true where n.userId = :userId and n.id in :ids")
    int markReadByIds(@Param("userId") int userId, @Param("ids") List<Integer> ids);
}
