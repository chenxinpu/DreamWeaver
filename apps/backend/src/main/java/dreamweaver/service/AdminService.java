package dreamweaver.service;

import java.util.Map;

/**
 * 平台管理 / 演示运维业务（admin + dev 路由），
 * 逐行等价于 {@code apps/server/src/routes/admin.ts}。
 *
 * <p>角色守卫（审核员/管理员）由控制层负责，本层只接收已鉴权的参数。
 */
public interface AdminService {

    /** 演示账号列表（可按 role 过滤）。 */
    Map<String, Object> users(String role);

    /** 审核员强制审核（覆盖演示结论）。 */
    Map<String, Object> forceWindow(long id, Map<String, Object> body);

    /** 重置数据（重新 seed 或清空）。 */
    Map<String, Object> reset(Map<String, Object> body);

    /** 运行期实体统计。 */
    Map<String, Object> devInfo();

    /** 演示热度加速：把某篇推文点赞提升到指定值并立即重跑当日资源池评估。 */
    Map<String, Object> surgeLikes(int uid, Map<String, Object> body);
}
