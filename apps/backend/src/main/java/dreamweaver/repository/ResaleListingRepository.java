package dreamweaver.repository;

import dreamweaver.entity.ResaleListing;
import dreamweaver.entity.ResaleStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 二手挂单表持久层。 */
@Repository
public interface ResaleListingRepository extends JpaRepository<ResaleListing, Integer> {

    List<ResaleListing> findByStatusOrderByCreatedAtDesc(ResaleStatus status);

    List<ResaleListing> findBySellerIdOrderByCreatedAtDesc(int sellerId);

    List<ResaleListing> findBySellerIdAndStatusOrderByCreatedAtDesc(int sellerId, ResaleStatus status);

    List<ResaleListing> findByOrderId(int orderId);
}
