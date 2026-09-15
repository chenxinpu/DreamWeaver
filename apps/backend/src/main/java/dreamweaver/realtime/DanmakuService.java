package dreamweaver.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import dreamweaver.common.TimeUtil;
import dreamweaver.realtime.RoomRegistry;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * 直播弹幕——<b>等价于原 {@code apps/gateway/src/realtime/danmaku.ts}</b>。
 *
 * <p>客户端帧：{@code {"type":"danmaku.send","room":"room1","content":"好看！"}}
 * <br>广播帧：{@code {"topic":"live:room1","event":"danmaku","data":{room,content,from,at},"ts":…}}
 *
 * <p>本层只做房间投递（身份可透传也可为 null）：<b>不做敏感词/风控等业务判定</b>，
 * 需要判定时由业务侧（Java 服务/AI）负责。
 */
@Component
public class DanmakuService {

    private static final Logger log = LoggerFactory.getLogger(DanmakuService.class);

    private final RoomRegistry rooms;

    public DanmakuService(RoomRegistry rooms) {
        this.rooms = rooms;
    }

    /** 直播间房间名：{@code live:<roomId>} */
    public static String liveTopic(String room) {
        return "live:" + room;
    }

    /** 处理一条弹幕发送帧。 */
    public void handleSend(RoomRegistry.Peer peer, JsonNode frame) {
        String room = text(frame.get("room")).trim();
        if (room.isEmpty()) {
            rooms.sendError(peer, "BAD_MESSAGE", "danmaku.send 需要 room");
            return;
        }
        String content = text(frame.get("content"));
        if (content.trim().isEmpty()) {
            rooms.sendError(peer, "BAD_MESSAGE", "danmaku.send 需要非空 content");
            return;
        }

        // 身份可选：已登录连接带上 userId，游客为 null（弹幕不要求登录）
        Integer from = peer.userId();
        String topic = liveTopic(room);
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("room", room);
        data.put("content", content);
        data.put("from", from);
        data.put("at", TimeUtil.nowIso());

        int delivered = rooms.broadcast(topic, "danmaku", data);
        if (log.isDebugEnabled()) {
            log.debug("[realtime] 弹幕已投递 room={} delivered={} from={}", room, delivered, from);
        }
    }

    /** 等价 JS 的 {@code String(v ?? '')}：缺失/null → 空串。 */
    public static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        if (node.isContainerNode()) return "";
        return node.asText();
    }
}
