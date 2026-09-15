package dreamweaver.repository;

import dreamweaver.entity.Product;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 商品表持久层。 */
@Repository
public interface ProductRepository extends JpaRepository<Product, Integer> {

    List<Product> findByStatus(String status);

    List<Product> findByCreatorIdOrderByCreatedAtDesc(int creatorId);

    List<Product> findByCreatorIdAndStatusOrderByCreatedAtDesc(int creatorId, String status);

    List<Product> findByWorkId(int workId);

    List<Product> findByWindowId(int windowId);

    List<Product> findAllByOrderByCreatedAtDesc();

    long countByCreatorIdAndStatus(int creatorId, String status);
}
