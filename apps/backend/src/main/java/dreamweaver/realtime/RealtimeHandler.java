package dreamweaver.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dreamweaver.common.MiscUtil;
import dreamweaver.service.AuthService;
import dreamweaver.realtime.DanmakuService;
import dreamweaver.realtime.ImService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.PingMessage;
import org.springframework.web.socket.PongMessage;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * {@code /ws} WebSocket 处理器——<b>等价于原 {@code apps/gateway/src/realtime/server.ts}</b>。
 *
 * <p>原生 {@link TextWebSocketHandler}（不使用 STOMP/SockJS），JSON 文本帧协议：
 * <ul>
 *   <li>客户端 → 服务端：{@code subscribe / unsubscribe / ping / pong / danmaku.send / im.send}</li>
 *   <li>服务端 → 客户端：{@code welcome / subscribed / unsubscribed / pong / ping / im.ack / error}
 *       ＋统一广播帧 {@code {topic,event,data,ts}}</li>
 * </ul>
 *
 * <p>连接管理：
 * <ul>
 *   <li>建立连接即发 {@code welcome} 帧（含 peerId、心跳参数）；</li>
 *   <li>身份：{@code ?token=<access token>} 经 {@link AuthService#userIdOf} 解析，
 *       失败则用 {@code ?userId=} 兜底，再失败允许 {@code subscribe} 帧里的 {@code userId} 自述；</li>
 *   <li>心跳：每 {@code dw.ws.ping-interval-ms}（默认 30s）主动发 JSON {@code ping} 帧 + WS 协议 ping 帧；
 *       {@code dw.ws.pong-timeout-ms}（默认 60s）内没有任何入站帧则断开；</li>
 *   <li>断开时清理该连接的全部订阅。</li>
 * </ul>
 */
@Component
public class RealtimeHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RealtimeHandler.class);

    /** 单次发送上限与写缓冲上限（超出即关闭该连接，避免慢连接拖垮广播线程） */
    private static final int SEND_TIME_LIMIT_MS = 5_000;
    private static final int BUFFER_SIZE_LIMIT = 512 * 1024;

    private static final String SUPPORTED_TYPES =
            "subscribe/unsubscribe/ping/pong/danmaku.send/im.send";

    private final RoomRegistry rooms;
    private final ImService imService;
    private final DanmakuService danmakuService;
    private final AuthService authService;
    private final ObjectMapper json;

    /** sessionId → 连接状态 */
    private final Map<String, Conn> conns = new ConcurrentHashMap<>();

    @Value("${dw.ws.path:/ws}")
    private String wsPath = "/ws";

    @Value("${dw.ws.ping-interval-ms:30000}")
    private long pingIntervalMs = 30_000L;

    @Value("${dw.ws.pong-timeout-ms:60000}")
    private long pongTimeoutMs = 60_000L;

    @Value("${dw.ws.max-topics:200}")
    private int maxTopics = 200;

    private ScheduledExecutorService heartbeat;

    public RealtimeHandler(RoomRegistry rooms, ImService imService, DanmakuService danmakuService,
                           AuthService authService, ObjectMapper json) {
        this.rooms = rooms;
        this.imService = imService;
        this.danmakuService = danmakuService;
        this.authService = authService;
        this.json = json;
    }

    /** 连接状态：peer 句柄 + 最后收到任何入站帧的时间（心跳判定用）。 */
    private static final class Conn {
        private final RoomRegistry.Peer peer;
        private volatile long lastSeenAt;

        Conn(RoomRegistry.Peer peer) {
            this.peer = peer;
            this.lastSeenAt = System.currentTimeMillis();
        }
    }

    /* ------------------------------ 生命周期 ------------------------------ */

    @PostConstruct
    void startHeartbeat() {
        heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "dw-ws-heartbeat");
            t.setDaemon(true);
            return t;
        });
        heartbeat.scheduleWithFixedDelay(this::heartbeatTick, pingIntervalMs, pingIntervalMs, TimeUnit.MILLISECONDS);
        log.info("[realtime] WebSocket 实时层已就绪：path={} pingIntervalMs={} pongTimeoutMs={} maxTopics={}",
                wsPath, pingIntervalMs, pongTimeoutMs, maxTopics);
    }

    @PreDestroy
    void shutdown() {
        if (heartbeat != null) heartbeat.shutdownNow();
        rooms.closeAll(1001, "backend shutdown");
    }

    /* ------------------------------ 连接建立 / 关闭 ------------------------------ */

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        URI uri = session.getUri();
        String token = null;
        Integer queryUserId = null;
        if (uri != null) {
            MultiValueMap<String, String> params = UriComponentsBuilder.fromUri(uri).build().getQueryParams();
            token = params.getFirst("token");
            queryUserId = MiscUtil.toIntOrNull(params.getFirst("userId"));
        }
        // 身份解析：token 优先（复用既有鉴权逻辑，实时层不重复实现）；解析不到再用 ?userId= 兜底
        Integer userId = authService.userIdOf(token);
        if (userId == null) userId = queryUserId;

        // 广播线程与容器线程可能并发写同一连接 → 用装饰器串行化（超时/溢出即关闭该连接）
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT);
        RoomRegistry.Peer peer = rooms.register(safe, userId);
        conns.put(session.getId(), new Conn(peer));
        log.info("[realtime] ws 已连接：peerId={} connections={} hasToken={} userId={}",
                peer.id(), rooms.connections(), token != null && !token.isBlank(), userId);

        Map<String, Object> welcome = new LinkedHashMap<>();
        welcome.put("type", "welcome");
        welcome.put("peerId", peer.id());
        welcome.put("ts", System.currentTimeMillis());
        welcome.put("wsPath", wsPath);
        welcome.put("pingIntervalMs", pingIntervalMs);
        welcome.put("pongTimeoutMs", pongTimeoutMs);
        rooms.send(peer, welcome);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Conn conn = conns.remove(session.getId());
        if (conn == null) return;
        rooms.remove(conn.peer);
        log.info("[realtime] ws 已关闭：peerId={} code={} connections={}",
                conn.peer.id(), status == null ? null : status.getCode(), rooms.connections());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        Conn conn = conns.get(session.getId());
        log.warn("[realtime] ws 传输异常：peerId={} error={}",
                conn == null ? session.getId() : conn.peer.id(), exception.getMessage());
    }

    /* ------------------------------ 入站帧分发 ------------------------------ */

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Conn conn = conns.get(session.getId());
        if (conn == null) return;
        // 任何入站帧都刷新存活时间（等价原实现的 lastPongAt 语义）
        conn.lastSeenAt = System.currentTimeMillis();

        JsonNode frame;
        try {
            frame = json.readTree(message.getPayload());
        } catch (Exception e) {
            rooms.sendError(conn.peer, "INVALID_JSON", "消息必须是 JSON 文本帧");
            return;
        }
        if (frame == null || !frame.isObject()) {
            rooms.sendError(conn.peer, "INVALID_JSON", "消息必须是 JSON 对象");
            return;
        }
        try {
            dispatch(conn.peer, frame);
        } catch (Exception e) {
            log.error("[realtime] 帧处理异常：peerId={} error={}", conn.peer.id(), e.getMessage(), e);
            rooms.sendError(conn.peer, "INTERNAL", "消息处理异常");
        }
    }

    @Override
    protected void handlePongMessage(WebSocketSession session, PongMessage message) {
        Conn conn = conns.get(session.getId());
        if (conn != null) conn.lastSeenAt = System.currentTimeMillis();
    }

    private void dispatch(RoomRegistry.Peer peer, JsonNode frame) {
        String type = DanmakuService.text(frame.get("type"));
        switch (type) {
            case "subscribe" -> {
                List<String> requested = topicsOf(frame.get("topics"));
                // 身份兜底：token 未解析出身份时，允许客户端在 subscribe 帧里声明 userId
                if (peer.userId() == null) {
                    Integer declared = MiscUtil.toIntOrNull(frame.get("userId"));
                    if (declared != null) peer.userId(declared);
                }
                RoomRegistry.SubscribeResult result = rooms.subscribe(peer, requested, maxTopics);
                Map<String, Object> reply = new LinkedHashMap<>();
                reply.put("type", "subscribed");
                reply.put("topics", result.accepted());
                if (!result.rejected().isEmpty()) reply.put("rejected", result.rejected());
                reply.put("ts", System.currentTimeMillis());
                rooms.send(peer, reply);
            }
            case "unsubscribe" -> {
                List<String> removed = rooms.unsubscribe(peer, topicsOf(frame.get("topics")));
                Map<String, Object> reply = new LinkedHashMap<>();
                reply.put("type", "unsubscribed");
                reply.put("topics", removed);
                reply.put("ts", System.currentTimeMillis());
                rooms.send(peer, reply);
            }
            case "ping" -> {
                Map<String, Object> reply = new LinkedHashMap<>();
                reply.put("type", "pong");
                reply.put("ts", System.currentTimeMillis());
                JsonNode echo = frame.get("ts");
                if (echo != null && !echo.isNull()) reply.put("echo", echo);
                rooms.send(peer, reply);
            }
            case "pong" -> {
                // 存活时间已在方法入口刷新（任何入站帧都算存活）
            }
            case "danmaku.send" -> danmakuService.handleSend(peer, frame);
            case "im.send" -> imService.handleSend(peer, frame);
            default -> rooms.sendError(peer, "BAD_MESSAGE", "未知消息类型："
                    + (type.isEmpty() ? "(空)" : type) + "；支持 " + SUPPORTED_TYPES);
        }
    }

    /** 等价原实现的 normalizeTopics：仅接受数组，逐项 trim、去空、去重、截断到上限。 */
    private List<String> topicsOf(JsonNode raw) {
        List<String> out = new ArrayList<>();
        if (raw == null || !raw.isArray()) return out;
        for (JsonNode item : raw) {
            if (item == null || item.isNull()) continue;
            String topic = item.asText().trim();
            if (topic.isEmpty()) continue;
            out.add(topic);
            if (out.size() >= maxTopics) break;
        }
        return out;
    }

    /* ------------------------------ 心跳 ------------------------------ */

    private void heartbeatTick() {
        long now = System.currentTimeMillis();
        for (Conn conn : List.copyOf(conns.values())) {
            RoomRegistry.Peer peer = conn.peer;
            if (now - conn.lastSeenAt > pongTimeoutMs) {
                log.warn("[realtime] 心跳超时 → 断开连接：peerId={} idleMs={}", peer.id(), now - conn.lastSeenAt);
                closeQuietly(conn, new CloseStatus(1001, "heartbeat timeout"));
                continue;
            }
            Map<String, Object> ping = new LinkedHashMap<>();
            ping.put("type", "ping");
            ping.put("ts", now);
            rooms.send(peer, ping);
            try {
                peer.session().sendMessage(new PingMessage());   // 同时发 WS 协议 ping 帧
            } catch (Exception e) {
                log.debug("[realtime] 协议 ping 帧发送失败（忽略）：peerId={} error={}", peer.id(), e.getMessage());
            }
        }
    }

    private void closeQuietly(Conn conn, CloseStatus status) {
        try {
            WebSocketSession session = conn.peer.session();
            if (session != null && session.isOpen()) session.close(status);
        } catch (Exception e) {
            log.debug("[realtime] 关闭连接失败（忽略）：peerId={} error={}", conn.peer.id(), e.getMessage());
        } finally {
            // 兜底清理（正常情况下 afterConnectionClosed 也会执行，remove 幂等）
            conns.remove(conn.peer.session().getId());
            rooms.remove(conn.peer);
        }
    }
}
