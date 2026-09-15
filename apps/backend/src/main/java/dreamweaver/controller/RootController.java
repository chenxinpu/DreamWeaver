package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.TimeUtil;
import dreamweaver.service.HealthService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 根路径自述 {@code GET /}：Java 后端的实际职责清单（人工核验用，公开接口）。
 *
 * <p>业务规则、BFF 聚合、聚合健康检查、WebSocket 实时通信现在都在本进程内，
 * <b>不再有 Node 网关转发层</b>。该路径不在 {@code /api/**} 之下，因此不受鉴权拦截器约束；
 * 同时在 {@link dreamweaver.common.PublicApi} 中显式登记为公开接口，避免拦截器路径规则变化时被误拦。
 *
 * <p>控制层只做「拼装自述 JSON + 包响应」，不注入任何 repository，也不含业务规则。
 */
@RestController
public class RootController {

    /** 进程启动时刻（类加载时确定），等价原实现的 STARTED_AT。 */
    private static final String STARTED_AT = TimeUtil.nowIso();

    private final HealthService healthService;
    private final int port;

    public RootController(HealthService healthService, @Value("${server.port:8787}") int port) {
        this.healthService = healthService;
        this.port = port;
    }

    @GetMapping("/")
    public ApiResponse index() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("name", "dreamweaver-backend");
        data.put("role", "Java 业务后端（业务规则唯一实现方）+ BFF 聚合层 + WebSocket 实时通信 + 聚合健康检查；AI 生成类能力由 Python 服务提供");
        data.put("version", healthService.version());
        data.put("port", port);
        data.put("startedAt", STARTED_AT);
        data.put("time", TimeUtil.nowIso());
        data.put("responsibilities", responsibilities());
        data.put("api", api());
        data.put("bff", bff());
        data.put("ws", ws());
        return ApiResponse.ok(data);
    }

    private static List<String> responsibilities() {
        List<String> list = new ArrayList<>();
        list.add("业务核心：/api/* 全部在进程内实现（用户/素材/作品/推文/资源池/橱窗/商品/订单/售后/佣金/看板）");
        list.add("BFF 聚合：/api/bff/* 在 service 层为前端聚合既有业务 service（字段裁剪/改名 + 单块失败降级）");
        list.add("实时通信：/ws WebSocket 长连接（订阅/弹幕/私聊/订单状态推送），与 HTTP 同端口");
        list.add("聚合健康：/api/health 汇总本进程与 Python AI 服务状态（AI 不可用不影响整体 ok）");
        list.add("AI 调用：生成类能力经 dreamweaver.ai.AiServiceClient 请求 Python AI 服务");
        return list;
    }

    private static Map<String, Object> api() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("prefix", "/api");
        m.put("desc", "业务接口：本进程直接处理，不做任何下游 HTTP 转发");
        m.put("groups", List.of(
                "/api/auth·/api/me：登录与个人中心",
                "/api/feed·/api/posts：信息流与互动",
                "/api/materials·/api/works：素材导入与作品组织",
                "/api/pool·/api/creator：资源池与创作者平台",
                "/api/creator/window：橱窗材料与审核",
                "/api/mall·/api/products·/api/custom：商城与私人定制",
                "/api/orders·/api/resale：订单、售后与二手集市",
                "/api/notifications·/api/admin·/api/dev：通知与运营/诊断"));
        return m;
    }

    private static Map<String, Object> bff() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("prefix", "/api/bff");
        m.put("desc", "聚合层：service 层进程内聚合 + 顶层 bff.{computedAt,upstreams,degraded}");
        m.put("endpoints", endpoints());
        return m;
    }

    private static Map<String, Object> ws() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("path", "/ws");
        m.put("desc", "WebSocket 实时推送（订单状态/通知/弹幕/私聊），与 HTTP 同端口");
        return m;
    }

    /** BFF 端点清单（自述用；与改造前的 apps/gateway/README.md §4.2 逐条对齐）。 */
    private static List<Map<String, Object>> endpoints() {
        List<Map<String, Object>> list = new ArrayList<>();
        list.add(endpoint("GET", "/api/bff/home", "消费者首页：feed + 达人/精选 + poolMeta + 未读通知 + me"));
        list.add(endpoint("GET", "/api/bff/mall/home", "商城首页：商品第一页 + 分类聚合 + 二手精选"));
        list.add(endpoint("GET", "/api/bff/product/:id", "商品详情：商品 + 创作者 + 定制上下文 + 收藏态"));
        list.add(endpoint("GET", "/api/bff/creator/workbench", "创作者工作台：overview + 待办池 + 草稿橱窗 + 未读通知"));
        list.add(endpoint("GET", "/api/bff/order/:id", "订单详情：订单 + 关联商品 + 阶段/物流标准化 + can"));
        list.add(endpoint("GET", "/api/bff/me", "我的页：me + 最近订单 + 通知/作品数 + stats"));
        list.add(endpoint("GET", "/api/health", "聚合健康检查（backend/ai + entities）"));
        return list;
    }

    private static Map<String, Object> endpoint(String method, String path, String desc) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("method", method);
        m.put("path", path);
        m.put("desc", desc);
        return m;
    }
}
