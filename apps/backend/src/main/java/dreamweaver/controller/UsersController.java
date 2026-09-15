package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** users 路由：公开资料 + 创作者聚合（对应 apps/server/src/routes/users.ts）。 */
@RestController
@RequestMapping("/api")
public class UsersController {

    private final UserService users;

    public UsersController(UserService users) {
        this.users = users;
    }

    @GetMapping("/users/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        return ApiResponse.ok(users.detail((int) id));
    }
}
