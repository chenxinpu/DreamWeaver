package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.NotificationService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * notifications 路由，逐行等价于 {@code apps/server/src/routes/notifications.ts}。
 */
@RestController
@RequestMapping("/api")
public class NotificationsController {

    private final NotificationService notifications;

    public NotificationsController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping("/notifications")
    public ApiResponse list(@RequestParam(required = false) String unread,
                            @RequestParam(required = false) String type,
                            @RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(notifications.list(RequestContext.requireUserId(), unread, type, page, pageSize));
    }

    @PostMapping("/notifications/read")
    public ApiResponse read(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(notifications.markRead(RequestContext.requireUserId(), body));
    }
}
