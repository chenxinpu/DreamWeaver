package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.service.HealthService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 聚合健康检查 {@code GET /api/health}（公开）。
 *
 * <p><b>在进程内聚合，替代原 apps/gateway 的聚合健康</b>（原 Node 网关已删除，其
 * {@code bff/health.ts} 是唯一契约来源）。控制层只做「调 service + 包响应」，
 * 实体统计与 AI 探活全部下沉到 {@link HealthService}。
 *
 * <ul>
 *   <li>后端自身**永远** {@code ok:true}（它是被检查对象，不是依赖）；</li>
 *   <li>Python AI 不可用只把 {@code services[ai].ok} 置 false，<b>不影响整体 {@code ok:true}</b>；</li>
 *   <li>{@code entities} 由各 repository 的 {@code count()} 统计（在 service 层完成）；</li>
 *   <li>{@code time} 为带本地偏移（东八区 {@code +08:00}）的 ISO 时间；</li>
 *   <li>响应同时兼容前端 {@code api.dev.health()}（{@code {ok:true,data}}）。</li>
 * </ul>
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    private final HealthService healthService;

    public HealthController(HealthService healthService) {
        this.healthService = healthService;
    }

    @GetMapping("/health")
    public ApiResponse health() {
        return ApiResponse.ok(healthService.health());
    }
}
