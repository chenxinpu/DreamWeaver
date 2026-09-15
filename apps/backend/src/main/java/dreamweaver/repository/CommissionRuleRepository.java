package dreamweaver.repository;

import dreamweaver.entity.CommissionRule;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 佣金规则表持久层。 */
@Repository
public interface CommissionRuleRepository extends JpaRepository<CommissionRule, Integer> {

    List<CommissionRule> findAllByOrderByIdAsc();

    List<CommissionRule> findByActiveTrueOrderByIdAsc();

    List<CommissionRule> findByKindOrderByIdAsc(String kind);
}
