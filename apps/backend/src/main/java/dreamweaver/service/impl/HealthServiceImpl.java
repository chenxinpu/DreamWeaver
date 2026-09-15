package dreamweaver.service.impl;

import dreamweaver.ai.AiServiceClient;
import dreamweaver.common.TimeUtil;
import dreamweaver.repository.LedgerEventRepository;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.NotificationRepository;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.ResaleListingRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.HealthService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 聚合健康检查实现：{@code GET /api/health} 的数据装配（原 {@code controller.HealthController} 的逻辑下沉至此）。
 *
 * <ul>
 *   <li>后端自身<b>永远</b> {@code ok:true}（它是被检查对象，不是依赖），耗时固定 0；</li>
 *   <li>Python AI 实测一次探活并记录耗时，<b>不可用不影响整体 {@code ok:true}</b>；</li>
 *   <li>{@code entities} 由各 {@code repository.count()} 统计（不再有任何内存库引用）；</li>
 *   <li>{@code time} 为带本地偏移（东八区 {@code +08:00}）的 ISO 时间。</li>
 * </ul>
 */
@Service
public class HealthServiceImpl implements HealthService {

    private static final String VERSION = "2.0.0";
    private static final String SERVICE_NAME = "backend";

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final WorkRepository workRepository;
    private final PostRepository postRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ResaleListingRepository resaleListingRepository;
    private final NotificationRepository notificationRepository;
    private final LedgerEventRepository ledgerEventRepository;
    private final AiServiceClient ai;
    private final int port;

    public HealthServiceImpl(UserRepository userRepository,
                             MaterialRepository materialRepository,
                             WorkRepository workRepository,
                             PostRepository postRepository,
                             PoolEntryRepository poolEntryRepository,
                             WindowMaterialRepository windowMaterialRepository,
                             ProductRepository productRepository,
                             OrderRepository orderRepository,
                             ResaleListingRepository resaleListingRepository,
                             NotificationRepository notificationRepository,
                             LedgerEventRepository ledgerEventRepository,
                             AiServiceClient ai,
                             @Value("${server.port:8787}") int port) {
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
        this.workRepository = workRepository;
        this.postRepository = postRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.resaleListingRepository = resaleListingRepository;
        this.notificationRepository = notificationRepository;
        this.ledgerEventRepository = ledgerEventRepository;
        this.ai = ai;
        this.port = port;
    }

    @Override
    public String version() {
        return VERSION;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> health() {
        // 后端自身：恒可用，耗时固定 0（等价原实现的 gateway.latencyMs = 0）
        Map<String, Object> backend = service(SERVICE_NAME, true, "http://127.0.0.1:" + port, 0L);

        // Python AI：实测一次探活并记录耗时（不可用不影响整体 ok）
        long t0 = System.nanoTime();
        boolean aiOk = ai.healthy();
        long aiLatencyMs = (System.nanoTime() - t0) / 1_000_000L;
        Map<String, Object> aiService = service("ai", aiOk, ai.baseUrl(), aiLatencyMs);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("status", "up");
        data.put("version", VERSION);
        data.put("port", port);
        data.put("time", TimeUtil.nowIso());
        data.put("services", List.of(backend, aiService));
        data.put("entities", entities());
        return data;
    }

    /** 各实体计数（公开诊断信息，无敏感数据）：一律走 repository 的 count()。 */
    private Map<String, Object> entities() {
        Map<String, Object> entities = new LinkedHashMap<>();
        entities.put("users", userRepository.count());
        entities.put("materials", materialRepository.count());
        entities.put("works", workRepository.count());
        entities.put("posts", postRepository.count());
        entities.put("pool", poolEntryRepository.count());
        entities.put("windows", windowMaterialRepository.count());
        entities.put("products", productRepository.count());
        entities.put("orders", orderRepository.count());
        entities.put("resale", resaleListingRepository.count());
        entities.put("notifications", notificationRepository.count());
        entities.put("ledger", ledgerEventRepository.count());
        return entities;
    }

    private static Map<String, Object> service(String name, boolean ok, String url, long latencyMs) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("ok", ok);
        m.put("url", url);
        m.put("latencyMs", latencyMs);
        return m;
    }
}
