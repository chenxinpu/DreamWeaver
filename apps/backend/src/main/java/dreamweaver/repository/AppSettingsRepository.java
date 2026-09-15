package dreamweaver.repository;

import dreamweaver.entity.AppSettings;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 运行期设置表持久层（单行记录，id 固定为 1）。 */
@Repository
public interface AppSettingsRepository extends JpaRepository<AppSettings, Integer> {
}
