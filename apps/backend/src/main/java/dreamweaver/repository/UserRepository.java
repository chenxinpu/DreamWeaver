package dreamweaver.repository;

import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** 用户表持久层。 */
@Repository
public interface UserRepository extends JpaRepository<User, Integer> {

    List<User> findAllByOrderByIdAsc();

    List<User> findByRole(Role role);

    /** 达人榜：按粉丝数倒序（仅指定角色） */
    List<User> findByRoleOrderByFollowersDesc(Role role);

    List<User> findByRoleInOrderByFollowersDesc(List<Role> roles);
}
