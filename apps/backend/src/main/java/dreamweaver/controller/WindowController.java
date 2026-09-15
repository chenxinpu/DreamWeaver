package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.WindowService;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * window 橱窗材料路由（创作者）—— 对应原 {@code apps/server/src/routes/window.ts}。
 *
 * <p>只做参数解析 + 调 service + 包 {@link ApiResponse}；完整性审核、请求体解析、
 * 默认定价、归属校验等业务规则全部在 {@code service.impl.WindowServiceImpl}。
 */
@RestController
@RequestMapping("/api")
public class WindowController {

    private final WindowService windowService;

    public WindowController(WindowService windowService) {
        this.windowService = windowService;
    }

    /* --------------------------------- 路由 --------------------------------- */

    /** 我的橱窗材料列表（可按状态过滤，按 updatedAt 倒序）。 */
    @GetMapping("/creator/window")
    public ApiResponse list(@RequestParam(required = false) String status) {
        return ApiResponse.ok(windowService.list(RequestContext.requireUserId(), status));
    }

    /** 新建橱窗材料（action=submit 时当场审核）。 */
    @PostMapping("/creator/window")
    public ApiResponse create(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(windowService.create(RequestContext.requireUserId(), body));
    }

    /** 草稿更新 / 被拒后修改重提。 */
    @PatchMapping("/creator/window/{id}")
    public ApiResponse update(@PathVariable("id") long id,
                              @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(windowService.update(RequestContext.requireUserId(), (int) id, body));
    }

    /** 提交审核。 */
    @PostMapping("/creator/window/{id}/submit")
    public ApiResponse submit(@PathVariable("id") long id) {
        return ApiResponse.ok(windowService.submit(RequestContext.requireUserId(), (int) id));
    }

    /** 删除橱窗材料（仅草稿 / 被拒状态可删；审核中、已通过需先处理关联商品）。 */
    @DeleteMapping("/creator/window/{id}")
    public ApiResponse remove(@PathVariable("id") long id) {
        return ApiResponse.ok(windowService.remove(RequestContext.requireUserId(), (int) id));
    }

    /** 橱窗材料详情（创作者本人 / 审核员 / 管理员）。 */
    @GetMapping("/creator/window/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        return ApiResponse.ok(windowService.detail(RequestContext.requireUserId(), (int) id));
    }
}
