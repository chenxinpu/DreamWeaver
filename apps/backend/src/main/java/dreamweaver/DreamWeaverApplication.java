package dreamweaver;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 织梦 DreamWeaver 后端服务（Java 21 / Spring Boot 3）启动类。
 *
 * <p>架构定位：本服务是<b>唯一后端</b>，一个进程同时承担 ①全部业务逻辑
 * ②BFF 聚合层（{@code /api/bff/**}）③WebSocket 实时通信（{@code /ws}）；
 * 数据经 Spring Data JPA 落 MySQL；AI 生成类能力由 Python 服务提供，
 * 本服务通过 {@link dreamweaver.ai.AiServiceClient} 调用。
 *
 * <p><b>包结构</b>：单一基础包 {@code dreamweaver}（组件扫描 / JPA 实体扫描 / Spring Data
 * 仓库扫描的默认根均为本类所在包），其下按教科书分层划分子包：
 * {@code controller} · {@code service}(+{@code impl}) · {@code repository} · {@code entity} ·
 * {@code dto} · {@code config} · {@code common} · {@code parser} · {@code realtime} · {@code ai}。
 */
@SpringBootApplication
@EnableScheduling
public class DreamWeaverApplication {
    public static void main(String[] args) {
        SpringApplication.run(DreamWeaverApplication.class, args);
    }
}
