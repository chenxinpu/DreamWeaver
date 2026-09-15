package dreamweaver.repository;

import dreamweaver.entity.LedgerEvent;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 资金流水表持久层。 */
@Repository
public interface LedgerEventRepository extends JpaRepository<LedgerEvent, Integer> {

    List<LedgerEvent> findByUserIdOrderByIdAsc(int userId);

    /** 取某用户最后一笔流水（用于余额推演） */
    LedgerEvent findFirstByUserIdOrderByIdDesc(int userId);

    List<LedgerEvent> findAllByOrderByIdAsc();
}
