package dreamweaver.controller;

import com.fasterxml.jackson.databind.JsonNode;
import dreamweaver.common.ApiResponse;
import dreamweaver.common.Errors;
import dreamweaver.realtime.RoomRegistry;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * 内部事件入口——<b>等价于原 {@code apps/gateway/src/realtime/events.ts}</b>。
 *
 * <pre>
 * POST /internal/publish  头 X-Internal-Token: &lt;dw.internal-token&gt;
 *      body {"topic":"order:12","event":"status","data":{"status":"producing","no":"ZM..."}}
 *      → 广播 {"topic":"order:12","event":"status","data":{...},"ts":...} 给订阅者
 *      → 响应 {"ok":true,"data":{"topics":["order:12"],"event":"status","delivered":{"order:12":2}}}
 * GET  /internal/stats    同样需要 token；返回 connections/rooms/subscriptions/peers
 * </pre>
 *
 * <p>两个接口都必须带 token，缺失或不匹配一律 <b>401</b>
 * {@code {"ok":false,"code":"UNAUTHORIZED","msg":"内部令牌校验失败：请检查 X-Internal-Token"}}
 * （常量时间比较，等价原实现的 {@code timingSafeEqual}）。
 * 本层<b>只做参数解析 + 广播 + 包响应</b>：不校验事件内容语义（由发布方负责），
 * 也不判断订单状态、不生成文案。
 *
 * <p>依赖说明：{@link RoomRegistry} 是 {@code realtime} 包内的实时通信基础设施（非 repository、非业务 service），
 * 广播与统计是它的直接能力，因此控制层直接调用它，不经过（也不需要在）业务 service 层再包一层。
 */
@RestController
public class InternalController {

    private static final Logger log = LoggerFactory.getLogger(InternalController.class);

    private static final String TOKEN_HEADER = "X-Internal-Token";
    private static final String TOKEN_FAIL_MSG = "内部令牌校验失败：请检查 X-Internal-Token";

    private final RoomRegistry rooms;

    @Value("${dw.internal-token:dw-internal-dev-token}")
    private String internalToken = "dw-internal-dev-token";

    public InternalController(RoomRegistry rooms) {
        this.rooms = rooms;
    }

    /* ------------------------------ 发布 ------------------------------ */

    @PostMapping("/internal/publish")
    public ApiResponse publish(@RequestHeader(value = TOKEN_HEADER, required = false) String token,
                               @RequestBody(required = false) JsonNode body) {
        requireToken(token);

        JsonNode payload = body != null && body.isObject() ? body : null;
        List<String> topics = collectTopics(payload);
        if (topics.isEmpty()) throw Errors.bad("BAD_REQUEST", "需要 topic（或 topics 数组）");
        String event = text(payload == null ? null : payload.get("event")).trim();
        if (event.isEmpty()) throw Errors.bad("BAD_REQUEST", "需要 event 名称");

        Map<String, Object> delivered = new LinkedHashMap<>();
        for (String topic : topics) {
            Object data = payload.has("data") ? payload.get("data") : null;
            delivered.put(topic, rooms.broadcast(topic, event, data));
        }
        log.info("[realtime] 内部事件广播：topics={} event={} delivered={}", topics, event, delivered);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("topics", topics);
        out.put("event", event);
        out.put("delivered", delivered);
        return ApiResponse.ok(out);
    }

    /* ------------------------------ 统计 ------------------------------ */

    @GetMapping("/internal/stats")
    public ApiResponse stats(@RequestHeader(value = TOKEN_HEADER, required = false) String token) {
        requireToken(token);
        return ApiResponse.ok(rooms.stats());
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 令牌校验失败 → 401 UNAUTHORIZED（缺 token 同样 401）。 */
    private void requireToken(String candidate) {
        if (candidate == null || candidate.isBlank() || internalToken == null) {
            log.warn("[realtime] 内部令牌校验失败（缺失）");
            throw Errors.unauthorized(TOKEN_FAIL_MSG);
        }
        boolean ok = MessageDigest.isEqual(
                candidate.getBytes(StandardCharsets.UTF_8),
                internalToken.getBytes(StandardCharsets.UTF_8));
        if (!ok) {
            log.warn("[realtime] 内部令牌校验失败（不匹配）");
            throw Errors.unauthorized(TOKEN_FAIL_MSG);
        }
    }

    /** 收集 topic：支持 {@code topic}（字符串）或 {@code topics}（数组），去重保序。 */
    private List<String> collectTopics(JsonNode body) {
        List<String> out = new ArrayList<>();
        if (body == null) return out;
        addTopic(out, body.get("topic"));
        JsonNode many = body.get("topics");
        if (many != null && many.isArray()) {
            for (JsonNode item : many) addTopic(out, item);
        }
        return out;
    }

    private void addTopic(List<String> out, JsonNode node) {
        String t = text(node).trim();
        if (!t.isEmpty() && !out.contains(t)) out.add(t);
    }

    /** 等价 JS 的 {@code String(v ?? '')}：缺失 / null / 容器节点 → 空串。 */
    private static String text(JsonNode node) {
        if (node == null || node.isMissingNode() || node.isNull()) return "";
        if (node.isContainerNode()) return "";
        return node.asText();
    }
}
