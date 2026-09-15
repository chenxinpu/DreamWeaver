package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.ResaleService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * resale 二手集市路由（对应 {@code apps/server/src/routes/resale.ts}）。
 *
 * <p>控制层只做「取当前用户 → 调 service → 包 {@code ApiResponse}」；挂单过滤/分页、
 * {@code toDTO}（原价反推 + netEstimate）、卖家权限与改价校验全部下沉到 {@link ResaleService}。
 */
@RestController
@RequestMapping("/api")
public class ResaleController {

    private final ResaleService resaleService;

    public ResaleController(ResaleService resaleService) {
        this.resaleService = resaleService;
    }

    /* ------------------------------ 集市列表 ------------------------------ */

    @GetMapping("/mall/resale")
    public ApiResponse mall(@RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(resaleService.mall(page, pageSize));
    }

    /* ------------------------------ 我的挂单 ------------------------------ */

    @GetMapping("/resale/mine")
    public ApiResponse mine(@RequestParam(required = false) String status,
                            @RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(resaleService.mine(uid, status, page, pageSize));
    }

    /* -------------------------------- 购买 -------------------------------- */

    @PostMapping("/resale/{id}/buy")
    public ApiResponse buy(@PathVariable("id") long id) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(resaleService.buy(uid, (int) id));
    }

    /* -------------------------------- 改价 -------------------------------- */

    /** 卖家降价（只许 ≤） */
    @PatchMapping("/resale/{id}/price")
    public ApiResponse price(@PathVariable("id") long id,
                             @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(resaleService.changePrice(uid, (int) id, body));
    }

    /* ------------------------------ 取消上架 ------------------------------ */

    @PostMapping("/resale/{id}/cancel")
    public ApiResponse cancel(@PathVariable("id") long id,
                              @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(resaleService.cancel(uid, (int) id, body));
    }
}
