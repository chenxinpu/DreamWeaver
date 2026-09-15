package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.CustomService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * custom 私人定制路由：context / adapt / chat / variant / preview
 * （对应 {@code apps/server/src/routes/custom.ts}）。
 *
 * <p>只做参数解析 + 调 service + 包 {@link ApiResponse}。
 *
 * <p><b>架构红线</b>：{@code /custom/chat} 的规则模板与 {@code /custom/variant} 的款式变体 SVG
 * 均由 Python AI 服务实现，本层只做结果透传；
 * AI 不可用时 {@code AiServiceClient} 抛出的 {@code ApiException(503,"AI_UNAVAILABLE")} 直接冒泡。
 */
@RestController
@RequestMapping("/api")
public class CustomController {

    private final CustomService customService;

    public CustomController(CustomService customService) {
        this.customService = customService;
    }

    /* ------------------------------- context ------------------------------- */

    @GetMapping("/custom/product/{id}/context")
    public ApiResponse context(@PathVariable("id") long id) {
        return ApiResponse.ok(customService.context(RequestContext.requireUserId(), (int) id));
    }

    /* -------------------------------- adapt -------------------------------- */

    /** 规格调整（核心算法 §3.4） */
    @PostMapping("/custom/adapt")
    public ApiResponse adapt(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(customService.adapt(body));
    }

    /* --------------------------------- chat --------------------------------- */

    /** AI 交互（规则模板由 Python AI 服务实现） */
    @PostMapping("/custom/chat")
    public ApiResponse chat(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(customService.chat(RequestContext.requireUserId(), body));
    }

    /* -------------------------------- variant -------------------------------- */

    /** 款式变体生成图（SVG 由 Python AI 服务实现） */
    @PostMapping("/custom/variant")
    public ApiResponse variant(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(customService.variant(body));
    }

    /* -------------------------------- preview -------------------------------- */

    /** 汇总调整后规格图预览 */
    @PostMapping("/custom/preview")
    public ApiResponse preview(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(customService.preview(body));
    }
}
