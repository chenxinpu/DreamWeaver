package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.PoolService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * pool 资源池路由 + dev eval（对应 apps/server/src/routes/pool.ts）。
 *
 * <p>说明：{@code /creator/pool} 需要 DTO 化的筛选/分页结果，该能力已声明在
 * {@link PoolService} 契约上（{@code creatorPool} / {@code evalPoolResponse}），
 * 故这里按接口注入；调用方向仍是 controller → service。
 */
@RestController
@RequestMapping("/api")
public class PoolController {

    private final PoolService poolService;

    public PoolController(PoolService poolService) {
        this.poolService = poolService;
    }

    /** 当前创作者池（含每条的 作品/推文/达标明细） */
    @GetMapping("/creator/pool")
    public ApiResponse creatorPool(@RequestParam(required = false) String page,
                                   @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(poolService.creatorPool(RequestContext.requireUserId(), page, pageSize));
    }

    /** 手动触发评估 */
    @PostMapping("/dev/eval-pool")
    public ApiResponse evalPool() {
        return ApiResponse.ok(poolService.evalPoolResponse(RequestContext.currentUserId()));
    }

    @GetMapping("/pool/meta")
    public ApiResponse poolMeta() {
        return ApiResponse.ok(poolService.poolMeta());
    }
}
