package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.Order;
import dreamweaver.entity.Post;
import dreamweaver.realtime.RoomRegistry;
import dreamweaver.service.RealtimeService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 实时通信业务实现（原 {@code service.impl.RealtimePublisher}）：把领域事件投递到进程内 WebSocket 实时层。
 *
 * <p><b>架构变更（原为 HTTP 投递到 Node 网关）</b>：{@code apps/gateway} 已删除，
 * WebSocket 长连接网关由本服务（Java 后端，同端口 8787、路径 {@code /ws}）承担，
 * 因此这里不再 {@code POST /internal/publish}，而是<b>直接调用进程内的 {@link RoomRegistry} 广播</b>。
 * {@code POST /internal/publish} 仍然保留（见 {@code controller.InternalController}），
 * 供外部进程/脚本注入事件用，语义与调用 {@link RoomRegistry} 完全一致。
 *
 * <p>推送是「尽力而为」的旁路能力：广播内部逐连接 try/catch，
 * <b>单连接异常不影响其它订阅者，也绝不影响业务主流程</b>（异常只记日志）。
 *
 * <p>topic 约定：
 * <ul>
 *   <li>{@code order:<orderId>} —— 订单状态流转推送</li>
 *   <li>{@code user:<userId>} —— 个人通知推送（与站内通知同源，调用方为 NotifyService）</li>
 *   <li>{@code post:<postId>} —— 推文互动实时计数</li>
 *   <li>{@code live:<room>} —— 直播弹幕（由客户端直接经 /ws 广播）</li>
 * </ul>
 *
 * <p>依赖方向：{@code NotifyService → RealtimeService → RoomRegistry}，
 * 而 {@link RoomRegistry} 不依赖任何 service，因此<b>不存在构造器循环依赖</b>。
 * 本类只依赖实时基础设施，不依赖任何其它业务 service，保证依赖图不成环。
 */
@Service
public class RealtimeServiceImpl implements RealtimeService {

    private static final Logger log = LoggerFactory.getLogger(RealtimeServiceImpl.class);

    private final RoomRegistry rooms;

    public RealtimeServiceImpl(RoomRegistry rooms) {
        this.rooms = rooms;
    }

    /** 投递一个领域事件到指定 topic（进程内广播，不阻塞业务、不抛错）。 */
    @Override
    public void publishOrderStatus(Order o) {
        if (o == null) return;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderId", o.id);
        data.put("no", o.no);
        data.put("status", o.status == null ? null : o.status.value());
        data.put("buyerId", o.buyerId);
        data.put("creatorId", o.creatorId);
        data.put("productId", o.productId);
        data.put("productTitle", o.productTitle);
        data.put("stage", o.stage);
        data.put("at", TimeUtil.nowIso());
        publish("order:" + o.id, "status", data);
    }

    /** 个人通知推送：user:<id> → 事件 notification。 */
    @Override
    public void publishUserNotification(int userId, Object notification) {
        publish("user:" + userId, "notification", notification);
    }

    /** 推文互动推送：post:<id> → 事件由调用方指定（like/comment/share…）。 */
    @Override
    public void publishPostInteraction(Post p, String event) {
        if (p == null) return;
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("postId", p.id);
        data.put("likes", p.likes);
        data.put("commentCount", p.commentCount);
        data.put("shareCount", p.shareCount);
        publish("post:" + p.id, event, data);
    }

    /** 底层广播：实时通道是旁路能力，广播异常静默降级、仅 debug 记录，绝不影响业务主流程。 */
    private void publish(String topic, String event, Object data) {
        try {
            int delivered = rooms.broadcast(topic, event, data);
            if (log.isDebugEnabled()) {
                log.debug("[realtime] 领域事件已广播 topic={} event={} delivered={}", topic, event, delivered);
            }
        } catch (Exception e) {
            log.debug("[realtime] 广播失败（已忽略）：topic={} error={}", topic,
                    MiscUtil.toStr(e.getMessage(), "未知错误"));
        }
    }
}
