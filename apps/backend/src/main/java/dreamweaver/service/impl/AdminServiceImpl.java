package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.AuditLogItem;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.PoolEvalResult;
import dreamweaver.entity.Post;
import dreamweaver.entity.Product;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import dreamweaver.entity.Work;
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
import dreamweaver.service.AdminService;
import dreamweaver.service.DemoDataService;
import dreamweaver.service.NotifyService;
import dreamweaver.service.PoolService;
import dreamweaver.service.ProductService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * admin / dev 路由业务：演示账号列表、审核员强制审核、数据重置、演示热度加速，
 * 逐行等价于 {@code apps/server/src/routes/admin.ts}。
 *
 * <p>改造说明：原逻辑散落在控制层（直接读写内存库）中，现全部下沉本实现；
 * 手工 id 计数器、脏标记保存与整库替换均由数据库主键与 {@link DemoDataService} 取代。
 */
@Service
public class AdminServiceImpl implements AdminService {

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
    private final DtoMapper dtoMapper;
    private final NotifyService notify;
    private final ProductService productService;
    private final PoolService poolService;
    private final DemoDataService demoDataService;

    public AdminServiceImpl(UserRepository userRepository,
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
                            DtoMapper dtoMapper,
                            NotifyService notify,
                            ProductService productService,
                            PoolService poolService,
                            DemoDataService demoDataService) {
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
        this.dtoMapper = dtoMapper;
        this.notify = notify;
        this.productService = productService;
        this.poolService = poolService;
        this.demoDataService = demoDataService;
    }

    private static String roleDesc(Role r) {
        return r == Role.CREATOR ? "创作者" : r == Role.CONSUMER ? "消费者" : r == Role.AUDITOR ? "审核员" : "管理员";
    }

    /** 等价原实现的角色字符串匹配（未知角色返回 null → 空列表，与旧实现一致） */
    private static Role roleOf(String value) {
        for (Role role : Role.values()) {
            if (role.value().equals(value)) return role;
        }
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> users(String role) {
        String r = (role == null || role.isEmpty()) ? null : role;
        List<User> list;
        if (r == null) {
            list = userRepository.findAllByOrderByIdAsc();
        } else {
            Role target = roleOf(r);
            list = target == null ? List.of() : userRepository.findByRole(target);
        }
        List<User> sorted = new ArrayList<>(list);
        sorted.sort((a, b) -> Integer.compare(a.id, b.id));

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (User u : sorted) {
            Map<String, Object> m = new LinkedHashMap<>(dtoMapper.toUserPublic(u));
            m.put("roleDesc", roleDesc(u.role));
            mapped.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", mapped);
        out.put("roles", List.of("consumer", "creator", "auditor", "admin"));
        out.put("hint", "演示账号：1=小织(creator) · 14=我的小号(consumer) · 99=平台审核专员(auditor)；登录 POST /api/auth/login");
        return out;
    }

    /** 审核员强制审核（覆盖演示结论） */
    @Override
    @Transactional
    public Map<String, Object> forceWindow(long id, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;

        WindowMaterial w = windowMaterialRepository.findById((int) id).orElse(null);
        if (w == null) throw Errors.notFound("橱窗材料不存在");

        Object passRaw = b.get("pass");
        boolean pass = Boolean.TRUE.equals(passRaw) || "true".equals(passRaw);
        String note = jsTruthy(b.get("note"))
                ? jsToString(b.get("note"))
                : (pass ? "审核员人工复核通过" : "审核员人工复核驳回");

        if (w.auditLog == null) w.auditLog = new ArrayList<>();
        w.updatedAt = TimeUtil.nowIso();

        if (pass) {
            // 若已有通过记录则直接返回
            Product existingProduct = productRepository.findByWindowId(w.id).stream().findFirst().orElse(null);
            if (existingProduct != null) {
                Map<String, Object> product = new LinkedHashMap<>();
                product.put("id", existingProduct.id);
                product.put("title", existingProduct.title);
                Map<String, Object> out = new LinkedHashMap<>();
                out.put("window", w);
                out.put("product", product);
                out.put("note", "该橱窗此前已通过");
                return out;
            }
            w.status = WindowStatus.APPROVED;
            AuditLogItem item = new AuditLogItem();
            item.passed = true;
            item.note = note;
            item.at = TimeUtil.nowIso();
            w.auditLog.add(item);

            Work work = workRepository.findById(w.workId).orElse(null);
            if (work == null) throw Errors.bad("BAD_REQUEST", "关联作品不存在");

            Product product = productService.buildProduct(w, work);
            productRepository.save(product);

            notify.notify(w.creatorId, "audit", "✅ 橱窗材料审核通过",
                    "「" + w.productName + "」经审核员复核通过，商品已上架商城。", "/mall/product/" + product.id);
            windowMaterialRepository.save(w);

            Map<String, Object> productBrief = new LinkedHashMap<>();
            productBrief.put("id", product.id);
            productBrief.put("title", product.title);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("window", w);
            out.put("product", productBrief);
            out.put("note", note);
            return out;
        }

        w.status = WindowStatus.REJECTED;
        AuditLogItem item = new AuditLogItem();
        item.passed = false;
        item.note = note;
        item.at = TimeUtil.nowIso();
        w.auditLog.add(item);
        notify.notify(w.creatorId, "audit", "❌ 橱窗材料被驳回",
                "「" + w.productName + "」审核意见：" + note + "。请补齐材料后重新提交（status 已回草稿）。",
                "/creator/window?workId=" + w.workId);
        windowMaterialRepository.save(w);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("window", w);
        out.put("note", note);
        return out;
    }

    /**
     * 重置数据（重新 seed）。
     *
     * <p>事务说明：本方法<b>不</b>挂外层事务——重置由 {@link DemoDataService#reset(boolean)} 自带的
     * 事务完成，随后的资源池评估也走它自己的事务。这样评估失败（被下面的 try/catch 吞掉）不会把
     * 已完成的重置牵连回滚，与原实现「先落库、再尽力评估」的语义一致。
     */
    @Override
    public Map<String, Object> reset(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        boolean seed = !Boolean.FALSE.equals(b.get("seed"));

        long before = orderRepository.count() + postRepository.count() + productRepository.count();
        demoDataService.reset(seed);

        // 重置后立即跑一次当日资源池评估，让演示状态立刻可用
        Map<String, Object> evalInfo = null;
        if (seed) {
            try {
                PoolEvalResult r = poolService.evalPool(null);
                evalInfo = new LinkedHashMap<>();
                evalInfo.put("p60", r.p60);
                evalInfo.put("added", r.added.size());
            } catch (Exception ignore) {
                evalInfo = null;
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reset", true);
        out.put("seeded", seed);
        out.put("before", before);
        out.put("now", orderRepository.count() + postRepository.count() + productRepository.count());
        out.put("poolEval", evalInfo);
        out.put("msg", "数据已重置");
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> devInfo() {
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

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", "v2.0.0");
        out.put("entities", entities);
        return out;
    }

    /**
     * dev 演示：把某篇推文的热度提升到指定点赞数（模拟真实互动），随后引擎自动做当日评估，
     * 命中规则（点赞&gt;当日P60 或 评论≥10）即自动纳入资源池并给作者发通知。
     * 仅限作者本人对自己的推文使用（演示加速器，不改变生产语义）。
     */
    @Override
    @Transactional
    public Map<String, Object> surgeLikes(int uid, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;

        Integer postId = MiscUtil.toIntOrNull(b.get("postId"));
        double likesValue = b.containsKey("likes") ? jsNumber(b.get("likes")) : Double.NaN;
        if (postId == null || postId == 0 || !Double.isFinite(likesValue) || likesValue < 0) {
            throw Errors.bad("BAD_REQUEST", "需要 postId 与 likes(≥0)");
        }
        Post p = postRepository.findById(postId).orElse(null);
        if (p == null) throw Errors.notFound("推文不存在");
        if (p.authorId != uid) throw Errors.deny("只能对自己推文的演示热度做调整");

        int likes = (int) likesValue;
        int before = p.likes;
        int diff = likes - p.likes;
        if (p.likedBy == null) p.likedBy = new ArrayList<>();
        if (diff > 0) {
            p.likes = likes;
            for (int i = 0; i < diff; i++) p.likedBy.add(9000000 + i);
        } else if (diff < 0) {
            p.likes = likes;
            int keep = Math.max(0, p.likedBy.size() + diff);
            p.likedBy.subList(Math.min(keep, p.likedBy.size()), p.likedBy.size()).clear();
        }
        postRepository.save(p);

        PoolEvalResult r = poolService.evalPool(null);
        List<PoolEntry> mine = new ArrayList<>(poolEntryRepository.findByPostId(p.id));
        mine.sort(Comparator.comparingInt(e -> e.id));

        List<Map<String, Object>> poolEntries = new ArrayList<>();
        for (PoolEntry e : mine) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.id);
            m.put("reason", e.reason);
            poolEntries.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("postId", p.id);
        out.put("likesBefore", before);
        out.put("likesNow", p.likes);
        out.put("p60", r.p60);
        out.put("qualified", !mine.isEmpty());
        out.put("poolEntries", poolEntries);
        out.put("note", "当日 P60=" + MiscUtil.jsNum(r.p60) + "，当前赞=" + p.likes
                + "，评论=" + p.commentCount + "（≥10 亦入池）");
        return out;
    }

    /* ----------------------------- 内部工具 ----------------------------- */

    /** 等价 JS 真值判断（null/undefined/false/0/""/NaN 为假，其余为真） */
    private static boolean jsTruthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d != 0 && !Double.isNaN(d);
        }
        if (v instanceof String s) return !s.isEmpty();
        return true;
    }

    /** 等价 JS String(v)（用于 note 默认值替换） */
    private static String jsToString(Object v) {
        if (v instanceof Number n) {
            double d = n.doubleValue();
            if (d == Math.rint(d) && Math.abs(d) < 1e15) return String.valueOf((long) d);
            return String.valueOf(d);
        }
        return String.valueOf(v);
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
