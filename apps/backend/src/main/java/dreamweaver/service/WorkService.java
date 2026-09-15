package dreamweaver.service;

import dreamweaver.entity.Work;
import java.util.Map;

/** 作品业务：组织作品（素材组装）/编辑/删除/详情（对应 apps/server/src/routes/works.ts）。 */
public interface WorkService {

    /** 新建作品（仅创作者；category 白名单 + 素材归属校验），返回作品实体。 */
    Work create(int userId, Map<String, Object> body);

    /** 我的作品（按 createdAt 倒序），返回 {list,total}。 */
    Map<String, Object> mine(Integer userId);

    /** 编辑作品（仅作者），返回作品实体。 */
    Work edit(Integer userId, int workId, Map<String, Object> body);

    /** 删除作品（仅作者；被橱窗/商品/资源池引用时 400 WORK_IN_USE），返回 {deleted,id}。 */
    Map<String, Object> remove(Integer userId, int workId);

    /** 作品详情：作品字段 + {inPool,pool,product}。 */
    Map<String, Object> detail(int workId);
}
