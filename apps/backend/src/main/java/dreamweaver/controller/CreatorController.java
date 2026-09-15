package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.Errors;
import dreamweaver.common.RequestContext;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.service.AuthService;
import dreamweaver.service.CreatorService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 创作者平台：工作台/看板/佣金，逐行等价于 {@code apps/server/src/routes/creator.ts}。
 *
 * <p>控制层只做：参数解析 + 角色守卫 + 调 service + 包 {@code ApiResponse}；
 * 业务逻辑全部在 {@link CreatorService}。
 */
@RestController
@RequestMapping("/api")
public class CreatorController {

    private final AuthService auth;
    private final CreatorService creatorService;

    public CreatorController(AuthService auth, CreatorService creatorService) {
        this.auth = auth;
        this.creatorService = creatorService;
    }

    /** 等价原实现 requireCreator(uid)：非 creator 一律 403「仅创作者可访问创作者平台」 */
    private void requireCreator(int uid) {
        User u = auth.userOf(uid);
        if (u == null || u.role != Role.CREATOR) throw Errors.deny("仅创作者可访问创作者平台");
    }

    /** 工作台总览 */
    @GetMapping("/creator/overview")
    public ApiResponse overview() {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.overview(uid));
    }

    /** BI 看板 */
    @GetMapping("/creator/dashboard")
    public ApiResponse dashboard(@RequestParam(required = false) String days,
                                 @RequestParam(required = false) String productId) {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.dashboard(uid, days, productId));
    }

    /** 佣金汇总 */
    @GetMapping("/creator/commission")
    public ApiResponse commission() {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.commission(uid));
    }

    /** 单品佣金率（含逐条 breaks/reasons） */
    @GetMapping("/creator/commission/rate")
    public ApiResponse commissionRate(@RequestParam(required = false) String productId) {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.commissionRate(uid, productId));
    }

    /** 提现 */
    @PostMapping("/creator/commission/withdraw")
    public ApiResponse withdraw(@RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.withdraw(uid, body));
    }

    /** 图序列 */
    @GetMapping("/creator/bi/series")
    public ApiResponse series(@RequestParam(required = false) String days,
                              @RequestParam(required = false) String metric,
                              @RequestParam(required = false) String productId) {
        int uid = RequestContext.requireUserId();
        requireCreator(uid);
        return ApiResponse.ok(creatorService.series(uid, days, metric, productId));
    }
}
