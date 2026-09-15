package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.RequestContext;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.User;
import dreamweaver.service.AuthService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * auth 路由：login / switch / me / me/body（对应 apps/server/src/routes/auth.ts）。
 * 只做参数解析 + 调 service + 包响应。
 */
@RestController
@RequestMapping("/api")
public class AuthController {

    private final DtoMapper dto;
    private final AuthService auth;

    public AuthController(DtoMapper dto, AuthService auth) {
        this.dto = dto;
        this.auth = auth;
    }

    /* ------------------------------- 路由 ------------------------------- */

    @PostMapping("/auth/login")
    public ApiResponse login(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(auth.login(bodyUserId(body)));
    }

    @PostMapping("/auth/switch")
    public ApiResponse switchUser(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(auth.login(bodyUserId(body)));
    }

    @GetMapping("/me")
    public ApiResponse me() {
        return ApiResponse.ok(auth.meAggregate(RequestContext.requireUserId()));
    }

    /** 保存体型数据（手动 12 项 / AI 量体结果） */
    @PostMapping("/me/body")
    public ApiResponse saveBody(@RequestBody(required = false) Map<String, Object> body) {
        User user = auth.updateBody(RequestContext.requireUserId(), body);
        return ApiResponse.ok(Map.of("user", dto.toUserPublic(user)));
    }

    /* ------------------------------ 参数解析 ------------------------------ */

    /** 等价于 TS 的 `const userId = Number(req.body?.userId); if (!userId) bad('BAD_REQUEST','请传 userId')` */
    private static int bodyUserId(Map<String, Object> body) {
        Object raw = body == null ? null : body.get("userId");
        Integer userId;
        if (raw instanceof Boolean b) {
            userId = b ? 1 : 0;                 // JS Number(true) === 1 / Number(false) === 0
        } else {
            userId = MiscUtil.toIntOrNull(raw); // 无法解析（NaN）→ null
        }
        if (userId == null || userId == 0) throw Errors.bad("BAD_REQUEST", "请传 userId");
        return userId;
    }
}
