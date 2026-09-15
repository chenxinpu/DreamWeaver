package dreamweaver.service;

import java.util.Map;

/** 用户公开资料与创作者聚合业务。 */
public interface UserService {

    /** 用户详情聚合：{user, works, creator?}（对应 GET /api/users/{id}）。 */
    Map<String, Object> detail(int userId);
}
