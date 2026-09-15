package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.User;
import dreamweaver.repository.UserRepository;
import dreamweaver.service.AuthService;
import dreamweaver.service.BffQueryService;
import dreamweaver.service.CreatorService;
import dreamweaver.service.CustomService;
import dreamweaver.service.NotificationService;
import dreamweaver.service.OrderService;
import dreamweaver.service.PoolService;
import dreamweaver.service.PostService;
import dreamweaver.service.ProductService;
import dreamweaver.service.ResaleService;
import dreamweaver.service.WindowService;
import dreamweaver.service.WorkService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * BFF 聚合业务实现：把原 {@code controller.bff} 下的聚合逻辑（{@code BffSupport} /
 * {@code HomeBff} / {@code MallBff} / {@code ProductBff} / {@code CreatorBff} / {@code OrderBff} /
 * {@code MeBff}）整体下沉到 <b>service 层</b>。
 *
 * <p><b>分层</b>：本类只依赖其它业务 service、{@code DtoMapper} 与 repository，
 * <b>绝不调用任何 controller</b>（改造前是 controller→controller，这是本次修掉的分层问题）。
 *
 * <p><b>红线</b>：本类只做「并发 + 组装 + 字段裁剪/改名 + 降级语义」，不做任何业务判定
 * （不判状态、不算钱、不生成业务文案）；业务结论一律来自被调用的 service。
 *
 * <p><b>响应形状（一字不变）</b>：每个端点
 * {@code {ok:true, data:{…}, bff:{computedAt, upstreams:[{name,ok,latencyMs}], degraded:[]}}}，
 * {@code bff} 在<b>顶层</b>；{@code GET /api/bff} 自述端点例外（{@code {ok:true,data:{…}}}，无顶层 {@code bff}）。
 *
 * <p><b>降级语义</b>：任一块失败只把该字段置 null 并写入 {@code bff.degraded}，绝不整体 500；
 * 游客（{@code viewerId == null}）时「需要登录」的块被跳过、值为 null 且<b>不计入 degraded</b>。
 */
@Service
public class BffQueryServiceImpl implements BffQueryService {

    private static final Logger log = LoggerFactory.getLogger(BffQueryServiceImpl.class);

    /** 消费者首页允许的 tab（非法值回落 rec）。 */
    private static final List<String> TABS = List.of("rec", "follow", "hot");

    /** 聚合并发线程池（等价原实现的并发拉取；纯进程内调用，daemon 线程）。 */
    private static final AtomicInteger SEQ = new AtomicInteger();
    private static final ExecutorService AGG_POOL = Executors.newFixedThreadPool(8, r -> {
        Thread t = new Thread(r, "dw-bff-agg-" + SEQ.incrementAndGet());
        t.setDaemon(true);
        return t;
    });

    private final PostService postService;
    private final PoolService poolService;
    private final AuthService authService;
    private final NotificationService notificationService;
    private final ProductService productService;
    private final ResaleService resaleService;
    private final CustomService customService;
    private final OrderService orderService;
    private final WindowService windowService;
    private final WorkService workService;
    private final CreatorService creatorService;
    private final UserRepository userRepository;

    public BffQueryServiceImpl(PostService postService,
                               PoolService poolService,
                               AuthService authService,
                               NotificationService notificationService,
                               ProductService productService,
                               ResaleService resaleService,
                               CustomService customService,
                               OrderService orderService,
                               WindowService windowService,
                               WorkService workService,
                               CreatorService creatorService,
                               UserRepository userRepository) {
        this.postService = postService;
        this.poolService = poolService;
        this.authService = authService;
        this.notificationService = notificationService;
        this.productService = productService;
        this.resaleService = resaleService;
        this.customService = customService;
        this.orderService = orderService;
        this.windowService = windowService;
        this.workService = workService;
        this.creatorService = creatorService;
        this.userRepository = userRepository;
    }

    /* =============================== 端点 =============================== */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> index() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("service", "dreamweaver-backend");
        data.put("layer", "bff");
        data.put("desc", "BFF 聚合层：在 Java 进程内聚合既有接口，字段裁剪/改名 + 降级语义");
        data.put("endpoints", endpoints());
        return data;
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope home(Integer viewerId, String tabRaw, String pageRaw, String pageSizeRaw) {
        String tab = tabRaw != null && TABS.contains(tabRaw) ? tabRaw : "rec";
        int page = queryInt(pageRaw, 1, 1, 10_000);
        int pageSize = queryInt(pageSizeRaw, 10, 1, 30);

        Agg agg = aggregate(viewerId, List.of(
                spec("feed", false, () -> postService.feed(
                        viewerId, tab, String.valueOf(page), String.valueOf(pageSize))),
                spec("seed", false, postService::recommendSeed),
                spec("poolMeta", false, poolService::poolMeta),
                spec("me", true, () -> authService.meAggregate(viewerId)),
                spec("notifications", true,
                        () -> notificationService.list(viewerId, "1", null, "1", "1"))));

        Map<String, Object> feedRaw = asRecord(agg.values().get("feed"));
        Map<String, Object> seed = asRecord(agg.values().get("seed"));
        Map<String, Object> notifications = asRecord(agg.values().get("notifications"));
        Map<String, Object> feedPage = pageOf(agg.values().get("feed"), page, pageSize);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(viewerId != null));
        data.put("tab", tab);
        data.put("page", page);
        data.put("pageSize", pageSize);
        if (agg.values().get("feed") == null) {
            data.put("feed", null);
        } else {
            Map<String, Object> feed = new LinkedHashMap<>(feedPage);
            feed.put("tab", feedRaw != null && feedRaw.get("tab") != null ? feedRaw.get("tab") : tab);
            data.put("feed", feed);
        }
        /** 达人（精选创作者）：上游字段 creators → talents */
        data.put("talents", asList(seed == null ? null : seed.get("creators")));
        /** 精选作品：上游字段 featured → picks */
        data.put("picks", asList(seed == null ? null : seed.get("featured")));
        data.put("poolMeta", agg.values().get("poolMeta"));
        data.put("unreadCount", numberOrField(notifications, "unreadCount", 0));
        data.put("me", agg.values().get("me"));
        return agg.envelope(data);
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope mallHome(Integer viewerId, String pageRaw, String pageSizeRaw,
                             String resalePageSizeRaw, String categoryRaw, String sortRaw) {
        int page = queryInt(pageRaw, 1, 1, 10_000);
        int pageSize = queryInt(pageSizeRaw, 12, 1, 48);
        int resalePageSize = queryInt(resalePageSizeRaw, 6, 1, 24);
        String category = queryStr(categoryRaw);
        String sort = queryStr(sortRaw);

        Agg agg = aggregate(viewerId, List.of(
                spec("products", false, () -> productService.mallProducts(
                        viewerId, category, null, sort, String.valueOf(page), String.valueOf(pageSize))),
                spec("resale", false, () -> resaleService.mall("1", String.valueOf(resalePageSize)))));

        Map<String, Object> productsRaw = asRecord(agg.values().get("products"));
        Map<String, Object> products = pageOf(agg.values().get("products"), page, pageSize);
        Map<String, Object> resale = pageOf(agg.values().get("resale"), 1, resalePageSize);
        List<Object> productList = asList(products.get("list"));
        List<Object> resaleList = asList(resale.get("list"));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(viewerId != null));
        if (agg.values().get("products") == null) {
            data.put("products", null);
        } else {
            Map<String, Object> out = new LinkedHashMap<>(products);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Object item : productList) items.add(normalizeMallProduct(item));
            out.put("list", items);
            data.put("products", out);
        }
        data.put("categories", buildCategories(productList,
                asList(productsRaw == null ? null : productsRaw.get("categories"))));
        if (agg.values().get("resale") == null) {
            data.put("resale", null);
        } else {
            Map<String, Object> out = new LinkedHashMap<>(resale);
            List<Map<String, Object>> items = new ArrayList<>();
            for (Object item : resaleList) items.add(normalizeResale(item));
            List<Map<String, Object>> featured = new ArrayList<>();
            for (Object item : resaleList.subList(0, Math.min(3, resaleList.size()))) {
                featured.add(normalizeResale(item));
            }
            out.put("list", items);
            out.put("featured", featured);
            data.put("resale", out);
        }
        return agg.envelope(data);
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope product(Integer viewerId, String idRaw) {
        if (idRaw == null || !idRaw.matches("\\d+")) {
            throw Errors.bad("BAD_REQUEST", "商品 id 需为数字");
        }
        final Integer id = parseId(idRaw);

        Agg agg = aggregate(viewerId, List.of(
                spec("product", false, () -> {
                    if (id == null) throw Errors.notFound("商品不存在");
                    return productService.detail(viewerId, id);
                }),
                spec("customContext", true, () -> {
                    if (id == null) throw Errors.notFound("商品不存在");
                    return customService.context(viewerId, id);
                })));

        Map<String, Object> product = asRecord(agg.values().get("product"));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(viewerId != null));
        if (product == null) {
            // 商品本身拉取失败：整体降级为 null 数据，交由前端展示「部分数据未加载」，不伪造业务结论
            data.put("product", null);
            data.put("creator", null);
            data.put("work", null);
            data.put("gallery", new ArrayList<>());
            data.put("window", null);
            Map<String, Object> materials = new LinkedHashMap<>();
            materials.put("pattern", new ArrayList<>());
            materials.put("model", new ArrayList<>());
            data.put("materials", materials);
            data.put("collection", null);
            data.put("custom", null);
            return agg.envelope(data);
        }

        List<Object> images = new ArrayList<>();
        for (Object o : asList(product.get("images"))) images.add(jsString(o));
        String cover = product.get("cover") == null ? "" : String.valueOf(product.get("cover"));
        LinkedHashSet<String> gallery = new LinkedHashSet<>();
        if (!cover.isEmpty()) gallery.add(cover);
        for (Object image : images) {
            String s = String.valueOf(image);
            if (!s.isEmpty()) gallery.add(s);
        }

        Map<String, Object> customRaw = asRecord(agg.values().get("customContext"));

        data.put("product", product);
        data.put("creator", normalizeCreator(product.get("creator")));
        data.put("work", product.get("work") == null ? null : product.get("work"));
        data.put("gallery", new ArrayList<>(gallery));
        data.put("window", product.get("window") == null ? null : product.get("window"));

        Map<String, Object> materials = new LinkedHashMap<>();
        materials.put("pattern", normalizeMaterial(asList(product.get("patternMatIds")),
                asList(product.get("patternMaterials"))));
        materials.put("model", normalizeMaterial(asList(product.get("modelMatIds")),
                asList(product.get("modelMaterials"))));
        data.put("materials", materials);

        /** 仅登录时给出（值来自 Java DTO 的 product.viewer） */
        if (viewerId == null) {
            data.put("collection", null);
        } else {
            Map<String, Object> viewerState = asRecord(product.get("viewer"));
            if (viewerState == null) {
                viewerState = new LinkedHashMap<>();
                viewerState.put("liked", false);
                viewerState.put("collected", false);
            }
            data.put("collection", viewerState);
        }
        data.put("custom", customBlock(customRaw));
        return agg.envelope(data);
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope creatorWorkbench(Integer viewerId, String poolLimitRaw) {
        int poolLimit = queryInt(poolLimitRaw, 5, 1, 20);

        Agg agg = aggregate(viewerId, List.of(
                spec("overview", true, () -> creatorService.overview(viewerId)),
                spec("pool", true, () -> poolService.creatorPool(viewerId, "1", String.valueOf(poolLimit))),
                spec("windowDraft", true, () -> windowService.list(viewerId, "draft")),
                spec("notifications", true,
                        () -> notificationService.list(viewerId, "1", null, "1", "1"))));

        Map<String, Object> overview = asRecord(agg.values().get("overview"));
        Map<String, Object> pool = pageOf(agg.values().get("pool"), 1, poolLimit);
        Map<String, Object> poolRaw = asRecord(agg.values().get("pool"));
        Map<String, Object> windowDraft = asRecord(agg.values().get("windowDraft"));
        Map<String, Object> notifications = asRecord(agg.values().get("notifications"));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(viewerId != null));
        data.put("overview", agg.values().get("overview"));
        /** overview 里的待办/计数/KPI 直接透传，BFF 不重新计算 */
        data.put("todo", overview == null || overview.get("todo") == null ? new ArrayList<>() : overview.get("todo"));
        data.put("counts", overview == null ? null : overview.get("counts"));
        data.put("kpi", overview == null ? null : overview.get("kpi"));

        Map<String, Object> poolOut = new LinkedHashMap<>();
        poolOut.put("list", pool.get("list"));
        poolOut.put("total", pool.get("total"));
        poolOut.put("meta", poolRaw == null ? null : poolRaw.get("meta"));
        data.put("pool", poolOut);

        Map<String, Object> draftOut = new LinkedHashMap<>();
        draftOut.put("list", windowDraft == null || !(windowDraft.get("list") instanceof List)
                ? new ArrayList<>() : windowDraft.get("list"));
        draftOut.put("total", numberOrField(windowDraft, "total", 0));
        data.put("windowDraft", draftOut);

        data.put("unreadCount", numberOrField(notifications, "unreadCount", 0));
        return agg.envelope(data);
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope order(Integer viewerId, String idRaw) {
        if (idRaw == null || !idRaw.matches("\\d+")) {
            throw Errors.bad("BAD_REQUEST", "订单 id 需为数字");
        }
        final Integer id = parseId(idRaw);
        final Integer uid = viewerId;

        // 第一跳：订单（商品 id 只有订单里才有，故第二跳依赖第一跳）
        Upstream orderUpstream = runNow("order", () -> {
            if (uid == null) throw Errors.unauthorized("请先登录（POST /api/auth/login {userId} 获取 token）");
            if (id == null) throw Errors.notFound("订单不存在");
            return orderService.detail(uid, id);
        });
        Map<String, Object> orderData = asRecord(orderUpstream.data());
        String productId = orderData == null || orderData.get("productId") == null
                ? "" : String.valueOf(orderData.get("productId"));
        final Integer pid = productId.isEmpty() ? null : parseId(productId);

        Agg agg = aggregate(viewerId, List.of(
                prepared(orderUpstream),
                spec("product", false, () -> {
                    if (pid == null) throw fail("no-product-id");
                    return productService.detail(viewerId, pid);
                })));

        Map<String, Object> caught = asRecord(agg.values().get("order"));
        Map<String, Object> related = normalizeOrderProduct(agg.values().get("product"));
        if (related == null) related = normalizeOrderProduct(caught);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(viewerId != null));
        data.put("order", agg.values().get("order"));
        /** 订单里的商品快照（关联商品，字段裁剪后；下游商品不可用时回落订单自带字段） */
        data.put("product", related);
        data.put("awaitDelivery", normalizeLogistics(caught));
        /** 以下全部透传 Java 结论 */
        data.put("stage", caught == null ? null : caught.get("stage"));
        data.put("amounts", caught == null ? null : caught.get("amounts"));
        data.put("qcReport", caught == null ? null : caught.get("qcReport"));
        data.put("returnReq", caught == null ? null : caught.get("returnReq"));
        data.put("timeline", caught == null || !(caught.get("timeline") instanceof List)
                ? new ArrayList<>() : caught.get("timeline"));
        data.put("can", caught == null ? null : caught.get("can"));
        return agg.envelope(data);
    }

    @Override
    @Transactional(readOnly = true)
    public Envelope me(Integer viewerId, String orderLimitRaw, String notificationLimitRaw) {
        int orderLimit = queryInt(orderLimitRaw, 3, 1, 20);
        int notificationLimit = queryInt(notificationLimitRaw, 5, 1, 20);

        Agg agg = aggregate(viewerId, List.of(
                spec("me", true, () -> authService.meAggregate(viewerId)),
                spec("orders", true, () -> orderService.mine(viewerId, null, "1", String.valueOf(orderLimit))),
                spec("notifications", true, () -> notificationService.list(
                        viewerId, null, null, "1", String.valueOf(notificationLimit))),
                spec("works", true, () -> workService.mine(viewerId)),
                // 收藏总数：直接读领域数据（User.collectProductIds），不伪造、也不依赖不存在的下游接口
                spec("collections", true, () -> {
                    Map<String, Object> out = new LinkedHashMap<>();
                    out.put("total", collectedCount(viewerId));
                    return out;
                })));

        if (viewerId == null) {
            Map<String, Object> guest = new LinkedHashMap<>();
            guest.put("viewer", viewer(false));
            guest.put("me", null);
            return agg.envelope(guest);
        }

        Map<String, Object> me = asRecord(agg.values().get("me"));
        Map<String, Object> meUser = me == null ? null : asRecord(me.get("user"));
        Map<String, Object> meStats = me == null ? null : asRecord(me.get("stats"));
        Map<String, Object> orders = pageOf(agg.values().get("orders"), 1, orderLimit);
        Map<String, Object> notifications = asRecord(agg.values().get("notifications"));
        Map<String, Object> works = pageOf(agg.values().get("works"), 1, 0);
        Map<String, Object> collections = asRecord(agg.values().get("collections"));

        Map<String, Object> stats = new LinkedHashMap<>();
        // 优先取 stats 子对象，缺省回退到用户公开资料（BFF 的字段标准化职责，不做任何业务计算）
        stats.put("followers", firstNonNull(field(meStats, "followers"), field(meUser, "followers")));
        stats.put("following", firstNonNull(field(meStats, "following"), field(meUser, "following")));
        stats.put("likesGot", firstNonNull(field(meStats, "likesGot"), field(meUser, "likesGot")));
        stats.put("works", meStats != null && meStats.get("works") != null ? meStats.get("works") : works.get("total"));
        if (collections != null) {
            stats.put("collected", numberOrField(collections,
                    collections.containsKey("total") ? "total" : "count", 0));
        } else {
            stats.put("collected", field(meStats, "collected"));
        }
        stats.put("notifications", numberOrField(notifications, "unreadCount", 0));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("viewer", viewer(true));
        data.put("me", agg.values().get("me"));
        data.put("user", meUser);
        data.put("unread", numberOrField(me, "unread", 0));
        data.put("orderCounts", me == null ? null : me.get("orderCounts"));
        data.put("creator", me == null ? null : me.get("creator"));
        data.put("cartCount", numberOrField(me, "cartCount", 0));
        data.put("stats", stats);

        Map<String, Object> recentOrders = new LinkedHashMap<>();
        recentOrders.put("list", orders.get("list"));
        recentOrders.put("total", orders.get("total"));
        recentOrders.put("page", orders.get("page"));
        recentOrders.put("pageSize", orders.get("pageSize"));
        data.put("recentOrders", recentOrders);

        Map<String, Object> notificationsOut = new LinkedHashMap<>();
        notificationsOut.put("list", notifications == null || !(notifications.get("list") instanceof List)
                ? new ArrayList<>() : notifications.get("list"));
        notificationsOut.put("total", numberOrField(notifications, "total", 0));
        notificationsOut.put("unreadCount", numberOrField(notifications, "unreadCount", 0));
        data.put("notifications", notificationsOut);

        Map<String, Object> worksOut = new LinkedHashMap<>();
        worksOut.put("list", works.get("list"));
        worksOut.put("total", works.get("total"));
        data.put("works", worksOut);
        return agg.envelope(data);
    }

    /* =============================== 字段裁剪 =============================== */

    /** 商城列表项字段裁剪（与前端消费字段一致）；缺失键省略、显式 null 保留。 */
    private static Map<String, Object> normalizeMallProduct(Object item) {
        Map<String, Object> src = asRecord(item);
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("id", "title", "cover", "price", "baseFee", "category",
                "styleTags", "sales", "views", "hasCustom", "creator")) {
            copyIfPresent(out, src, key);
        }
        return out;
    }

    /** 二手挂单字段裁剪。 */
    private static Map<String, Object> normalizeResale(Object item) {
        Map<String, Object> src = asRecord(item);
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("id", "orderId", "productId", "originalTitle", "photo", "sizeLabel",
                "listPrice", "originalPrice", "platformFeeRate", "netEstimate", "status", "sellerId", "createdAt")) {
            copyIfPresent(out, src, key);
        }
        return out;
    }

    /** 分类聚合：页内计数 + 下游纯名称数组补齐。 */
    private static List<Map<String, Object>> buildCategories(List<Object> products, List<Object> upstreamCategories) {
        Map<String, Integer> buckets = new LinkedHashMap<>();
        for (Object name : upstreamCategories) {
            String key = jsString(name);
            if (key.isEmpty()) continue;
            buckets.putIfAbsent(key, 0);
        }
        for (Object item : products) {
            Map<String, Object> rec = asRecord(item);
            Object raw = rec == null ? null : rec.get("category");
            String name = raw == null ? "" : String.valueOf(raw);
            if (name.isEmpty()) continue;
            buckets.merge(name, 1, Integer::sum);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map.Entry<String, Integer> e : buckets.entrySet()) {
            Map<String, Object> bucket = new LinkedHashMap<>();
            bucket.put("name", e.getKey());
            bucket.put("count", e.getValue());
            out.add(bucket);
        }
        return out;
    }

    private static Map<String, Object> normalizeCreator(Object raw) {
        Map<String, Object> rec = asRecord(raw);
        if (rec == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("id", "nickname", "avatar", "followers")) {
            copyIfPresent(out, rec, key);
        }
        return out;
    }

    /** ids + briefs 合成统一素材形状：{@code {id, kind, fileName, cover}}（cover 仅在上游存在时给出）。 */
    private static List<Map<String, Object>> normalizeMaterial(List<Object> ids, List<Object> briefs) {
        Map<Long, Map<String, Object>> byId = new HashMap<>();
        for (Object item : briefs) {
            Map<String, Object> rec = asRecord(item);
            if (rec != null && rec.get("id") != null) byId.put(((Number) rec.get("id")).longValue(), rec);
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object id : ids) {
            Map<String, Object> rec = id == null ? null : byId.get(((Number) id).longValue());
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", id);
            m.put("kind", rec == null || rec.get("kind") == null ? "" : String.valueOf(rec.get("kind")));
            m.put("fileName", rec == null || rec.get("fileName") == null ? "" : String.valueOf(rec.get("fileName")));
            if (rec != null) m.put("cover", rec.get("cover"));
            out.add(m);
        }
        return out;
    }

    /** 定制上下文裁剪：只取前端消费字段（AI/业务结论来自 Java，不在 BFF 侧生成）。 */
    private static Map<String, Object> customBlock(Map<String, Object> custom) {
        if (custom == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("sizeChart", asList(custom.get("sizeChart")));
        Map<String, Object> ease = asRecord(custom.get("easeTemplate"));
        out.put("easeTemplate", ease == null ? new LinkedHashMap<String, Object>() : ease);
        out.put("easeExplain", custom.get("easeExplain") == null ? null : custom.get("easeExplain"));
        out.put("baseFeeNote", custom.get("baseFeeNote") == null ? null : custom.get("baseFeeNote"));
        out.put("myBody", custom.get("myBody") == null ? null : custom.get("myBody"));
        out.put("product", custom.get("product") == null ? null : custom.get("product"));
        return out;
    }

    /** 关联商品裁剪（缺键省略、显式 null 保留；creator 恒存在，缺失时为 null）。 */
    private static Map<String, Object> normalizeOrderProduct(Object raw) {
        Map<String, Object> rec = asRecord(raw);
        if (rec == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        for (String key : List.of("id", "title", "cover", "price", "baseFee", "category",
                "styleTags", "status", "hasCustom")) {
            copyIfPresent(out, rec, key);
        }
        out.put("creator", rec.get("creator"));
        return out;
    }

    /** 物流/阶段字段整理：只挑下游已存在的字段，不做任何时间或状态推断。 */
    private static Map<String, Object> normalizeLogistics(Map<String, Object> order) {
        if (order == null) return null;
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("no", order.get("no"));
        out.put("status", order.get("status"));
        out.put("paidAt", order.get("paidAt"));
        out.put("shippedAt", order.get("shippedAt"));
        out.put("receivedAt", order.get("receivedAt"));
        Map<String, Object> logistics = asRecord(order.get("logistics"));
        if (logistics != null) {
            out.put("company", logistics.get("company"));
            out.put("trackingNo", logistics.get("trackingNo"));
            out.put("traces", logistics.get("traces") instanceof List ? logistics.get("traces") : new ArrayList<>());
        }
        return out;
    }

    /** 我的收藏数：以领域数据为准（与 /api/products/{id}/like 写入的 collectProductIds 同源）。 */
    private int collectedCount(Integer viewerId) {
        if (viewerId == null) return 0;
        User u = userRepository.findById(viewerId).orElse(null);
        return u == null || u.collectProductIds == null ? 0 : u.collectProductIds.size();
    }

    /* =============================== 聚合基建 =============================== */

    /** 一个「下游块」：{@code requiresAuth=true} 时游客不执行（跳过、值为 null、不计入 degraded）。 */
    private record Spec(String name, boolean requiresAuth, Supplier<Object> call) {
    }

    /** 单个块的执行结果。 */
    private record Upstream(String name, boolean ok, long latencyMs, Object data, String error) {
    }

    /**
     * 一次聚合的结果：{@code values} 按块名索引 payload（失败/跳过为 null），
     * {@code bff} 是顶层元信息，{@code upstream} 保留完整结果。
     */
    private record Agg(Map<String, Object> values, Map<String, Object> bff, Map<String, Upstream> upstream) {

        Envelope envelope(Object data) {
            return Envelope.of(data, bff);
        }
    }

    private static Spec spec(String name, boolean requiresAuth, Supplier<Object> call) {
        return new Spec(name, requiresAuth, call);
    }

    /** 让某个块以指定 error 降级（等价原实现 {@code Promise.resolve({ok:false,error})} 的用法）。 */
    private static RuntimeException fail(String error) {
        return new BffFailure(error);
    }

    /** 把「已经执行过的块结果」包成 Spec：用于「先取订单、再按订单里的商品 id 取商品」这类依赖编排。 */
    private static Spec prepared(Upstream up) {
        return new Spec(up.name(), false, () -> {
            if (!up.ok()) throw new BffFailure(up.error() == null ? "failed" : up.error());
            return up.data();
        });
    }

    /** 在当前线程同步执行一个块并计时（依赖编排的第一跳用）。 */
    private static Upstream runNow(String name, Supplier<Object> call) {
        return run(new Spec(name, false, call));
    }

    /**
     * 并发聚合：任一块失败只把该字段降级为 null 并写入 {@code bff.degraded}，绝不整体 500。
     *
     * @param viewerId 当前登录用户（null = 游客）
     * @param specs    参与聚合的块，顺序即 {@code bff.upstreams} 的顺序
     */
    private Agg aggregate(Integer viewerId, List<Spec> specs) {
        List<Spec> active = new ArrayList<>();
        Set<Integer> activeIdx = new HashSet<>();
        for (int i = 0; i < specs.size(); i++) {
            Spec s = specs.get(i);
            if (s.requiresAuth() && viewerId == null) continue;
            active.add(s);
            activeIdx.add(i);
        }

        List<CompletableFuture<Upstream>> futures = new ArrayList<>(active.size());
        for (Spec s : active) {
            futures.add(CompletableFuture.supplyAsync(() -> run(s), AGG_POOL));
        }

        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < specs.size(); i++) {
            if (!activeIdx.contains(i)) values.put(specs.get(i).name(), null);
        }

        List<Map<String, Object>> upstreams = new ArrayList<>();
        List<String> degraded = new ArrayList<>();
        Map<String, Upstream> upstream = new LinkedHashMap<>();
        for (int i = 0; i < active.size(); i++) {
            Upstream r = await(futures.get(i), active.get(i));
            upstream.put(r.name(), r);
            values.put(r.name(), r.ok() ? r.data() : null);

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("name", r.name());
            meta.put("ok", r.ok());
            meta.put("latencyMs", r.latencyMs());
            upstreams.add(meta);
            if (!r.ok()) degraded.add(r.name());
        }

        Map<String, Object> bff = new LinkedHashMap<>();
        bff.put("computedAt", TimeUtil.nowIso());
        bff.put("upstreams", upstreams);
        bff.put("degraded", degraded);
        if (!degraded.isEmpty()) {
            log.warn("[bff] 部分数据块降级 degraded={}（前端可据此提示「部分数据未加载」）", degraded);
        }
        return new Agg(values, bff, upstream);
    }

    private static Upstream run(Spec spec) {
        long t0 = System.nanoTime();
        try {
            return new Upstream(spec.name(), true, elapsedMs(t0), spec.call().get(), null);
        } catch (Throwable e) {
            return new Upstream(spec.name(), false, elapsedMs(t0), null, errorOf(e));
        }
    }

    private static Upstream await(CompletableFuture<Upstream> future, Spec spec) {
        try {
            return future.join();
        } catch (Throwable e) {
            return new Upstream(spec.name(), false, 0L, null, errorOf(e));
        }
    }

    private static long elapsedMs(long t0) {
        return (System.nanoTime() - t0) / 1_000_000L;
    }

    private static String errorOf(Throwable e) {
        Throwable t = e;
        while ((t instanceof java.util.concurrent.CompletionException
                || t instanceof java.util.concurrent.ExecutionException) && t.getCause() != null) {
            t = t.getCause();
        }
        if (t instanceof BffFailure f) return f.code;
        if (t instanceof dreamweaver.common.ApiException a) return a.code();
        return t.getClass().getSimpleName();
    }

    /** 块失败（携带等价原实现的 error 字符串）。 */
    private static final class BffFailure extends RuntimeException {

        private final String code;

        BffFailure(String code) {
            super(code);
            this.code = code;
        }
    }

    /* =============================== 形状工具（无业务语义） =============================== */

    /** {@code {loggedIn}}：游客与登录的唯一区分口径。 */
    private static Map<String, Object> viewer(boolean loggedIn) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("loggedIn", loggedIn);
        return m;
    }

    /** 等价原实现的 asRecord：非对象（含数组/null）→ null。 */
    @SuppressWarnings("unchecked")
    private static Map<String, Object> asRecord(Object v) {
        return v instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    /** 等价原实现的 asList：非数组 → 空列表（永不为 null）。 */
    private static List<Object> asList(Object v) {
        return v instanceof List<?> l ? new ArrayList<Object>(l) : new ArrayList<>();
    }

    /**
     * 等价原实现的 pageOf：从下游分页体里抽出标准分页形状 + hasMore（纯算术，无业务判断）。
     * 缺省值为 {@code Number(x) || fallback}；{@code total} 非有限数时回落列表长度。
     */
    private static Map<String, Object> pageOf(Object value, int fallbackPage, int fallbackSize) {
        Map<String, Object> rec = asRecord(value);
        List<Object> list = rec == null ? new ArrayList<>() : asList(rec.get("list"));

        double p = fieldNumber(rec, "page");
        int page = Double.isFinite(p) && p != 0 ? (int) Math.floor(p) : fallbackPage;
        double ps = fieldNumber(rec, "pageSize");
        int pageSize = Double.isFinite(ps) && ps != 0 ? (int) Math.floor(ps)
                : (fallbackSize != 0 ? fallbackSize : list.size());
        double total = fieldNumber(rec, "total");
        int totalValue = Double.isFinite(total) ? (int) Math.floor(total) : list.size();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", list);
        out.put("total", totalValue);
        out.put("page", page);
        out.put("pageSize", pageSize);
        out.put("hasMore", pageSize > 0 && (long) page * pageSize < totalValue);
        return out;
    }

    /**
     * 字段裁剪：只有上游**确实存在**该键时才写入（保留原实现的「显式 null 保留、可选键省略」语义，
     * 即 JS 的 {@code undefined} → 键缺席、{@code null} → 值为 null）。
     */
    private static void copyIfPresent(Map<String, Object> out, Map<String, Object> src, String key) {
        if (src != null && src.containsKey(key)) out.put(key, src.get(key));
    }

    /** 等价原实现的 {@code numberOr(rec?.key, dft)}：键缺席（undefined）或非有限数 → dft。 */
    private static int numberOrField(Map<String, Object> rec, String key, int dft) {
        if (rec == null || !rec.containsKey(key)) return dft;
        double n = jsNumber(rec.get(key));
        return Double.isFinite(n) ? (int) Math.floor(n) : dft;
    }

    /** 查询参数 → 正整数（非法值回落 dflt，并夹在 [min,max]）。 */
    private static int queryInt(String raw, int dflt, int min, int max) {
        double n = raw == null || raw.isEmpty() ? dflt : jsNumber(raw);
        long v = Double.isFinite(n) ? (long) Math.floor(n) : dflt;
        return (int) Math.min(max, Math.max(min, v));
    }

    /** 查询参数 → string（缺失/空白返回 null，便于「等于未传」的透传语义）。 */
    private static String queryStr(String raw) {
        return raw == null || raw.isEmpty() ? null : raw;
    }

    /** 等价 JS {@code Number(v)}：null→0，""→0，非法→NaN。 */
    private static double jsNumber(Object v) {
        if (v == null) return 0;
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1 : 0;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return 0;
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
    }

    /** 键缺席（undefined）→ NaN；存在但为 null → 0（与 JS 的 Number 语义一致）。 */
    private static double fieldNumber(Map<String, Object> rec, String key) {
        if (rec == null || !rec.containsKey(key)) return Double.NaN;
        return jsNumber(rec.get(key));
    }

    /** 等价 JS {@code String(v)}（null → "null"）。 */
    private static String jsString(Object v) {
        return v == null ? "null" : String.valueOf(v);
    }

    private static Object firstNonNull(Object a, Object b) {
        return a != null ? a : b;
    }

    /** {@code rec?.key ?? null}：键缺席与显式 null 都产出 null（JSON 里都是 null）。 */
    private static Object field(Map<String, Object> rec, String key) {
        return rec == null ? null : rec.get(key);
    }

    /** 商品/订单 id：只接受能装进 int 的正整数；否则按「不存在」处理（等价下游 404 降级）。 */
    private static Integer parseId(String raw) {
        try {
            long v = Long.parseLong(raw);
            return v >= 0 && v <= Integer.MAX_VALUE ? (int) v : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /* =============================== 端点清单 =============================== */

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
