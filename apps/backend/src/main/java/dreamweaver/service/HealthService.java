package dreamweaver.service;

import java.util.Map;

/**
 * 聚合健康检查业务：汇总本进程状态、Python AI 依赖状态与各实体计数。
 *
 * <p>契约（与改造前 {@code controller.HealthController} 逐字段一致）：
 * {@code {status,version,port,time(+08:00),services:[{name:"backend",ok:true,…},{name:"ai",ok:…,…}],entities:{…}}}。
 * AI 不可用只影响 {@code services[ai].ok}，<b>不影响整体 {@code ok:true}</b>——backend 是被检查对象，不是依赖。
 */
public interface HealthService {

    /** 与 {@code /api/health} 一致的版本号（供 {@code GET /} 自述复用）。 */
    String version();

    /** 聚合健康数据（不含 {@code ApiResponse} 包装，包装由控制层负责）。 */
    Map<String, Object> health();
}
