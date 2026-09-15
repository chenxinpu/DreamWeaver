package dreamweaver.service;

import dreamweaver.entity.Role;
import dreamweaver.entity.User;

/** 认证与鉴权业务。 */
public interface AuthService {

    /** 签发访问令牌。 */
    String issueToken(int userId);

    /** 令牌 → userId，无效返回 null。 */
    Integer userIdOf(String token);

    void revoke(String token);

    User userOf(Integer userId);

    /** 取用户，不存在则抛 UNAUTHORIZED。 */
    User requireUser(Integer userId);

    /** 角色守卫：不在允许集合内抛 FORBIDDEN。 */
    void guard(Integer userId, Role... roles);

    void guardCreator(Integer userId);

    void guardConsumer(Integer userId);

    void guardStaff(Integer userId);

    /** 登录聚合：{token, user, unread, orderCounts, cartCount, creator?} */
    java.util.Map<String, Object> login(int userId);

    /** 我的资料聚合：{user, unread, orderCounts, cartCount, creator?} */
    java.util.Map<String, Object> meAggregate(int userId);

    /** 更新体型数据。 */
    User updateBody(int userId, java.util.Map<String, Object> body);
}
