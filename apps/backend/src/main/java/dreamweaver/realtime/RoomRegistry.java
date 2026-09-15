package dreamweaver.realtime;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * 房间（topic）注册表与广播——<b>等价于原 {@code apps/gateway/src/realtime/rooms.ts}</b>。
 *
 * <p>topic 命名约定（注册表本身不解释语义，由调用方拼装）：
 * <ul>
 *   <li>{@code order:<orderId>} —— 订单状态推送</li>
 *   <li>{@code post:<postId>} —— 推文互动 / 资源池事件</li>
 *   <li>{@code user:<userId>} —— 个人通知</li>
 *   <li>{@code live:<roomId>} —— 直播间（弹幕）</li>
 *   <li>{@code im:<min>-<max>} —— 一对一会话（两个 userId 升序拼接，保证双方订阅同一房间）</li>
 * </ul>
 *
 * <p>线程安全：peers / rooms 均为 {@link ConcurrentHashMap}，每连接的 topic 集合为
 * {@link ConcurrentHashMap#newKeySet()}；向下发送时使用
 * {@link org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator}
 * 包装后的 session（见 {@link RealtimeHandler}），因此任意业务线程（含定时任务、HTTP 线程）都可安全广播。
 */
@Component
public class RoomRegistry {

    private static final Logger log = LoggerFactory.getLogger(RoomRegistry.class);

    private final ObjectMapper json;

    /** peerId → 连接 */
    private final Map<String, Peer> peers = new ConcurrentHashMap<>();
    /** topic → peerId 集合 */
    private final Map<String, Set<String>> rooms = new ConcurrentHashMap<>();

    public RoomRegistry(ObjectMapper json) {
        this.json = json;
    }

    /* ------------------------------ 连接对象 ------------------------------ */

    /** 一个 WebSocket 连接（等价原实现里的 {@code RealtimePeer}）。 */
    public static final class Peer {

        private final String id;
        private final WebSocketSession session;
        private final Set<String> topics = ConcurrentHashMap.newKeySet();
        /** 已解析出的用户 id（本进程内直接问 AuthService，不再走 HTTP 内省） */
        private volatile Integer userId;

        Peer(String id, WebSocketSession session, Integer userId) {
            this.id = id;
            this.session = session;
            this.userId = userId;
        }

        public String id() {
            return id;
        }

        public WebSocketSession session() {
            return session;
        }

        public Set<String> topics() {
            return topics;
        }

        public Integer userId() {
            return userId;
        }

        void userId(Integer userId) {
            this.userId = userId;
        }
    }

    /** 订阅结果：accepted = 实际新增的 topic（去重后），rejected = 超出上限被拒的 topic。 */
    public record SubscribeResult(List<String> accepted, List<String> rejected) {
    }

    /* ------------------------------ 生命周期 ------------------------------ */

    /** 注册新连接，返回其 peer 句柄。 */
    public Peer register(WebSocketSession session, Integer userId) {
        Peer peer = new Peer(UUID.randomUUID().toString(), session, userId);
        peers.put(peer.id, peer);
        return peer;
    }

    /** 断开清理：退订全部房间并移除连接。 */
    public void remove(Peer peer) {
        if (peer == null) return;
        for (String topic : List.copyOf(peer.topics)) detach(peer, topic);
        peers.remove(peer.id);
    }

    private void detach(Peer peer, String topic) {
        peer.topics.remove(topic);
        Set<String> members = rooms.get(topic);
        if (members == null) return;
        members.remove(peer.id);
        if (members.isEmpty()) rooms.remove(topic, members);
    }

    /* ------------------------------ 订阅 / 退订 ------------------------------ */

    /**
     * 订阅房间。
     *
     * @param requested  客户端请求的 topic（自动 trim / 去空）
     * @param maxTopics  单连接订阅上限（原 {@code DW_WS_MAX_TOPICS}，默认 200）
     */
    public SubscribeResult subscribe(Peer peer, List<String> requested, int maxTopics) {
        List<String> accepted = new ArrayList<>();
        List<String> rejected = new ArrayList<>();
        for (String raw : requested) {
            String topic = raw == null ? "" : raw.trim();
            if (topic.isEmpty()) continue;
            if (peer.topics.contains(topic)) continue;          // 重复订阅同一 topic 只保留一份
            if (peer.topics.size() >= maxTopics) {              // 超出上限 → rejected
                rejected.add(topic);
                continue;
            }
            peer.topics.add(topic);
            rooms.computeIfAbsent(topic, k -> ConcurrentHashMap.newKeySet()).add(peer.id);
            accepted.add(topic);
        }
        if (!rejected.isEmpty()) {
            log.warn("[realtime] 订阅被拒绝（超出单连接上限 {}）：peerId={} rejected={}", maxTopics, peer.id(), rejected);
        }
        return new SubscribeResult(accepted, rejected);
    }

    /** 退订房间，返回实际被移除的 topic。 */
    public List<String> unsubscribe(Peer peer, List<String> requested) {
        List<String> removed = new ArrayList<>();
        for (String raw : requested) {
            String topic = raw == null ? "" : raw.trim();
            if (topic.isEmpty() || !peer.topics.contains(topic)) continue;
            detach(peer, topic);
            removed.add(topic);
        }
        return removed;
    }

    /** 某 topic 的订阅者（快照）。 */
    public List<Peer> subscribers(String topic) {
        Set<String> members = rooms.get(topic);
        if (members == null || members.isEmpty()) return List.of();
        List<Peer> out = new ArrayList<>(members.size());
        for (String id : List.copyOf(members)) {
            Peer peer = peers.get(id);
            if (peer != null) out.add(peer);
        }
        return out;
    }

    /* ------------------------------ 发送 / 广播 ------------------------------ */

    /**
     * 单连接定向发送（协议控制帧：welcome/subscribed/pong/error/im.ack 等）。
     *
     * @return 是否投递成功；失败仅记日志，<b>绝不抛出</b>（实时通道是旁路能力）
     */
    public boolean send(Peer peer, Map<String, Object> frame) {
        if (peer == null) return false;
        WebSocketSession session = peer.session();
        if (session == null || !session.isOpen()) return false;
        try {
            session.sendMessage(new TextMessage(serialize(frame)));
            return true;
        } catch (Exception e) {
            log.warn("[realtime] 发送失败（忽略该连接）：peerId={} error={}", peer.id(), e.getMessage());
            return false;
        }
    }

    /** 统一错误帧 {@code {"type":"error","code":…,"msg":…,"ts":…}} */
    public void sendError(Peer peer, String code, String msg) {
        Map<String, Object> frame = new LinkedHashMap<>();
        frame.put("type", "error");
        frame.put("code", code);
        frame.put("msg", msg);
        frame.put("ts", System.currentTimeMillis());
        send(peer, frame);
    }

    /**
     * 广播：向订阅了该 topic 的所有连接推送统一帧 {@code {topic,event,data,ts}}。
     *
     * <p>逐连接 try/catch：单个连接异常不影响其它订阅者；返回成功投递数（等价原实现的 {@code delivered}）。
     */
    public int broadcast(String topic, String event, Object data) {
        List<Peer> targets = subscribers(topic);
        if (targets.isEmpty()) return 0;
        String payload;
        try {
            Map<String, Object> frame = new LinkedHashMap<>();
            frame.put("topic", topic);
            frame.put("event", event);
            frame.put("data", data);
            frame.put("ts", System.currentTimeMillis());
            payload = serialize(frame);
        } catch (Exception e) {
            log.warn("[realtime] 广播帧序列化失败：topic={} event={} error={}", topic, event, e.getMessage());
            return 0;
        }
        int delivered = 0;
        for (Peer peer : targets) {
            if (sendText(peer, payload)) delivered++;
        }
        if (log.isDebugEnabled()) {
            log.debug("[realtime] 广播 topic={} event={} delivered={}", topic, event, delivered);
        }
        return delivered;
    }

    private boolean sendText(Peer peer, String payload) {
        WebSocketSession session = peer.session();
        if (session == null || !session.isOpen()) return false;
        try {
            session.sendMessage(new TextMessage(payload));
            return true;
        } catch (Exception e) {
            log.warn("[realtime] 广播投递失败（忽略该连接）：peerId={} error={}", peer.id(), e.getMessage());
            return false;
        }
    }

    private String serialize(Map<String, Object> frame) throws Exception {
        return json.writeValueAsString(frame);
    }

    /* ------------------------------ 统计 / 关闭 ------------------------------ */

    /** 统计（等价原 {@code RoomRegistry.stats()}，供 {@code GET /internal/stats} 返回）。 */
    public Map<String, Object> stats() {
        Map<String, Object> subscriptions = new LinkedHashMap<>();
        rooms.forEach((topic, members) -> {
            if (!members.isEmpty()) subscriptions.put(topic, members.size());
        });
        List<Map<String, Object>> peerList = new ArrayList<>();
        peers.values().stream()
                .sorted(Comparator.comparing(Peer::id))
                .forEach(p -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", p.id());
                    item.put("userId", p.userId());
                    List<String> topics = new ArrayList<>(p.topics());
                    topics.sort(Comparator.naturalOrder());
                    item.put("topics", topics);
                    peerList.add(item);
                });
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("connections", peers.size());
        out.put("rooms", subscriptions.size());
        out.put("subscriptions", subscriptions);
        out.put("peers", peerList);
        return out;
    }

    public int connections() {
        return peers.size();
    }

    /** 关闭全部连接并清空房间表（优雅退出用）。 */
    public void closeAll(int code, String reason) {
        for (Peer peer : List.copyOf(peers.values())) {
            try {
                WebSocketSession session = peer.session();
                if (session != null && session.isOpen()) {
                    session.close(new org.springframework.web.socket.CloseStatus(code, reason));
                }
            } catch (Exception e) {
                log.debug("[realtime] 关闭连接失败（忽略）：peerId={} error={}", peer.id(), e.getMessage());
            }
        }
        peers.clear();
        rooms.clear();
    }
}
