package dreamweaver.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.realtime.RoomRegistry;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 即时聊天（IM）——<b>等价于原 {@code apps/gateway/src/realtime/im.ts}</b>。
 *
 * <p>本层只做房间投递与身份校验，<b>不落库、不做任何业务判定</b>：
 * <ul>
 *   <li>会话房间名 {@code im:<min>-<max>}（两个 userId 升序拼接，保证双方订阅同一房间）；</li>
 *   <li>身份来自连接（{@code /ws?token=<access token>} 经 {@code AuthService.userIdOf} 解析，
 *       或 {@code /ws?userId=} / subscribe 帧里的 {@code userId} 兜底）；</li>
 *   <li>解析不到身份 → 回 {@code error} 帧 {@code IM_NO_USER}。</li>
 * </ul>
 *
 * <p>协议：{@code {"type":"im.send","to":14,"content":"在吗"}}
 * → 发送方收 {@code im.ack}，会话房间内广播 {@code {"topic":"im:1-14","event":"message",…}}。
 */
@Component
public class ImService {

    private static final Logger log = LoggerFactory.getLogger(ImService.class);

    private final RoomRegistry rooms;

    public ImService(RoomRegistry rooms) {
        this.rooms = rooms;
    }

    /** 一对一会话房间名：两个 userId 升序拼接。 */
    public static String imTopic(int a, int b) {
        return "im:" + Math.min(a, b) + "-" + Math.max(a, b);
    }

    /** 处理一条私聊发送帧。 */
    public void handleSend(RoomRegistry.Peer peer, JsonNode frame) {
        Integer from = peer.userId();
        if (from == null) {
            rooms.sendError(peer, "IM_NO_USER",
                    "无法识别用户身份：请用 /ws?token=<access token> 连接，或在 subscribe 消息中带上 userId");
            return;
        }

        Integer to = MiscUtil.toIntOrNull(frame.get("to"));
        if (to == null || to <= 0) {
            rooms.sendError(peer, "BAD_MESSAGE", "im.send 需要合法的 to(userId)");
            return;
        }
        String content = DanmakuService.text(frame.get("content"));
        if (content.trim().isEmpty()) {
            rooms.sendError(peer, "BAD_MESSAGE", "im.send 需要非空 content");
            return;
        }

        String topic = imTopic(from, to);
        String at = TimeUtil.nowIso();

        // 1) 发送方回执
        Map<String, Object> ackData = new LinkedHashMap<>();
        ackData.put("topic", topic);
        ackData.put("from", from);
        ackData.put("to", to);
        ackData.put("content", content);
        ackData.put("at", at);
        Map<String, Object> ack = new LinkedHashMap<>();
        ack.put("type", "im.ack");
        ack.put("ts", System.currentTimeMillis());
        ack.put("data", ackData);
        rooms.send(peer, ack);

        // 2) 会话房间广播（发送方若订阅了该房间也会收到，与原实现一致）
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("from", from);
        data.put("to", to);
        data.put("content", content);
        data.put("at", at);
        int delivered = rooms.broadcast(topic, "message", data);
        if (log.isDebugEnabled()) {
            log.debug("[realtime] 私聊已投递 from={} to={} topic={} delivered={}", from, to, topic, delivered);
        }
    }
}
