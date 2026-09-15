package dreamweaver.service;

import java.util.Map;

/**
 * 创作者平台业务（工作台总览 / BI 看板 / 佣金 / 图序列），
 * 逐行等价于 {@code apps/server/src/routes/creator.ts}。
 *
 * <p>角色守卫（「仅创作者可访问创作者平台」）由控制层负责，本层只接收已鉴权的 {@code uid}。
 */
public interface CreatorService {

    /** 工作台总览。 */
    Map<String, Object> overview(int uid);

    /** BI 看板（days 会被裁剪到 7~90，productId 需属于当前创作者）。 */
    Map<String, Object> dashboard(int uid, String days, String productId);

    /** 佣金汇总（进入前先做一次幂等到期结算，等价原实现「演示即时结算」）。 */
    Map<String, Object> commission(int uid);

    /** 单品佣金率（含逐条 breaks/reasons）；productId 为空/0 时返回该创作者在售商品列表。 */
    Map<String, Object> commissionRate(int uid, String productId);

    /** 提现。 */
    Map<String, Object> withdraw(int uid, Map<String, Object> body);

    /** 图序列。 */
    Map<String, Object> series(int uid, String days, String metric, String productId);
}
