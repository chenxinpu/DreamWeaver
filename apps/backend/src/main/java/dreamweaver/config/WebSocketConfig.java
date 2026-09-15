package dreamweaver.config;

import dreamweaver.realtime.RealtimeHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

/**
 * WebSocket 配置——<b>替代原 apps/gateway 的实时通信层</b>。
 *
 * <p>架构变更说明：原「Node 网关 + Java 核心 + Python AI」三服务中，
 * Node 网关（{@code apps/gateway}）已删除；其三项职责里
 * <b>WebSocket 长连接 / 弹幕 / 即时聊天 / 订单状态推送</b> 由本模块（Java 后端）承担，
 * 与 HTTP 同端口 <b>8787</b>、路径 <b>/ws</b>（前端 vite 已配置 {@code /ws → ws://localhost:8787}）。
 *
 * <p>实现选择：原生 {@code TextWebSocketHandler}（{@link RealtimeHandler}），
 * <b>不使用 STOMP/SockJS</b>——协议是自定义 JSON 文本帧（帧格式见 {@code apps/gateway/README.md} §5）。
 *
 * <p>Origin 策略：允许所有 Origin（{@code setAllowedOriginPatterns("*")}），
 * 与原网关 CORS 全开（{@code origin: true, credentials: true}）等价。
 */
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeHandler realtimeHandler;

    @Value("${dw.ws.path:/ws}")
    private String wsPath = "/ws";

    public WebSocketConfig(RealtimeHandler realtimeHandler) {
        this.realtimeHandler = realtimeHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 端点 /ws；放开所有 Origin（等价原网关的 CORS 全开）
        registry.addHandler(realtimeHandler, wsPath).setAllowedOriginPatterns("*");
    }

    /**
     * 容器级收发缓冲：JSON 文本帧上限放宽到 128KB（原 {@code ws} 库默认上限远大于此），
     * 避免长文本/大 data 帧被容器直接拒绝。二进制同额（当前协议不使用二进制帧）。
     */
    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(128 * 1024);
        container.setMaxBinaryMessageBufferSize(128 * 1024);
        return container;
    }
}
