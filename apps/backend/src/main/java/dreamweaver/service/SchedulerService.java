package dreamweaver.service;

/**
 * 定时任务业务（每日 00:05 东八区），逐行等价于 {@code apps/server/src/engine/scheduler.ts}：
 *
 * <ol>
 *   <li>资源池自动评估当日推文（§3.1）</li>
 *   <li>待审橱窗（submitted）自动审核（模拟 24h 内出结果）</li>
 *   <li>佣金 T+7 结算 + 订单自动完成</li>
 * </ol>
 */
public interface SchedulerService {

    /** 执行每日任务（三段独立 try/catch，互不影响）。 */
    void runDaily();
}
