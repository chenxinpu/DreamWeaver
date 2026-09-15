package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.Errors;
import dreamweaver.common.RequestContext;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.service.AdminService;
import dreamweaver.service.AuthService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * admin / dev 路由：演示账号列表、审核员强制审核、数据重置、演示热度加速，
 * 逐行等价于 {@code apps/server/src/routes/admin.ts}。
 *
 * <p>控制层只做：参数解析 + 角色守卫 + 调 service + 包 {@code ApiResponse}；
 * 业务逻辑全部在 {@link AdminService}。
 */
@RestController
@RequestMapping("/api")
public class AdminController {

    private final AuthService auth;
    private final AdminService adminService;

    public AdminController(AuthService auth, AdminService adminService) {
        this.auth = auth;
        this.adminService = adminService;
    }

    /** 等价原实现 staffOnly(uid)：非 auditor/admin 一律 403「仅审核员/管理员可操作」 */
    private void staffOnly(int uid) {
        User u = auth.userOf(uid);
        if (u == null || (u.role != Role.AUDITOR && u.role != Role.ADMIN)) {
            throw Errors.deny("仅审核员/管理员可操作");
        }
    }

    @GetMapping("/admin/users")
    public ApiResponse users(@RequestParam(required = false) String role) {
        return ApiResponse.ok(adminService.users(role));
    }

    /** 审核员强制审核（覆盖演示结论） */
    @PostMapping("/admin/window/{id}/force")
    public ApiResponse forceWindow(@PathVariable("id") long id,
                                   @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        staffOnly(uid);
        return ApiResponse.ok(adminService.forceWindow(id, body));
    }

    /** 重置数据（重新 seed） */
    @PostMapping("/dev/reset")
    public ApiResponse reset(@RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        staffOnly(uid);
        return ApiResponse.ok(adminService.reset(body));
    }

    @GetMapping("/dev/info")
    public ApiResponse devInfo() {
        return ApiResponse.ok(adminService.devInfo());
    }

    /** dev 演示：把某篇推文的热度提升到指定点赞数并立即重跑当日资源池评估 */
    @PostMapping("/dev/surge-likes")
    public ApiResponse surgeLikes(@RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(adminService.surgeLikes(uid, body));
    }
}
