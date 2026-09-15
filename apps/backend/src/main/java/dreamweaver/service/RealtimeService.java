package dreamweaver.service;

import dreamweaver.entity.Order;
import dreamweaver.entity.Post;

/**
 * 实时通信业务：把领域事件投递到 WebSocket 房间（order:&lt;id&gt; / user:&lt;id&gt; / post:&lt;id&gt;）。
 * 旁路能力，失败不得影响业务主流程。
 */
public interface RealtimeService {

    void publishOrderStatus(Order order);

    void publishUserNotification(int userId, Object payload);

    void publishPostInteraction(Post post, String event);
}
