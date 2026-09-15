package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.Order;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Product;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.AuthService;
import dreamweaver.service.CommissionService;
import dreamweaver.service.CreatorService;
import dreamweaver.service.DashboardService;
import dreamweaver.service.PoolService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 创作者平台业务（工作台总览 / BI 看板 / 佣金 / 图序列），
 * 逐行等价于 {@code apps/server/src/routes/creator.ts}。
 *
 * <p>改造说明：原逻辑散落在控制层（直接读内存库）中，现全部下沉本实现，
 * 数据经 repository 读写；控制器只保留参数解析 + 角色守卫 + 响应包装。
 */
@Service
public class CreatorServiceImpl implements CreatorService {

    private final AuthService auth;
    private final DashboardService dashboardService;
    private final CommissionService commission;
    private final PoolService poolService;
    private final MaterialRepository materialRepository;
    private final WorkRepository workRepository;
    private final PostRepository postRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    public CreatorServiceImpl(AuthService auth,
                              DashboardService dashboardService,
                              CommissionService commission,
                              PoolService poolService,
                              MaterialRepository materialRepository,
                              WorkRepository workRepository,
                              PostRepository postRepository,
                              PoolEntryRepository poolEntryRepository,
                              WindowMaterialRepository windowMaterialRepository,
                              ProductRepository productRepository,
                              OrderRepository orderRepository) {
        this.auth = auth;
        this.dashboardService = dashboardService;
        this.commission = commission;
        this.poolService = poolService;
        this.materialRepository = materialRepository;
        this.workRepository = workRepository;
        this.postRepository = postRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
    }

    /** 工作台总览 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> overview(int uid) {
        List<WindowMaterial> windows = windowMaterialRepository.findByCreatorIdOrderByUpdatedAtDesc(uid);
        List<PoolEntry> poolEntries = poolEntryRepository.findByCreatorIdOrderByQualifiedAtDesc(uid);
        List<Product> products = new ArrayList<>(productRepository.findByCreatorIdOrderByCreatedAtDesc(uid));
        // 原内存库按插入顺序（id 升序）；此处恢复同一顺序，与旧实现逐位一致
        products.sort(Comparator.comparingInt(p -> p.id));
        List<Order> orders = orderRepository.findByCreatorIdOrderByCreatedAtDesc(uid);

        List<PoolEntry> unhandledPool = new ArrayList<>();
        for (PoolEntry e : poolEntries) {
            // 池条目尚无对应 submitted/approved 橱窗材料
            if (e.workId == null || e.workId == 0) continue;
            boolean handled = windowMaterialRepository.existsByWorkIdAndStatus(e.workId, WindowStatus.SUBMITTED)
                    || windowMaterialRepository.existsByWorkIdAndStatus(e.workId, WindowStatus.APPROVED);
            if (!handled) unhandledPool.add(e);
        }

        List<Order> recentOrders = orders.size() > 5
                ? new ArrayList<>(orders.subList(0, 5))
                : new ArrayList<>(orders);

        long windowSubmitted = windows.stream().filter(w -> w.status == WindowStatus.SUBMITTED).count();
        long windowRejected = windows.stream().filter(w -> w.status == WindowStatus.REJECTED).count();
        String dayAgoUtc = Instant.ofEpochMilli(System.currentTimeMillis() - TimeUtil.DAY_MS).toString().substring(0, 10);

        Map<String, Object> welcome = new LinkedHashMap<>();
        User me = auth.userOf(uid);
        if (me != null) welcome.put("nickname", me.nickname);
        welcome.put("productCount", products.size());

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("materials", materialRepository.countByCreatorId(uid));
        counts.put("works", workRepository.countByCreatorId(uid));
        counts.put("posts", postRepository.countByAuthorId(uid));
        counts.put("poolTotal", poolEntries.size());
        counts.put("poolUnhandled", unhandledPool.size());
        counts.put("windowDraft", windows.stream().filter(w -> w.status == WindowStatus.DRAFT).count());
        counts.put("windowSubmitted", windowSubmitted);
        counts.put("windowApproved", windows.stream().filter(w -> w.status == WindowStatus.APPROVED).count());
        counts.put("windowRejected", windowRejected);
        counts.put("productOnSale", products.stream().filter(p -> "onSale".equals(p.status)).count());
        counts.put("orderToday", orders.stream()
                .filter(o -> o.createdAt != null && dateSlice(o.createdAt).compareTo(dayAgoUtc) >= 0).count());

        List<Map<String, Object>> todo = new ArrayList<>();
        if (!unhandledPool.isEmpty()) {
            todo.add(todoItem("pool", unhandledPool.size() + " 个入池作品待准备橱窗材料", "/creator/pool"));
        }
        if (windowSubmitted > 0) {
            todo.add(todoItem("audit", windowSubmitted + " 份橱窗材料审核中", "/creator/window"));
        }
        if (windowRejected > 0) {
            todo.add(todoItem("reject", windowRejected + " 份橱窗材料被拒，请补齐后重新提交", "/creator/window"));
        }

        List<Map<String, Object>> recent = new ArrayList<>();
        for (Order o : recentOrders) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", o.id);
            m.put("no", o.no);
            m.put("productTitle", o.productTitle);
            m.put("status", o.status.value());
            m.put("total", o.amounts.total);
            m.put("createdAt", o.createdAt);
            m.put("buyerId", o.buyerId);
            recent.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("welcome", welcome);
        out.put("counts", counts);
        out.put("todo", todo);
        out.put("recentOrders", recent);
        out.put("kpi", dashboardService.dashboard(uid, 30, null).get("kpis"));
        out.put("meta", poolService.poolMeta());
        return out;
    }

    /** BI 看板 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(int uid, String days, String productId) {
        int d = Math.min(90, Math.max(7, MiscUtil.toInt(days, 30)));
        Integer pid = queryProductId(productId);
        if (pid != null) {
            Product p = productRepository.findById(pid).orElse(null);
            if (p == null || p.creatorId != uid) throw Errors.bad("BAD_REQUEST", "该商品不属于当前账号");
        }
        return dashboardService.dashboard(uid, d, pid);
    }

    /** 佣金汇总 */
    @Override
    @Transactional
    public Map<String, Object> commission(int uid) {
        commission.settleDueCommissions(); // 演示即时结算（幂等）
        CommissionService.Summary s = commission.summary(uid);

        List<LedgerEvent> first30 = s.ledger.size() > 30
                ? new ArrayList<>(s.ledger.subList(0, 30))
                : new ArrayList<>(s.ledger);
        List<LedgerEvent> withdrawHistory = new ArrayList<>();
        for (LedgerEvent l : s.ledger) if ("withdraw".equals(l.kind)) withdrawHistory.add(l);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("withdrawable", s.withdrawable);
        out.put("pending", s.pending);
        out.put("settled", s.settled);
        out.put("estimatedTotal", s.estimatedTotal);
        out.put("ledger", first30);
        out.put("rules", s.rules);
        out.put("rateExplain", "佣金区间 2%-10%，基础 6%；退货率>6% 或资源池重复度高会下浮，转化率≥8% 且销量≥10 上浮 +2%。");
        out.put("withdrawHistory", withdrawHistory);
        return out;
    }

    /** 单品佣金率（含逐条 breaks/reasons） */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> commissionRate(int uid, String productId) {
        Integer pid = MiscUtil.toIntOrNull(productId);
        if (pid == null || pid == 0) {
            // 所有商品
            List<Product> products = new ArrayList<>(
                    productRepository.findByCreatorIdAndStatusOrderByCreatedAtDesc(uid, "onSale"));
            products.sort(Comparator.comparingInt(p -> p.id));
            List<Map<String, Object>> list = new ArrayList<>();
            for (Product p : products) {
                Map<String, Object> m = new LinkedHashMap<>(commission.commissionRateForProduct(p.id));
                m.put("title", p.title);
                m.put("cover", p.cover);
                list.add(m);
            }
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("list", list);
            return out;
        }
        Product p = productRepository.findById(pid).orElse(null);
        if (p == null || p.creatorId != uid) throw Errors.bad("NOT_FOUND", "商品不存在");

        Map<String, Object> product = new LinkedHashMap<>();
        product.put("id", p.id);
        product.put("title", p.title);
        product.put("cover", p.cover);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("product", product);
        out.putAll(commission.commissionRateForProduct(p.id));
        return out;
    }

    /** 提现 */
    @Override
    @Transactional
    public Map<String, Object> withdraw(int uid, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        double amount = b.containsKey("amount") ? jsNumber(b.get("amount")) : Double.NaN;
        if (!Double.isFinite(amount)) throw Errors.bad("BAD_REQUEST", "请提供提现金额");
        Map<String, Object> r = commission.withdraw(uid, amount);
        CommissionService.Summary s = commission.summary(uid);
        Map<String, Object> out = new LinkedHashMap<>(r);
        out.put("withdrawable", s.withdrawable);
        return out;
    }

    /** 图序列 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> series(int uid, String days, String metric, String productId) {
        int d = Math.min(90, Math.max(7, MiscUtil.toInt(days, 30)));
        String m = ("order".equals(metric) || "amount".equals(metric) || "returnRate".equals(metric)) ? metric : "amount";
        Integer pid = queryProductId(productId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("metric", m);
        out.put("days", d);
        out.put("series", dashboardService.seriesData(uid, d, m, pid));
        return out;
    }

    /* ----------------------------- 内部工具 ----------------------------- */

    private static Map<String, Object> todoItem(String type, String text, String link) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", type);
        m.put("text", text);
        m.put("link", link);
        return m;
    }

    /** 等价 JS iso.slice(0, 10) */
    private static String dateSlice(String iso) {
        return iso.length() <= 10 ? iso : iso.substring(0, 10);
    }

    /** 等价 `req.query.productId ? Number(req.query.productId) : undefined`（0/NaN 视作未指定） */
    private static Integer queryProductId(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        Integer pid = MiscUtil.toIntOrNull(raw);
        if (pid == null || pid == 0) return null;
        return pid;
    }

    /** 等价 JS Number(v)：null→0，""→0，非法→NaN */
    private static double jsNumber(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1 : 0;
        if (v instanceof String s) {
            String t = s.trim();
            if (t.isEmpty()) return 0;
            try {
                return Double.parseDouble(t);
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }
        return Double.NaN;
    }
}
