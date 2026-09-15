package dreamweaver.config;

import dreamweaver.service.DemoDataService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 启动引导：库为空时灌入演示数据。
 *
 * <p>对应原 JSON 文件库实现里 {@code DbStore.loadOrSeed()} 的启动播种职责，
 * 现改为经 {@link DemoDataService} 走 JPA repository 落 MySQL。
 * 可用 {@code dw.seed-demo-data=false}（或环境变量 {@code DW_SEED=false}）关闭。
 */
@Component
@Order(1)
public class DemoDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    private final DemoDataService demoDataService;

    @Value("${dw.seed-demo-data:true}")
    private boolean seedEnabled;

    public DemoDataInitializer(DemoDataService demoDataService) {
        this.demoDataService = demoDataService;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            log.info("[seed] dw.seed-demo-data=false，跳过演示数据播种");
            return;
        }
        try {
            boolean seeded = demoDataService.ensureSeeded();
            log.info(seeded ? "[seed] 首次启动，已灌入演示数据到 MySQL" : "[seed] 数据库已有数据，跳过播种");
        } catch (Exception e) {
            log.error("[seed] 演示数据播种失败（可稍后 POST /api/dev/reset 重试）", e);
        }
    }
}
