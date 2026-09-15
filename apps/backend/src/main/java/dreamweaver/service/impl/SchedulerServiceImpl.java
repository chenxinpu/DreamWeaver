package dreamweaver.service.impl;

import dreamweaver.common.TimeUtil;
import dreamweaver.entity.AppSettings;
import dreamweaver.entity.PoolEvalResult;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import dreamweaver.repository.AppSettingsRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.service.CommissionService;
import dreamweaver.service.OrderService;
import dreamweaver.service.PoolService;
import dreamweaver.service.SchedulerService;
import dreamweaver.service.WindowService;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 定时任务（每日 00:05 东八区），逐行等价于 {@code apps/server/src/engine/scheduler.ts}：
 *
 * <ol>
 *   <li>资源池自动评估当日推文（§3.1）</li>
 *   <li>待审橱窗（submitted）自动审核（模拟 24h 内出结果）</li>
 *   <li>佣金 T+7 结算 + 订单自动完成</li>
 * </ol>
 *
 * <p>实现说明：原实现用 {@code setTimeout(nextDailyRunDelay(0,5))} 后转 {@code setInterval(86400000)}。
 * Java 侧用单线程守护调度器复刻同一时序（首次延迟 = {@link TimeUtil#nextDailyRunDelay(int, int)}，
 * 之后每 24h 一次），避免依赖 {@code @EnableScheduling}。
 *
 * <p>事务说明：{@link #runDaily()} 显式挂起外层事务（{@code NOT_SUPPORTED}），让三段任务各自
 * 走被调 service 的独立事务——任一段失败只回滚自己，不会因 Spring 的 rollback-only 标记牵连其余两段。
 */
@Service
public class SchedulerServiceImpl implements SchedulerService {

    private static final Logger log = LoggerFactory.getLogger(SchedulerServiceImpl.class);

    /** 等价 JS new Date().toISOString()（毫秒固定 3 位 + Z） */
    private static final DateTimeFormatter ISO_Z =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    private final PoolService poolService;
    private final WindowService windowService;
    private final CommissionService commissionService;
    private final OrderService orderService;
    private final WindowMaterialRepository windowMaterialRepository;
    private final AppSettingsRepository appSettingsRepository;

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "dw-scheduler");
        t.setDaemon(true);
        return t;
    });

    private ScheduledFuture<?> timer;

    public SchedulerServiceImpl(PoolService poolService,
                                WindowService windowService,
                                CommissionService commissionService,
                                OrderService orderService,
                                WindowMaterialRepository windowMaterialRepository,
                                AppSettingsRepository appSettingsRepository) {
        this.poolService = poolService;
        this.windowService = windowService;
        this.commissionService = commissionService;
        this.orderService = orderService;
        this.windowMaterialRepository = windowMaterialRepository;
        this.appSettingsRepository = appSettingsRepository;
    }

    /** 等价 startScheduler()：启动时排定首次执行，之后每 24h 一次。 */
    @PostConstruct
    public void startScheduler() {
        if (timer != null) timer.cancel(false);
        long delay = TimeUtil.nextDailyRunDelay(0, 5);
        timer = scheduler.schedule(() -> {
            runDaily();
            timer = scheduler.scheduleAtFixedRate(this::runDaily, TimeUtil.DAY_MS, TimeUtil.DAY_MS, TimeUnit.MILLISECONDS);
        }, delay, TimeUnit.MILLISECONDS);
        log.info("[scheduler] 每日 00:05 任务已排定（{} 小时后首次执行）",
                String.format(Locale.ROOT, "%.1f", delay / 3600000.0));
    }

    @PreDestroy
    public void stopScheduler() {
        timer = null;
        scheduler.shutdownNow();
    }

    /** 等价 runDaily()：三段独立 try/catch，互不影响。 */
    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void runDaily() {
        try {
            PoolEvalResult pr = poolService.evalPool(null);
            String tail = pr.added.isEmpty()
                    ? ""
                    : " (" + pr.added.stream().map(a -> "post#" + a.postId).collect(Collectors.joining(",")) + ")";
            log.info("[scheduler] 资源池每日评估：日期 {}，评估 {} 篇，新增入池 {}{}",
                    pr.dateKey, pr.evaluated, pr.added.size(), tail);
        } catch (Exception e) {
            log.error("[scheduler] 资源池评估异常", e);
        }
        try {
            // 待审橱窗自动审核
            int n = 0;
            for (WindowMaterial w : windowMaterialRepository.findByStatus(WindowStatus.SUBMITTED)) {
                WindowService.AuditResult r = windowService.auditWindow(w);
                log.info("[scheduler] 橱窗 #{} 自动审核：{} {}", w.id, r.pass ? "通过→上架" : "拒绝", w.productName);
                n++;
            }
            if (n == 0) log.info("[scheduler] 无待审橱窗");
            AppSettings settings = appSettingsRepository.findById(1).orElseGet(AppSettings::new);
            settings.id = 1;
            settings.lastWindowAudit = ISO_Z.format(Instant.now());
            appSettingsRepository.save(settings);
        } catch (Exception e) {
            log.error("[scheduler] 橱窗审核异常", e);
        }
        try {
            int settled = commissionService.settleDueCommissions();
            int completed = orderService.autoCompleteReceived();
            log.info("[scheduler] 佣金结算 {} 笔，订单自动完成 {} 笔", settled, completed);
        } catch (Exception e) {
            log.error("[scheduler] 佣金结算异常", e);
        }
    }
}
