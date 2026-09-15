package dreamweaver.repository;

import dreamweaver.entity.Order;
import dreamweaver.entity.OrderStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 订单表持久层。 */
@Repository
public interface OrderRepository extends JpaRepository<Order, Integer> {

    List<Order> findByBuyerIdOrderByCreatedAtDesc(int buyerId);

    List<Order> findByBuyerIdAndStatusOrderByCreatedAtDesc(int buyerId, OrderStatus status);

    List<Order> findByCreatorIdOrderByCreatedAtDesc(int creatorId);

    List<Order> findByCreatorIdAndStatusOrderByCreatedAtDesc(int creatorId, OrderStatus status);

    List<Order> findByCreatorIdAndProductIdOrderByCreatedAtDesc(int creatorId, int productId);

    List<Order> findByStatus(OrderStatus status);

    List<Order> findAllByOrderByCreatedAtDesc();

    long countByBuyerIdAndStatus(int buyerId, OrderStatus status);
}
