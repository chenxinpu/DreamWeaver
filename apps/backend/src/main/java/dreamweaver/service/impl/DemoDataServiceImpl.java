package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.AiDetail;
import dreamweaver.entity.AiSection;
import dreamweaver.entity.AppSettings;
import dreamweaver.entity.AuditLogItem;
import dreamweaver.entity.BodyMeasurement;
import dreamweaver.entity.CommentItem;
import dreamweaver.entity.CommissionRule;
import dreamweaver.entity.FabricPart;
import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.LogisticsInfo;
import dreamweaver.entity.LogisticsTrace;
import dreamweaver.entity.Material;
import dreamweaver.entity.MaterialKind;
import dreamweaver.entity.Notification;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderAmounts;
import dreamweaver.entity.OrderKind;
import dreamweaver.entity.OrderSpecUsed;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.OrderTimelineItem;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Post;
import dreamweaver.entity.Product;
import dreamweaver.entity.QcItem;
import dreamweaver.entity.QcReport;
import dreamweaver.entity.ResaleListing;
import dreamweaver.entity.ResaleStatus;
import dreamweaver.entity.ReturnReq;
import dreamweaver.entity.Role;
import dreamweaver.entity.SizeChartRow;
import dreamweaver.entity.User;
import dreamweaver.entity.ViewSeed;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowSpec;
import dreamweaver.entity.WindowStatus;
import dreamweaver.entity.Work;
import dreamweaver.parser.ParsedFields;
import dreamweaver.parser.ParsePayload;
import dreamweaver.parser.Parsers;
import dreamweaver.parser.SamplesProvider;
import dreamweaver.repository.AppSettingsRepository;
import dreamweaver.repository.CommentRepository;
import dreamweaver.repository.CommissionRuleRepository;
import dreamweaver.repository.LedgerEventRepository;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.NotificationRepository;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.ResaleListingRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.ViewSeedRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.DemoDataService;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.DoubleSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import javax.sql.DataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 演示数据播种实现：由原 JSON 文件库版 {@code store.SeedData} 移植而来，现走 JPA repository 落 MySQL。
 *
 * <p>逐字段等价移植（ITER_V2_SPEC §6），内容与原实现完全一致：
 *
 * <ul>
 *   <li>用户 1 小织(creator)/2 鹿屿Lu/3 云端裁缝铺/… /14 我的小号(consumer,预置体型)/99 审核专员</li>
 *   <li>samples/*.dxf|.obj|.svg 真实示例文件 → 程序解析入库为 creator1/2/3 素材</li>
 *   <li>creator1 今日推文 2 篇「差一点达标」+ 1 篇「高赞入池」；其他创作者今日推文 9 篇形成 P60</li>
 *   <li>已上架商品 4 件（含完整 aiDetail）+ 审核中 1 件 + 被拒 1 件</li>
 *   <li>过去 30 天订单/浏览/退款事件种子（BI 曲线）+ 二手挂单 + 已收货可退货定制订单</li>
 * </ul>
 *
 * <p>移植要点：
 *
 * <ol>
 *   <li><b>显式 id</b>：原 {@code N('xxx')} 自增计数器丢弃，改为每类一个本地计数器（{@code nextXxxId}），
 *       保持原 id 序列不变（用户 1/…/99、素材 1..16、作品 1..7、推文 1..19、评论 1..126、资源池 1..3、
 *       橱窗 1..6、商品 1..4、订单 1..135、二手 1..2、通知 1..23（清理后 15）、流水 1..58）。
 *       主键为 {@code Integer + @GeneratedValue(IDENTITY)}，赋予非 null id 后 {@code save()} 走 merge/insert，
 *       MySQL 会把 AUTO_INCREMENT 推到 max+1，后续新增不会撞 id。</li>
 *   <li><b>运行态镜像</b>：原实现依赖内存库 {@code db.*} 列表做跨表推导（views/sales 汇总、佣金结算、
 *       余额推演、素材文件名回填、资源池重复度），这里改为本次播种运行内的本地列表镜像，
 *       语义与遍历顺序与原实现一致。</li>
 *   <li><b>保存顺序</b>：先存被引用的（users / materials / works），再存引用它们的
 *       （posts / pool / windows / products / orders / resale / notifications / ledger / viewsByDay /
 *       commissionRules / appSettings）。{@code Post.comments} 走 {@code cascade = ALL}，随 Post 一起保存。</li>
 *   <li><b>清库顺序</b>：按外键依赖倒序 {@code deleteAll()}（comment → post → poolEntry → windowMaterial →
 *       product → order → resaleListing → ledgerEvent → notification → viewSeed → commissionRule →
 *       work → material → user → appSettings），每步 {@code flush()} 以保证 SQL 落库顺序。</li>
 *   <li><b>确定性</b>：与原实现一致使用 {@code MiscUtil.mulberry32(20260101)} 与
 *       {@code new Random(20260101L)}，每次播种运行重置，保证多次 reset 得到同一份演示数据
 *       （原实现 PRNG 为 module 级、跨多次 reset 连续，首次播种结果与本实现完全一致）。</li>
 *   <li><b>解析器</b>：原 {@code SeedData} 内联的 DXF/OBJ/SVG 精简解析已由 {@code parser} 包承接，
 *       这里注入 {@link Parsers} 调用 {@code parseByKind}；已逐字段比对，四个示例文件的
 *       layerNames / entityCount / patternSvg / objPreview / width / height / note / parseWarn 完全一致。</li>
 * </ol>
 */
@Service
public class DemoDataServiceImpl implements DemoDataService {

    private static final Logger log = LoggerFactory.getLogger(DemoDataServiceImpl.class);

    /* ==================== 持久层 ==================== */

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final WorkRepository workRepository;
    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ResaleListingRepository resaleListingRepository;
    private final NotificationRepository notificationRepository;
    private final CommissionRuleRepository commissionRuleRepository;
    private final LedgerEventRepository ledgerEventRepository;
    private final ViewSeedRepository viewSeedRepository;
    private final AppSettingsRepository appSettingsRepository;

    /** 文件解析组件（samples 的 DXF/OBJ/SVG 解析，等价原 SeedData 内联解析）。 */
    private final Parsers parsers;
    /** 示例文件提供者（生成 samples/ 示例文件供素材导入演示）。 */
    private final SamplesProvider samplesProvider;

    public DemoDataServiceImpl(UserRepository userRepository,
                               MaterialRepository materialRepository,
                               WorkRepository workRepository,
                               PostRepository postRepository,
                               CommentRepository commentRepository,
                               PoolEntryRepository poolEntryRepository,
                               WindowMaterialRepository windowMaterialRepository,
                               ProductRepository productRepository,
                               OrderRepository orderRepository,
                               ResaleListingRepository resaleListingRepository,
                               NotificationRepository notificationRepository,
                               CommissionRuleRepository commissionRuleRepository,
                               LedgerEventRepository ledgerEventRepository,
                               ViewSeedRepository viewSeedRepository,
                               AppSettingsRepository appSettingsRepository,
                               Parsers parsers,
                               SamplesProvider samplesProvider,
                                PlatformTransactionManager transactionManager,
                                DataSource dataSource) {
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
        this.workRepository = workRepository;
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.resaleListingRepository = resaleListingRepository;
        this.notificationRepository = notificationRepository;
        this.commissionRuleRepository = commissionRuleRepository;
        this.ledgerEventRepository = ledgerEventRepository;
        this.viewSeedRepository = viewSeedRepository;
        this.appSettingsRepository = appSettingsRepository;
        this.parsers = parsers;
        this.samplesProvider = samplesProvider;
        this.dataSource = dataSource;
        this.txTemplate = new TransactionTemplate(transactionManager);
        this.txTemplate.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
    }

    /* ==================== 常量：演示账号 / 图片 ==================== */

    private record DemoAccount(int id, String nickname, String avatar, int level, String role, String bio,
                               int followers, int following) {
    }

    private static final List<DemoAccount> DEMO_ACCOUNTS = List.of(
            new DemoAccount(1, "小织", "/images/avatar-01.jpg", 3, "creator", "独立设计师｜专注法式浪漫风", 128000, 236),
            new DemoAccount(2, "鹿屿Lu", "/images/avatar-02.jpg", 3, "creator", "主理人｜做有温度的衣服", 86200, 112),
            new DemoAccount(3, "云端裁缝铺", "/images/avatar-03.jpg", 2, "creator", "从打版师到设计师｜分享工艺细节", 45100, 328),
            new DemoAccount(4, "莓莓酱", "/images/avatar-04.jpg", 1, "creator", "设计学徒学习中～", 8900, 1204),
            new DemoAccount(5, "Ginger阿姜", "/images/avatar-05.jpg", 2, "creator", "复古工装爱好者", 22300, 465),
            new DemoAccount(6, "山茶与猫", "/images/avatar-06.jpg", 1, "consumer", "记录穿搭灵感", 5600, 890),
            new DemoAccount(7, "四月的裙子", "/images/avatar-07.jpg", 0, "consumer", "四月到了就想穿裙子", 1200, 356),
            new DemoAccount(8, "木棉设计工作室", "/images/avatar-08.jpg", 3, "creator", "木棉棉麻 · 东方美学", 156000, 89),
            new DemoAccount(9, "眠眠兔", "/images/avatar-09.jpg", 1, "creator", "软妹风设计师", 18700, 632),
            new DemoAccount(10, "针织日记", "/images/avatar-10.jpg", 2, "creator", "手织毛衫的温度", 33400, 214),
            new DemoAccount(11, "Momo莫莫", "/images/avatar-11.jpg", 0, "consumer", "求推荐通勤穿搭！", 860, 458),
            new DemoAccount(12, "丝语Silk", "/images/avatar-12.jpg", 2, "creator", "真丝面料研究员", 41200, 178),
            new DemoAccount(13, "青禾定制", "/images/avatar-13.jpg", 3, "creator", "轻定制西装｜一人一版", 97400, 96),
            new DemoAccount(14, "我的小号", "/images/avatar-14.jpg", 0, "consumer", "", 12, 108),
            new DemoAccount(15, "小岛花事", "/images/avatar-15.jpg", 1, "creator", "碎花爱好者", 7300, 556),
            new DemoAccount(16, "白鹭Ling", "/images/avatar-16.jpg", 2, "creator", "极简通勤｜白衬衫狂魔", 28900, 302),
            new DemoAccount(17, "碎星", "/images/avatar-17.jpg", 1, "creator", "正在学打版", 4200, 733),
            new DemoAccount(18, "凉拌冰沙", "/images/avatar-18.jpg", 0, "consumer", "观望中…", 90, 210),
            new DemoAccount(99, "平台审核专员", "/images/avatar-05.jpg", 0, "auditor", "织梦平台内容审核 · 橱窗材料复核", 0, 0));

    private static final Map<Integer, List<Integer>> FOLLOWS_SEED = buildFollowsSeed();

    private static Map<Integer, List<Integer>> buildFollowsSeed() {
        Map<Integer, List<Integer>> m = new LinkedHashMap<>();
        m.put(1, List.of(2, 3, 12));
        m.put(2, List.of(1, 3, 12));
        m.put(3, List.of(1, 2, 12));
        m.put(4, List.of(1, 3, 9));
        m.put(5, List.of(1, 16));
        m.put(6, List.of(1, 3));
        m.put(7, List.of(1, 2));
        m.put(8, List.of(1, 2));
        m.put(9, List.of(1, 3));
        m.put(10, List.of(1, 3));
        m.put(11, List.of(1, 2, 3, 5, 9, 10, 16));
        m.put(12, List.of(1, 3));
        m.put(13, List.of(1));
        m.put(14, List.of(1, 2, 3, 5, 10, 16));
        m.put(15, List.of(1, 9));
        m.put(16, List.of(1, 2));
        m.put(17, List.of(3, 12));
        m.put(18, List.of(1, 2, 3, 4, 5, 9, 10, 12, 15, 16));
        m.put(99, List.of());
        return m;
    }

    /** 评论语料（顺序即随机取样池，改动会改变演示数据）。 */
    private static final List<String> COMMENTS_POOL = List.of(
            "救命！这也太好看了吧😍", "请问会显肩宽吗？", "蹲一个价格！", "面料质感看起来很好",
            "已收藏，等上架～", "这种版型对梨形友好吗", "太仙了吧", "想看更多细节图！",
            "夏天穿一定很凉快", "能不能出短款呀", "已下单！期待", "返图来了，绝绝子",
            "同款不同色会补货吗", "版型数据在哪里看", "可以私人定制吗", "超喜欢这个配色",
            "求生产周期", "腰带是送的嘛", "怎么清洗呀", "冲了冲了",
            "太适合通勤了", "这个领口太显瘦了");

    /** 原实现中声明但未使用（保留以免误删语义）。 */
    @SuppressWarnings("unused")
    private static final List<String> SIZES = List.of("XS", "S", "M", "L", "XL");

    private static final List<Integer> CONSUMERS = List.of(6, 7, 11, 14, 18);
    private static final List<String> DIRECT_SIZES = List.of("S", "M", "L");
    private static final List<String> CHANNELS = List.of("广场推荐", "商城分类", "搜索", "分享", "创作者推荐");

    private static final String MFG = "织梦柔性智造工厂 · 华东1号";

    private static final Map<String, String> CAT_CN = buildCatCn();

    private static Map<String, String> buildCatCn() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("连衣裙", "连衣裙");
        m.put("衬衫", "衬衫");
        m.put("半裙", "半裙");
        m.put("外套", "外套");
        m.put("裤装", "裤装");
        m.put("套装", "套装");
        return m;
    }

    /* ==================== 运行态（每次播种运行重建） ==================== */

    /** 与原实现一致的确定性伪随机（每次播种运行重置，保证 reset 可复现）。 */
    private DoubleSupplier random = MiscUtil.mulberry32(20260101);

    /** 原实现里 Math.random() 的位置（hourOf 的分钟抖动）：用固定种子保证可复现。 */
    private Random jsRandom = new Random(20260101L);

    /* 本次播种运行的内存镜像（等价原 Db 的各个列表），用于跨表推导与引用。 */
    private Map<Integer, User> usersById;
    private List<User> users;
    private List<Material> materials;
    private List<Work> works;
    private List<Post> posts;
    private List<PoolEntry> pool;
    private List<WindowMaterial> windows;
    private List<Product> products;
    private List<Order> orders;
    private List<ResaleListing> resale;
    private List<Notification> notifications;
    private List<CommissionRule> commissionRules;
    private List<LedgerEvent> ledger;
    private List<ViewSeed> viewsByDay;

    /* 原 N('xxx') 自增计数器的替代：每类显式 id 计数器（初值 0，先自增再赋值，等价原 nextId 语义）。 */
    private int nextMaterialId;
    private int nextWorkId;
    private int nextPostId;
    private int nextCommentId;
    private int nextPoolId;
    private int nextWindowId;
    private int nextProductId;
    private int nextOrderId;
    private int nextResaleId;
    private int nextNotificationId;
    private int nextLedgerId;

    private Map<String, Long> sampleSizes;
    private BodyMeasurement body14;
    private int orderCursor;

    // 素材引用（seed 内部使用）
    private Material m1DressPattern;
    private Material m1ShirtPattern;
    private Material m1DressObj;
    private Material m2Pattern;
    private Material m2Obj;
    private Material m3Pattern;
    private Material m3Obj;

    /* ==================== 入口 ==================== */

    /**
     * 库为空时播种演示数据；已有数据则跳过。返回是否真正执行了播种。
     *
     * <p>由原 JSON 文件库版 SeedData 移植而来，现走 JPA repository 落 MySQL。
     */
    /** 清表用原生 JDBC（autocommit）：TRUNCATE 是 DDL，不能放在 JPA 事务里执行。 */
    private final DataSource dataSource;

    /** 播种用独立事务模板：与清表阶段的 DDL 分开，各走各的事务。 */
    private final TransactionTemplate txTemplate;

    @Override
    public synchronized boolean ensureSeeded() {
        if (userRepository.count() > 0) {
            log.info("[seed] 检测到已有业务数据，跳过演示数据播种");
            return false;
        }
        txTemplate.executeWithoutResult(status -> seedAll());
        return true;
    }

    /**
     * 清空所有业务表并重新播种（对应原 {@code POST /api/dev/reset}）。返回是否播种。
     *
     * <p>由原 JSON 文件库版 SeedData 移植而来，现走 JPA repository 落 MySQL。
     *
     * @param seed {@code true} 清空后重新播种；{@code false} 仅清空
     */
    @Override
    public synchronized boolean reset(boolean seed) {
        clearAll();
        if (!seed) {
            log.info("[seed] 已清空全部业务表（seed=false）");
            return false;
        }
        txTemplate.executeWithoutResult(status -> seedAll());
        return true;
    }

    /**
     * 清空全部业务表。
     *
     * <p>用 {@code TRUNCATE} 而不是 {@code deleteAll()}：MySQL 的 {@code DELETE} **不会重置 AUTO_INCREMENT**，
     * 重新播种后主键会从上次的最大值继续（例如商品变成 id 6..9），破坏演示契约
     * （前端与回归脚本引用固定的 {@code /mall/product/1}、{@code /mall/orders/134}）。
     * {@code TRUNCATE} 会把自增计数复位到 1，使每次 reset 后的 id 序列与首次播种完全一致。
     *
     * <p>TRUNCATE 属于 DDL（隐式提交）且有外键依赖，故临时关闭外键检查；表清单从
     * information_schema 动态读取，避免新增实体后遗漏。
     */
    private void clearAll() {
        try (Connection conn = dataSource.getConnection()) {
            boolean originalAutoCommit = conn.getAutoCommit();
            conn.setAutoCommit(true);
            try (Statement st = conn.createStatement()) {
                st.execute("SET FOREIGN_KEY_CHECKS = 0");
                List<String> tables = new ArrayList<>();
                try (ResultSet rs = st.executeQuery(
                        "SELECT TABLE_NAME FROM information_schema.TABLES "
                                + "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME LIKE 'dw\\_%'")) {
                    while (rs.next()) tables.add(rs.getString(1));
                }
                for (String t : tables) {
                    st.execute("TRUNCATE TABLE `" + t + "`");
                }
                st.execute("SET FOREIGN_KEY_CHECKS = 1");
                log.info("[seed] 已 TRUNCATE {} 张表（自增计数同步复位）", tables.size());
            } finally {
                conn.setAutoCommit(originalAutoCommit);
            }
        } catch (SQLException e) {
            throw new IllegalStateException("清空业务表失败：" + e.getMessage(), e);
        }
    }

    /** 旧的按外键依赖倒序 deleteAll 实现（保留备用，当前不被调用）。 */
    @SuppressWarnings("unused")
    private void clearAllByDelete() {
        commentRepository.deleteAll();
        commentRepository.flush();
        postRepository.deleteAll();
        postRepository.flush();
        poolEntryRepository.deleteAll();
        poolEntryRepository.flush();
        windowMaterialRepository.deleteAll();
        windowMaterialRepository.flush();
        productRepository.deleteAll();
        productRepository.flush();
        orderRepository.deleteAll();
        orderRepository.flush();
        resaleListingRepository.deleteAll();
        resaleListingRepository.flush();
        ledgerEventRepository.deleteAll();
        ledgerEventRepository.flush();
        notificationRepository.deleteAll();
        notificationRepository.flush();
        viewSeedRepository.deleteAll();
        viewSeedRepository.flush();
        commissionRuleRepository.deleteAll();
        commissionRuleRepository.flush();
        workRepository.deleteAll();
        workRepository.flush();
        materialRepository.deleteAll();
        materialRepository.flush();
        userRepository.deleteAll();
        userRepository.flush();
        appSettingsRepository.deleteAll();
        appSettingsRepository.flush();
    }

    /** 全量播种（等价原 {@code SeedData.build()}）。 */
    private void seedAll() {
        // 运行态重置（等价原 SeedData 每次 build() 重置的字段 + 固定随机种子）
        this.random = MiscUtil.mulberry32(20260101);
        this.jsRandom = new Random(20260101L);
        this.usersById = new LinkedHashMap<>();
        this.users = new ArrayList<>();
        this.materials = new ArrayList<>();
        this.works = new ArrayList<>();
        this.posts = new ArrayList<>();
        this.pool = new ArrayList<>();
        this.windows = new ArrayList<>();
        this.products = new ArrayList<>();
        this.orders = new ArrayList<>();
        this.resale = new ArrayList<>();
        this.notifications = new ArrayList<>();
        this.commissionRules = new ArrayList<>();
        this.ledger = new ArrayList<>();
        this.viewsByDay = new ArrayList<>();
        this.sampleSizes = new LinkedHashMap<>();
        this.nextMaterialId = 0;
        this.nextWorkId = 0;
        this.nextPostId = 0;
        this.nextCommentId = 0;
        this.nextPoolId = 0;
        this.nextWindowId = 0;
        this.nextProductId = 0;
        this.nextOrderId = 0;
        this.nextResaleId = 0;
        this.nextNotificationId = 0;
        this.nextLedgerId = 0;
        this.orderCursor = 0;

        seedUsers();
        userRepository.saveAll(users);

        seedMaterials();
        materialRepository.saveAll(materials);

        // ---- 作品 ----
        List<Work> seededWorks = seedWorks();
        workRepository.saveAll(works);

        /* ---------- 推文 ---------- */
        List<Post> seededPosts = seedPosts(seededWorks);
        postRepository.saveAll(posts);

        /* ---------- 资源池（历史条目直接入池；今日的由引擎评估产生） ---------- */
        addPool(seededPosts.get(0).id, seededWorks.get(0).id, 1, 13, "点赞超过当日P60 / 评论数≥10", 680, 3420, 12);
        addPool(seededPosts.get(1).id, seededWorks.get(1).id, 1, 6, "点赞超过当日P60", 540, 2310, 8);
        addPool(seededPosts.get(14).id, seededWorks.get(5).id, 2, 10, "点赞超过当日P60", 480, 1660, 6);
        poolEntryRepository.saveAll(pool);

        /* ---------- 橱窗与商品（通过审核引擎生成 AI 详情） ---------- */
        List<Product> seededProducts = seedWindowsAndProducts(seededWorks);
        windowMaterialRepository.saveAll(windows);

        /* ---------- 过去 30 天浏览/订单/退货事件种子 ---------- */
        seedOrdersAndViews(seededProducts);
        viewSeedRepository.saveAll(viewsByDay);

        /* ---------- 展示用订单 + 二手挂单 ---------- */
        Order featOrder = addFeaturedOrder(seededProducts.get(0));
        addReturnOrder(seededProducts.get(0), seededProducts.get(1), featOrder);
        orderRepository.saveAll(orders);
        resaleListingRepository.saveAll(resale);

        /* ---------- 汇总统计：商品 views/sales ---------- */
        Product p1 = seededProducts.get(0);
        Product p2 = seededProducts.get(1);
        Product p2c = seededProducts.get(2);
        Product p3c = seededProducts.get(3);
        for (Product prod : List.of(p1, p2)) {
            int views = 0;
            for (ViewSeed v : viewsByDay) {
                if (prod.id != null && v.productId == prod.id) views += v.count;
            }
            prod.views = views;
            int sales = 0;
            for (Order o : orders) {
                if (prod.id != null && o.productId == prod.id
                        && o.status != OrderStatus.CREATED && o.status != OrderStatus.CANCELLED) sales++;
            }
            prod.sales = sales;
        }
        p2c.views = 3600;
        p2c.sales = 8;
        p3c.views = 2100;
        p3c.sales = 5;
        productRepository.saveAll(products);

        /* ---------- 通知种子 ---------- */
        seedNotifications(seededWorks.get(3).id, seededProducts, featOrder);

        /* ---------- 佣金规则（展示） ---------- */
        seedCommissionRules();
        commissionRuleRepository.saveAll(commissionRules);

        /* ---------- 资金流水（佣金/历史提现演示） ---------- */
        ledger(1, "withdraw", -6000, "WD-hist-01");
        ledger(1, "withdraw", -4500, "WD-hist-02");

        /* ---------- 设定 ---------- */
        AppSettings settings = new AppSettings();
        settings.id = 1;
        settings.seedVersion = 2;
        appSettingsRepository.save(settings);

        /* ---------- 收尾：清理引擎造数据产生的"当前时刻"噪音通知，避免与手工种子重复 ---------- */
        final long cut = System.currentTimeMillis() - 180000L;
        notifications.removeIf(n -> {
            Long ts = MiscUtil.parseTs(n.createdAt);
            return (ts == null ? 0L : ts) >= cut;
        });
        notificationRepository.saveAll(notifications);

        // 佣金按到期规则结算（幂等写 commission_settle 流水，让「已结算/可提现」有数据）
        try {
            settleDueCommissions();
        } catch (Exception e) {
            log.warn("[seed] 佣金结算演示失败（可忽略）", e);
        }
        ledgerEventRepository.saveAll(ledger);

        log.info("[seed] ✅ 演示数据已生成：users={} materials={} works={} posts={} pool={} products={} windows={} "
                        + "orders={} resale={} notifs={} ledger={}",
                users.size(), materials.size(), works.size(), posts.size(), pool.size(),
                products.size(), windows.size(), orders.size(), resale.size(),
                notifications.size(), ledger.size());
    }

    /* ==================== 用户 / 素材 / 作品 ==================== */

    private void seedUsers() {
        body14 = new BodyMeasurement();
        body14.height = 163;
        body14.weight = 52;
        body14.bust = 84;
        body14.underBust = 74;
        body14.waist = 64;
        body14.hip = 90;
        body14.shoulderWidth = 38;
        body14.armLength = 54;
        body14.thigh = 51;
        body14.calf = 34;
        body14.neck = 33;
        body14.backLength = 39;
        body14.source = "manual";
        body14.updatedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(3));

        for (DemoAccount a : DEMO_ACCOUNTS) {
            User u = new User();
            u.id = a.id();
            u.nickname = a.nickname();
            u.avatar = a.avatar();
            u.bio = a.bio();
            u.role = Role.of(a.role());
            u.level = a.level();
            u.followers = a.followers();
            u.following = a.following();
            u.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(120 + a.id() * 3));
            u.follows = new ArrayList<>(FOLLOWS_SEED.getOrDefault(a.id(), List.of()));
            // 原实现的 User 没有这两个键（既不是 null 也不是空数组），NON_NULL 序列化下必须省略
            u.collectProductIds = null;
            u.collectPostIds = null;
            if (a.id() == 14) u.body = body14;
            usersById.put(a.id(), u);
            users.add(u);
        }
    }

    /** samples 真实文件 → 素材库。 */
    private void seedMaterials() {
        List<SamplesProvider.SampleFile> files = samplesProvider.ensure();
        if (files != null) {
            for (SamplesProvider.SampleFile f : files) {
                if (f == null || f.fileName == null) continue;
                sampleSizes.put(f.fileName, f.size);
            }
        }
        String dxfFront = readSample("dress-front-pattern.dxf");
        String dxfShirt = readSample("shirt-front.dxf");
        String objDress = readSample("dress.obj");
        String svgFloral = readSample("floral-print.svg");

        // creator1 素材
        Material m1DressPattern = addParsedMaterial(1, "法式连衣裙 · 前片打版(DXF)", "dress-front-pattern.dxf", "dxf", dxfFront, List.of("连衣裙", "打版", "前片"));
        Material m1ShirtPattern = addParsedMaterial(1, "泡泡纱衬衫 · 前片打版(DXF)", "shirt-front.dxf", "dxf", dxfShirt, List.of("衬衫", "打版"));
        Material m1DressObj = addParsedMaterial(1, "法式连衣裙 · 3D 网格(OBJ)", "dress.obj", "obj", objDress, List.of("连衣裙", "3D"));
        addParsedMaterial(1, "花间集 · 碎花印花(SVG)", "floral-print.svg", "svg", svgFloral, List.of("印花", "碎花"));
        addImageMaterial(1, "连衣裙真人穿搭 1", "/images/style-01.jpg", List.of("穿搭"), 89000);
        addImageMaterial(1, "连衣裙真人穿搭 2", "/images/style-05.jpg", List.of("穿搭"), 88000);
        addImageMaterial(1, "面料细节 · 真丝", "/images/fabric-03.jpg", List.of("面料"), 64000);
        addImageMaterial(1, "成衣平铺图", "/images/dress-01.jpg", List.of("成衣"), 92000);
        // creator2 素材（大衣）
        Material m2Pattern = addParsedMaterial(2, "雾色大衣 · 前片打版(DXF)", "shirt-front.dxf", "dxf", dxfShirt, List.of("外套", "打版"));
        Material m2Obj = addParsedMaterial(2, "雾色大衣 · 3D 网格(OBJ)", "dress.obj", "obj", objDress, List.of("外套", "3D"));
        addImageMaterial(2, "大衣真人穿搭", "/images/style-03.jpg", List.of("穿搭"), 87000);
        addImageMaterial(2, "大衣成衣", "/images/coat-02.jpg", List.of("成衣"), 96000);
        // creator3 素材
        Material m3Pattern = addParsedMaterial(3, "泡泡纱衬衫 · 前片(DXF)", "shirt-front.dxf", "dxf", dxfShirt, List.of("衬衫", "打版"));
        Material m3Obj = addParsedMaterial(3, "衬衫 3D(OBJ)", "dress.obj", "obj", objDress, List.of("衬衫", "3D"));
        addImageMaterial(3, "衬衫真人上身", "/images/style-08.jpg", List.of("穿搭"), 78000);
        addImageMaterial(3, "泡泡纱衬衫", "/images/blouse-02.jpg", List.of("成衣"), 90000);

        // 记录给后续作品/橱窗使用（与原实现的局部常量一致）
        this.m1DressPattern = m1DressPattern;
        this.m1ShirtPattern = m1ShirtPattern;
        this.m1DressObj = m1DressObj;
        this.m2Pattern = m2Pattern;
        this.m2Obj = m2Obj;
        this.m3Pattern = m3Pattern;
        this.m3Obj = m3Obj;
    }

    private static final class WorkOpts {
        int creatorId;
        String title;
        String category;
        List<String> styleTags = List.of();
        String fabric;
        String desc;
        String cover;
        List<Integer> patternMatIds;
        List<Integer> modelMatIds;
        List<String> mediaImages;
        long createdAtTs;
    }

    private List<Work> seedWorks() {
        WorkOpts o = new WorkOpts();
        o.creatorId = 1;
        o.title = "法式碎花泡泡袖连衣裙";
        o.category = "连衣裙";
        o.styleTags = List.of("法式", "碎花", "泡泡袖");
        o.fabric = "100% 真丝";
        o.desc = "灵感来自南法仲夏花园，细密碎花与复古泡泡袖结合，收腰显瘦。";
        o.cover = "/images/dress-01.jpg";
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.mediaImages = List.of("/images/dress-01.jpg", "/images/style-01.jpg", "/images/style-05.jpg");
        o.createdAtTs = TimeUtil.daysAgo(40);
        Work w1 = addWork(o);

        o = new WorkOpts();
        o.creatorId = 1;
        o.title = "微醺玫瑰 · 缎面吊带连衣裙";
        o.category = "连衣裙";
        o.styleTags = List.of("法式", "缎面", "吊带");
        o.fabric = "醋酸缎面";
        o.desc = "缎面微光，约会之夜的主角。";
        o.cover = "/images/dress-18.jpg";
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.mediaImages = List.of("/images/dress-18.jpg", "/images/style-02.jpg");
        o.createdAtTs = TimeUtil.daysAgo(26);
        Work w2 = addWork(o);

        o = new WorkOpts();
        o.creatorId = 1;
        o.title = "蓝调波点 · 方领连衣裙";
        o.category = "连衣裙";
        o.styleTags = List.of("法式", "波点", "方领");
        o.fabric = "高支棉";
        o.desc = "波点与方领的复古甜心组合，等待市场验证中。";
        o.cover = "/images/dress-03.jpg";
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.mediaImages = List.of("/images/dress-03.jpg", "/images/style-04.jpg");
        o.createdAtTs = TimeUtil.daysAgo(12);
        Work w3 = addWork(o);

        o = new WorkOpts();
        o.creatorId = 1;
        o.title = "初夏微风 · 泡泡纱衬衫";
        o.category = "衬衫";
        o.styleTags = List.of("通勤", "清爽", "泡泡纱");
        o.fabric = "泡泡纱棉";
        o.desc = "泡泡纱自带空气感，夏日不闷热。";
        o.cover = "/images/blouse-02.jpg";
        o.patternMatIds = List.of(m1ShirtPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.mediaImages = List.of("/images/blouse-02.jpg", "/images/style-08.jpg");
        o.createdAtTs = TimeUtil.daysAgo(9);
        Work w4 = addWork(o);

        o = new WorkOpts();
        o.creatorId = 1;
        o.title = "雾屿羊毛 · 半裙";
        o.category = "半裙";
        o.styleTags = List.of("韩系", "羊毛", "半裙");
        o.fabric = "羊毛混纺";
        o.desc = "雾灰半裙的松弛与利落。";
        o.cover = "/images/skirt-02.jpg";
        o.patternMatIds = List.of(m1ShirtPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.mediaImages = List.of("/images/skirt-02.jpg", "/images/style-03.jpg");
        o.createdAtTs = TimeUtil.daysAgo(6);
        Work w5 = addWork(o);

        o = new WorkOpts();
        o.creatorId = 2;
        o.title = "雾色晨雾 · 羊毛混纺大衣";
        o.category = "外套";
        o.styleTags = List.of("韩系", "极简", "大衣");
        o.fabric = "70%羊毛混纺";
        o.desc = "廓形利落，双层工艺保暖不臃肿。";
        o.cover = "/images/coat-02.jpg";
        o.patternMatIds = List.of(m2Pattern.id);
        o.modelMatIds = List.of(m2Obj.id);
        o.mediaImages = List.of("/images/coat-02.jpg", "/images/style-03.jpg");
        o.createdAtTs = TimeUtil.daysAgo(35);
        Work w2c = addWork(o);

        o = new WorkOpts();
        o.creatorId = 3;
        o.title = "初夏微风 · 泡泡纱衬衫";
        o.category = "衬衫";
        o.styleTags = List.of("通勤", "清爽", "泡泡纱");
        o.fabric = "泡泡纱棉";
        o.desc = "为通勤定制的泡泡纱衬衫。";
        o.cover = "/images/blouse-02.jpg";
        o.patternMatIds = List.of(m3Pattern.id);
        o.modelMatIds = List.of(m3Obj.id);
        o.mediaImages = List.of("/images/blouse-02.jpg", "/images/style-08.jpg");
        o.createdAtTs = TimeUtil.daysAgo(22);
        Work w3c = addWork(o);

        return List.of(w1, w2, w3, w4, w5, w2c, w3c);
    }

    /* ==================== 推文 ==================== */

    private static final class PostOpts {
        int authorId;
        Integer workId;
        String content;
        List<String> images;
        List<String> tags;
        int likes;
        Integer comments;
        int dayAge;
        Integer hour;
        List<Integer> patternMatIds;
        List<Integer> modelMatIds;
    }

    private List<Post> seedPosts(List<Work> works) {
        Work w1 = works.get(0);
        Work w2 = works.get(1);
        Work w3 = works.get(2);
        Work w4 = works.get(3);
        Work w5 = works.get(4);
        Work w2c = works.get(5);
        Work w3c = works.get(6);
        List<Post> out = new ArrayList<>();

        // —— creator1 历史推文（形成「已入池」链条）——
        PostOpts o = new PostOpts();
        o.authorId = 1;
        o.workId = w1.id;
        o.dayAge = 13;
        o.likes = 3420;
        o.comments = 12;
        o.hour = 9;
        o.content = "南法的夏天藏在碎花里🌿 「法式碎花泡泡袖连衣裙」打版完成！真丝垂坠感绝了，泡泡袖一点也不显肩宽～\n#法式穿搭 #碎花 #原创设计";
        o.images = List.of("/images/dress-01.jpg", "/images/style-01.jpg");
        o.tags = List.of("法式穿搭", "碎花", "原创设计");
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        Post postW1 = addPost(o);
        out.add(postW1);

        o = new PostOpts();
        o.authorId = 1;
        o.workId = w2.id;
        o.dayAge = 6;
        o.likes = 2310;
        o.comments = 8;
        o.hour = 11;
        o.content = "微醺玫瑰🌹 缎面吊带裙的试穿反馈来啦，光泽感太适合约会了！\n#法式 #缎面 #吊带裙";
        o.images = List.of("/images/dress-18.jpg", "/images/style-02.jpg");
        o.tags = List.of("法式", "缎面", "吊带裙");
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        Post postW2 = addPost(o);
        out.add(postW2);

        // —— creator1 今日推文：2 差一点 + 1 高赞入池 ——
        o = new PostOpts();
        o.authorId = 1;
        o.workId = w4.id;
        o.dayAge = 0;
        o.likes = 520;
        o.comments = 6;
        o.hour = 9;
        o.content = "初夏微风🍃 泡泡纱衬衫的新版片终于定稿！自带空气感，通勤穿一整天都不闷～就差大家的认可啦！\n#通勤穿搭 #衬衫 #原创设计";
        o.images = List.of("/images/blouse-02.jpg", "/images/style-08.jpg");
        o.tags = List.of("通勤穿搭", "衬衫", "原创设计");
        o.patternMatIds = List.of(m1ShirtPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        out.add(addPost(o));

        o = new PostOpts();
        o.authorId = 1;
        o.workId = w5.id;
        o.dayAge = 0;
        o.likes = 458;
        o.comments = 4;
        o.hour = 12;
        o.content = "雾屿羊毛半裙 2.0 试穿🎀 雾灰的松弛感很难不爱，评论破 10 就能进资源池，帮帮我～\n#半裙 #韩系 #羊毛";
        o.images = List.of("/images/skirt-02.jpg", "/images/style-03.jpg");
        o.tags = List.of("半裙", "韩系", "羊毛");
        o.patternMatIds = List.of(m1ShirtPattern.id);
        out.add(addPost(o));

        o = new PostOpts();
        o.authorId = 1;
        o.workId = w3.id;
        o.dayAge = 0;
        o.likes = 1320;
        o.comments = 9;
        o.hour = 15;
        o.content = "蓝调波点 · 方领连衣裙 打版首秀💙 复古甜心的日常与度假都能驾驭，感谢大家的点赞冲上今天前几名！\n#法式 #波点 #方领 #连衣裙";
        o.images = List.of("/images/dress-03.jpg", "/images/style-04.jpg");
        o.tags = List.of("法式", "波点", "方领");
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        out.add(addPost(o));

        // —— 其他创作者今日推文 9 篇（点赞形成 P60 分布）——
        out.add(addOtherToday(2, w2c.id, 812, 8,
                "「雾色晨雾」大衣羊毛面料到货，70% 澳洲羊毛手感真的绝了～今晚直播看细节。\n#羊毛大衣 #韩系穿搭",
                List.of("羊毛大衣", "韩系穿搭"), List.of("/images/coat-02.jpg", "/images/fabric-03.jpg")));
        out.add(addOtherToday(3, w3c.id, 933, 10,
                "打版小课堂｜泡泡纱衬衫从纸样到成衣的细节，今天上新啦！\n#打版 #衬衫 #工艺",
                List.of("打版", "衬衫", "工艺"), List.of("/images/blouse-02.jpg", "/images/craft-01.jpg")));
        out.add(addOtherToday(5, null, 705, 7,
                "工装半裙×3 种穿法，一条裙子穿出三种风格。\n#工装风 #半裙",
                List.of("工装风", "半裙"), List.of("/images/skirt-01.jpg", "/images/style-03.jpg")));
        out.add(addOtherToday(9, null, 560, 5,
                "甜心波点裙细节图来了！收腰+伞摆，梨形也能放心冲。\n#波点 #复古",
                List.of("波点", "复古"), List.of("/images/dress-03.jpg")));
        out.add(addOtherToday(10, null, 648, 6,
                "手织的第 12 件毛衣完工，羊毛混纺软到想埋进去🧶\n#针织 #手作",
                List.of("针织", "手作"), List.of("/images/knit-01.jpg")));
        out.add(addOtherToday(12, null, 502, 4,
                "真丝小课堂：桑蚕丝 vs 柞蚕丝，选购记得看克重。\n#面料知识 #真丝",
                List.of("面料知识", "真丝"), List.of("/images/fabric-03.jpg")));
        out.add(addOtherToday(15, null, 388, 11,
                "南法假日碎花短裙买家返图来了！评论区姐妹们太会拍了✨\n#碎花 #法式",
                List.of("碎花", "法式"), List.of("/images/skirt-03.jpg", "/images/style-02.jpg")));
        out.add(addOtherToday(16, null, 445, 3,
                "白衬衫重度患者的第 17 件：泡泡纱通勤款，清爽利落。\n#通勤穿搭 #白衬衫",
                List.of("通勤穿搭", "白衬衫"), List.of("/images/blouse-02.jpg", "/images/style-08.jpg")));
        out.add(addOtherToday(4, null, 310, 2,
                "设计学徒第一次打版作业通过啦！两周的成果🥳\n#学习打卡 #设计",
                List.of("学习打卡", "设计"), List.of("/images/dress-15.jpg", "/images/style-09.jpg")));

        // —— 其它创作者历史推文 ——
        o = new PostOpts();
        o.authorId = 2;
        o.workId = w2c.id;
        o.dayAge = 11;
        o.likes = 1660;
        o.comments = 6;
        o.hour = 10;
        o.content = "雾色晨雾大衣 3D 试穿效果来了！双面呢的垂坠感在虚拟模特上也很能打。\n#大衣 #羊毛 #韩系";
        o.images = List.of("/images/coat-02.jpg", "/images/style-03.jpg");
        o.tags = List.of("大衣", "羊毛", "韩系");
        Post postW2c = addPost(o);
        out.add(postW2c);

        o = new PostOpts();
        o.authorId = 3;
        o.dayAge = 2;
        o.likes = 1280;
        o.comments = 9;
        o.content = "连衣裙从纸样到胚布的全过程｜每一步都是细节✂️\n#打版 #工艺";
        o.images = List.of("/images/craft-01.jpg", "/images/craft-02.jpg");
        o.tags = List.of("打版", "工艺");
        out.add(addPost(o));

        o = new PostOpts();
        o.authorId = 5;
        o.dayAge = 3;
        o.likes = 1680;
        o.comments = 5;
        o.content = "直筒半裙的大口袋设计，复古工装感十足。\n#工装 #半裙";
        o.images = List.of("/images/skirt-01.jpg", "/images/style-04.jpg");
        o.tags = List.of("工装", "半裙");
        out.add(addPost(o));

        o = new PostOpts();
        o.authorId = 12;
        o.dayAge = 4;
        o.likes = 1980;
        o.comments = 7;
        o.content = "真丝缎面半裙，行走间流光溢彩。\n#真丝 #缎面";
        o.images = List.of("/images/skirt-02.jpg");
        o.tags = List.of("真丝", "缎面");
        out.add(addPost(o));

        o = new PostOpts();
        o.authorId = 8;
        o.dayAge = 1;
        o.likes = 620;
        o.comments = 4;
        o.content = "东方美学与棉麻：亚麻衬衫裙的松弛感。\n#东方美学 #棉麻";
        o.images = List.of("/images/dress-11.jpg", "/images/fabric-02.jpg");
        o.tags = List.of("东方美学", "棉麻");
        out.add(addPost(o));

        return out;
    }

    private Post addOtherToday(int authorId, Integer workId, int likes, int comments, String content,
                               List<String> tags, List<String> images) {
        PostOpts o = new PostOpts();
        o.authorId = authorId;
        o.workId = workId;
        o.dayAge = 0;
        o.likes = likes;
        o.comments = comments;
        o.hour = 8 + (authorId % 7);
        o.content = content;
        o.images = images;
        o.tags = tags;
        return addPost(o);
    }

    /* ==================== 橱窗 / 商品 ==================== */

    private static final class WindowOpts {
        int creatorId;
        Work work;
        String productName;
        String category;
        List<String> styleTags = List.of();
        double price;
        double baseFee;
        List<String> photos = List.of();
        List<FabricPart> partsFabric = List.of();
        List<SizeChartRow> chart = List.of();
        int dayAge;
        List<Integer> patternMatIds = List.of();
        List<Integer> modelMatIds = List.of();
        String cover;
    }

    private List<Product> seedWindowsAndProducts(List<Work> works) {
        Work w1 = works.get(0);
        Work w2 = works.get(1);
        Work w3 = works.get(2);
        Work w4 = works.get(3);
        Work w2c = works.get(5);
        Work w3c = works.get(6);

        WindowOpts o = new WindowOpts();
        o.creatorId = 1;
        o.work = w1;
        o.productName = "法式碎花泡泡袖连衣裙";
        o.category = "连衣裙";
        o.styleTags = List.of("法式", "碎花", "泡泡袖");
        o.price = 328;
        o.baseFee = 68;
        o.photos = List.of("/images/style-01.jpg", "/images/style-05.jpg", "/images/dress-01.jpg");
        o.partsFabric = List.of(fp("面料", "100% 桑蚕丝", "垂坠感强"), fp("内衬", "高支棉"), fp("袖", "同面料泡泡袖"));
        o.chart = List.of(
                scr("XS", 78, 62, 84, 37, 56, 112),
                scr("S", 82, 66, 88, 38, 58, 114),
                scr("M", 86, 70, 92, 39, 60, 116),
                scr("L", 92, 76, 98, 41, 62, 118),
                scr("XL", 98, 82, 104, 42, 63, 120));
        o.dayAge = 12;
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.cover = "/images/dress-01.jpg";
        Product p1 = approveWindowProduct(o);

        o = new WindowOpts();
        o.creatorId = 1;
        o.work = w2;
        o.productName = "微醺玫瑰 · 缎面吊带连衣裙";
        o.category = "连衣裙";
        o.styleTags = List.of("法式", "缎面", "吊带");
        o.price = 299;
        o.baseFee = 79;
        o.photos = List.of("/images/style-02.jpg", "/images/dress-18.jpg");
        o.partsFabric = List.of(fp("面料", "醋酸缎面"), fp("里布", "天丝棉"));
        o.chart = List.of(
                scr("XS", 76, 60, 84, 34, 0, 104),
                scr("S", 80, 64, 88, 35, 0, 106),
                scr("M", 84, 68, 92, 36, 0, 108),
                scr("L", 90, 74, 98, 38, 0, 110));
        o.dayAge = 5;
        o.patternMatIds = List.of(m1DressPattern.id);
        o.modelMatIds = List.of(m1DressObj.id);
        o.cover = "/images/dress-18.jpg";
        Product p2 = approveWindowProduct(o);

        // creator2 大衣 / creator3 衬衫
        o = new WindowOpts();
        o.creatorId = 2;
        o.work = w2c;
        o.productName = "雾色晨雾 · 羊毛混纺大衣";
        o.category = "外套";
        o.styleTags = List.of("韩系", "极简", "大衣");
        o.price = 899;
        o.baseFee = 159;
        o.photos = List.of("/images/style-03.jpg", "/images/coat-02.jpg");
        o.partsFabric = List.of(fp("大身", "70%羊毛混纺"), fp("里布", "铜氨丝"));
        o.chart = List.of(
                scr("S", 102, 92, 102, 40, 58, 102),
                scr("M", 106, 96, 106, 42, 60, 104),
                scr("L", 112, 102, 112, 44, 62, 106),
                scr("XL", 118, 108, 118, 46, 63, 108));
        o.dayAge = 9;
        o.patternMatIds = List.of(m2Pattern.id);
        o.modelMatIds = List.of(m2Obj.id);
        o.cover = "/images/coat-02.jpg";
        Product p2c = approveWindowProduct(o);

        o = new WindowOpts();
        o.creatorId = 3;
        o.work = w3c;
        o.productName = "初夏微风 · 泡泡纱衬衫";
        o.category = "衬衫";
        o.styleTags = List.of("通勤", "清爽", "泡泡纱");
        o.price = 199;
        o.baseFee = 49;
        o.photos = List.of("/images/style-08.jpg", "/images/blouse-02.jpg");
        o.partsFabric = List.of(fp("面料", "泡泡纱棉"), fp("纽扣", "贝壳扣"));
        o.chart = List.of(
                scr("S", 96, 88, 96, 39, 56, 64),
                scr("M", 100, 92, 100, 41, 58, 66),
                scr("L", 106, 98, 106, 43, 60, 68));
        o.dayAge = 7;
        o.patternMatIds = List.of(m3Pattern.id);
        o.modelMatIds = List.of(m3Obj.id);
        o.cover = "/images/blouse-02.jpg";
        Product p3c = approveWindowProduct(o);

        // creator1：审核中 1 件（今日入池的 W3）
        long pendingCreatedAt = TimeUtil.daysAgo(0);
        WindowMaterial winPending = new WindowMaterial();
        winPending.id = ++nextWindowId;
        winPending.creatorId = 1;
        winPending.workId = w3.id;
        winPending.status = WindowStatus.SUBMITTED;
        winPending.photos = new ArrayList<>(List.of("/images/style-04.jpg", "/images/dress-03.jpg"));
        winPending.partsFabric = new ArrayList<>(List.of(fp("面料", "高支棉", "可换亚麻")));
        winPending.spec = new WindowSpec();
        winPending.spec.label = "标准成衣版";
        winPending.spec.sizeChart = new ArrayList<>(List.of(
                scr("S", 84, 66, 90, 38, 56, 100),
                scr("M", 88, 70, 94, 39, 58, 102),
                scr("L", 94, 76, 100, 41, 60, 104)));
        winPending.productName = "蓝调波点 · 方领连衣裙";
        winPending.category = "连衣裙";
        winPending.styleTags = new ArrayList<>(List.of("法式", "波点", "方领"));
        winPending.price = 259;
        winPending.baseFee = 69;
        winPending.patternMatIds = new ArrayList<>(List.of(m1DressPattern.id));
        winPending.modelMatIds = new ArrayList<>(List.of(m1DressObj.id));
        winPending.auditLog = new ArrayList<>();
        winPending.createdAt = TimeUtil.fmtTs(pendingCreatedAt);
        winPending.updatedAt = TimeUtil.fmtTs(pendingCreatedAt);
        windows.add(winPending);

        // creator1：被拒 1 件（W4 泡泡纱衬衫 —— 缺真人穿搭图 & 尺码档不足）
        WindowMaterial winRejected = new WindowMaterial();
        winRejected.id = ++nextWindowId;
        winRejected.creatorId = 1;
        winRejected.workId = w4.id;
        winRejected.status = WindowStatus.REJECTED;
        winRejected.photos = new ArrayList<>();
        winRejected.partsFabric = new ArrayList<>(List.of(fp("面料", "泡泡纱棉")));
        winRejected.spec = new WindowSpec();
        winRejected.spec.label = "标准";
        winRejected.spec.sizeChart = new ArrayList<>(List.of(scr("M", 100, 92, 100, 41, 58, 66)));
        winRejected.productName = "初夏微风 · 泡泡纱衬衫";
        winRejected.category = "衬衫";
        winRejected.styleTags = new ArrayList<>(List.of("通勤", "清爽", "泡泡纱"));
        winRejected.price = 199;
        winRejected.baseFee = 49;
        winRejected.patternMatIds = new ArrayList<>(List.of(m1ShirtPattern.id));
        winRejected.modelMatIds = new ArrayList<>(List.of(m1DressObj.id));
        AuditLogItem rejectedLog = new AuditLogItem();
        rejectedLog.passed = false;
        rejectedLog.note = "缺少：真人模特穿搭实景图（photos ≥ 1）；规格尺码表 ≥ 2 档（spec.sizeChart）；"
                + "3D 结果文件（modelMatIds ≥ 1）请使用 OBJ/GLB 素材";
        rejectedLog.at = TimeUtil.fmtTs(TimeUtil.daysAgo(3));
        winRejected.auditLog = new ArrayList<>(List.of(rejectedLog));
        winRejected.auditMissing = new ArrayList<>(List.of(
                "真人模特穿搭实景图（photos ≥ 1）", "规格尺码表 ≥ 2 档（spec.sizeChart）"));
        winRejected.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(5));
        winRejected.updatedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(3));
        windows.add(winRejected);

        return List.of(p1, p2, p2c, p3c);
    }

    /* ==================== 订单 / 浏览 / 退货 ==================== */

    private static final class ProductCfg {
        final Product product;
        final int viewBase;
        final double orderBase;
        final double returnProb;
        final double customRate;
        final int seed;

        ProductCfg(Product product, int viewBase, double orderBase, double returnProb, double customRate, int seed) {
            this.product = product;
            this.viewBase = viewBase;
            this.orderBase = orderBase;
            this.returnProb = returnProb;
            this.customRate = customRate;
            this.seed = seed;
        }
    }

    private void seedOrdersAndViews(List<Product> products) {
        List<ProductCfg> allProducts = List.of(
                new ProductCfg(products.get(0), 34, 2.8, 0.08, 0.35, 11),
                new ProductCfg(products.get(1), 58, 2.0, 0.02, 0.5, 22));

        for (ProductCfg cfg : allProducts) {
            DoubleSupplier rnd = MiscUtil.mulberry32(cfg.seed);
            Product prod = cfg.product;
            for (int d = 29; d >= 0; d--) {
                int views = (int) Math.max(6L, Math.round(cfg.viewBase * (0.7 + rnd.getAsDouble() * 0.7)));
                String dayKey = TimeUtil.dateKeyOf(TimeUtil.daysAgo(d));
                ViewSeed vs = new ViewSeed();
                vs.productId = prod.id;
                vs.creatorId = prod.creatorId;
                vs.dayKey = dayKey;
                vs.count = views;
                viewsByDay.add(vs);

                int nOrders = rnd.getAsDouble() < 0.12 ? 0 : 1 + (int) Math.floor(rnd.getAsDouble() * 4);
                for (int k = 0; k < nOrders; k++) {
                    int buyerId = pickC(CONSUMERS);
                    boolean custom = rnd.getAsDouble() < cfg.customRate;
                    String size = pickC(DIRECT_SIZES);
                    long createdTs = TimeUtil.daysAgo(d, 9 + (int) Math.floor(rnd.getAsDouble() * 10),
                            (int) Math.floor(rnd.getAsDouble() * 60));
                    boolean paid = true;
                    int prodDays = prod.prodDays == null ? 9 : prod.prodDays;
                    int age = d; // 距今
                    // 状态推导：按年龄与生产周期
                    long paidTs = createdTs + 10 * 60000L;
                    double shippedTs = createdTs + prodDays * 86400000.0 * 0.9;
                    long receivedTs = createdTs + (long) (prodDays + 1) * 86400000L;
                    OrderStatus status;
                    if (!paid) status = OrderStatus.CREATED;
                    else if (age <= prodDays - 3) status = OrderStatus.PAID;
                    else if (age <= prodDays - 1) status = OrderStatus.PRODUCING;
                    else if (age <= prodDays) status = OrderStatus.QC;
                    else if (age <= prodDays + 1) status = OrderStatus.SHIPPING;
                    else status = OrderStatus.RECEIVED;

                    Order o = new Order();
                    o.id = ++nextOrderId;
                    o.no = seedOrderNo(++orderCursor);
                    o.productId = prod.id;
                    o.productTitle = prod.title;
                    o.cover = prod.cover;
                    o.creatorId = prod.creatorId;
                    o.kind = custom ? OrderKind.CUSTOM : OrderKind.DIRECT;
                    o.buyerId = buyerId;
                    o.specUsed = new OrderSpecUsed();
                    o.specUsed.size = size;
                    if (custom) {
                        o.specUsed.body = body14;
                        o.specUsed.adjusted = new ArrayList<>();
                    }
                    o.amounts = new OrderAmounts();
                    o.amounts.price = prod.price;
                    o.amounts.baseFee = custom ? prod.baseFee : 0;
                    o.amounts.total = custom ? MiscUtil.r2(prod.price + prod.baseFee) : prod.price;
                    o.status = status;
                    o.timeline = new ArrayList<>();
                    o.timeline.add(tl(TimeUtil.fmtTs(createdTs), "订单已创建"));
                    o.createdAt = TimeUtil.fmtTs(createdTs);
                    o.prodDays = prodDays;
                    // 注意：原实现的对象字面量在此处取随机渠道（随机消费顺序必须保持）
                    o.channel = pickC(CHANNELS);
                    o.simulate = true;

                    if (status != OrderStatus.CREATED) {
                        o.paidAt = TimeUtil.fmtTs(paidTs);
                        o.timeline.add(tl(TimeUtil.fmtTs(paidTs), "支付成功 ¥" + MiscUtil.jsNum(o.amounts.total)));
                    }
                    if (status == OrderStatus.PRODUCING) {
                        o.timeline.add(tl(TimeUtil.fmtTs(paidTs + 86400000L), "开始生产"));
                    }
                    if (status == OrderStatus.QC) {
                        long qcTs = (long) (paidTs + prodDays * 0.7 * 86400000.0);
                        o.qcReport = qcReport(qcTs, "0.4mm ✓");
                        o.timeline.add(tl(TimeUtil.fmtTs(qcTs), "通过出厂质检"));
                    }
                    if (status == OrderStatus.SHIPPING || status == OrderStatus.RECEIVED) {
                        long qcTs = (long) (paidTs + prodDays * 0.7 * 86400000.0);
                        o.qcReport = qcReport(qcTs, "0.5mm ✓");
                        LogisticsInfo li = new LogisticsInfo();
                        li.company = "顺丰速运";
                        li.trackingNo = "SF" + (100000000000L + (long) Math.floor(rnd.getAsDouble() * 1e9));
                        li.traces = new ArrayList<>();
                        li.traces.add(tr(TimeUtil.fmtTs((long) shippedTs), "已揽收"));
                        li.traces.add(tr(TimeUtil.fmtTs((long) (shippedTs + 86400000.0)), "到达杭州转运中心"));
                        o.logistics = li;
                        o.shippedAt = TimeUtil.fmtTs((long) shippedTs);
                        o.timeline.add(tl(TimeUtil.fmtTs((long) shippedTs), "已发货 顺丰速运"));
                    }
                    if (status == OrderStatus.RECEIVED) {
                        o.receivedAt = TimeUtil.fmtTs(receivedTs);
                        o.timeline.add(tl(TimeUtil.fmtTs(receivedTs), "买家确认收货"));
                    }
                    orders.add(o);

                    // 退货事件
                    if (status == OrderStatus.RECEIVED && age >= prodDays + 2 && rnd.getAsDouble() < cfg.returnProb) {
                        ReturnReq rr = new ReturnReq();
                        rr.state = "done";
                        rr.refundAmount = o.amounts.price;
                        rr.baseFeeKept = custom ? o.amounts.baseFee : 0;
                        rr.reason = "尺寸不合/版型不合预期";
                        rr.at = TimeUtil.fmtTs(receivedTs + 86400000L);
                        o.returnReq = rr;
                        ledger(o.buyerId, "refund", o.amounts.price, "R-" + o.no);
                        o.timeline.add(tl(TimeUtil.fmtTs(receivedTs + 86400000L), "退货退款 ¥" + MiscUtil.jsNum(o.amounts.price)));
                    }
                }
            }
        }
    }

    /** 展示用订单A：id14 已收货可退货定制订单（P1）。 */
    private Order addFeaturedOrder(Product p1) {
        long featTs = TimeUtil.daysAgo(8, 11, 0);
        Order featOrder = new Order();
        featOrder.id = ++nextOrderId;
        featOrder.no = seedOrderNo(++orderCursor);
        featOrder.productId = p1.id;
        featOrder.productTitle = p1.title;
        featOrder.cover = p1.cover;
        featOrder.creatorId = p1.creatorId;
        featOrder.kind = OrderKind.CUSTOM;
        featOrder.buyerId = 14;
        featOrder.specUsed = new OrderSpecUsed();
        featOrder.specUsed.size = "L";
        featOrder.specUsed.body = body14;
        featOrder.specUsed.adjusted = new ArrayList<>();
        featOrder.amounts = new OrderAmounts();
        featOrder.amounts.price = p1.price;
        featOrder.amounts.baseFee = p1.baseFee;
        featOrder.amounts.total = MiscUtil.r2(p1.price + p1.baseFee);
        featOrder.status = OrderStatus.RECEIVED;
        featOrder.timeline = new ArrayList<>();
        featOrder.timeline.add(tl(TimeUtil.fmtTs(featTs), "订单已创建（私人定制 · 基码 L）"));
        featOrder.timeline.add(tl(TimeUtil.fmtTs(featTs + 600000L), "支付成功 ¥" + MiscUtil.jsNum(MiscUtil.r2(p1.price + p1.baseFee))));
        featOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(6)), "开始生产"));
        featOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(3)), "通过出厂质检"));
        featOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(1)), "已发货 顺丰速运"));
        featOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(0, 8, 0)), "买家确认收货"));
        QcReport qc = new QcReport();
        qc.pass = true;
        qc.items = new ArrayList<>(List.of(
                qcItem("面料成分", "100% 桑蚕丝 ✓"), qcItem("车缝", "无跳线 ✓"), qcItem("尺寸偏差", "0.3mm ✓")));
        qc.at = TimeUtil.fmtTs(TimeUtil.daysAgo(3));
        featOrder.qcReport = qc;
        LogisticsInfo li = new LogisticsInfo();
        li.company = "顺丰速运";
        li.trackingNo = "SF1326091004521";
        li.traces = new ArrayList<>(List.of(
                tr(TimeUtil.fmtTs(TimeUtil.daysAgo(1, 9, 0)), "已揽收"),
                tr(TimeUtil.fmtTs(TimeUtil.daysAgo(0, 7, 0)), "派送中")));
        featOrder.logistics = li;
        featOrder.paidAt = TimeUtil.fmtTs(featTs + 600000L);
        featOrder.shippedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(1));
        featOrder.receivedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(0, 8, 0));
        featOrder.createdAt = TimeUtil.fmtTs(featTs);
        featOrder.channel = "创作者推荐";
        featOrder.simulate = true;
        featOrder.prodDays = 9;
        orders.add(featOrder);
        return featOrder;
    }

    /** 展示用订单B：consumer7 定制退货 → 自动二手挂单（active）。 */
    private void addReturnOrder(Product p1, Product p2, Order featOrder) {
        long rTs = TimeUtil.daysAgo(15, 14, 0);
        Order returnOrder = new Order();
        returnOrder.id = ++nextOrderId;
        returnOrder.no = seedOrderNo(++orderCursor);
        returnOrder.productId = p2.id;
        returnOrder.productTitle = p2.title;
        returnOrder.cover = p2.cover;
        returnOrder.creatorId = p2.creatorId;
        returnOrder.kind = OrderKind.CUSTOM;
        returnOrder.buyerId = 7;
        returnOrder.specUsed = new OrderSpecUsed();
        returnOrder.specUsed.size = "S";
        returnOrder.specUsed.body = body14;
        returnOrder.specUsed.adjusted = new ArrayList<>();
        returnOrder.amounts = new OrderAmounts();
        returnOrder.amounts.price = p2.price;
        returnOrder.amounts.baseFee = p2.baseFee;
        returnOrder.amounts.total = MiscUtil.r2(p2.price + p2.baseFee);
        returnOrder.status = OrderStatus.RECEIVED;
        returnOrder.timeline = new ArrayList<>();
        returnOrder.timeline.add(tl(TimeUtil.fmtTs(rTs), "订单已创建"));
        returnOrder.timeline.add(tl(TimeUtil.fmtTs(rTs + 600000L), "支付成功"));
        returnOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(9)), "确认收货"));
        returnOrder.timeline.add(tl(TimeUtil.fmtTs(TimeUtil.daysAgo(4)), "退货退款 ¥299（原价退，基础费用不退）"));
        returnOrder.paidAt = TimeUtil.fmtTs(rTs + 600000L);
        returnOrder.receivedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(9));
        ReturnReq rr = new ReturnReq();
        rr.state = "done";
        rr.refundAmount = 299;
        rr.baseFeeKept = 79;
        rr.reason = "尺寸不合";
        rr.at = TimeUtil.fmtTs(TimeUtil.daysAgo(4));
        returnOrder.returnReq = rr;
        returnOrder.createdAt = TimeUtil.fmtTs(rTs);
        returnOrder.channel = "搜索";
        returnOrder.simulate = true;
        returnOrder.prodDays = 9;
        orders.add(returnOrder);
        ledger(7, "refund", 299, "R-" + returnOrder.no);

        // active 二手挂单：原价×75%
        ResaleListing activeResale = new ResaleListing();
        activeResale.id = ++nextResaleId;
        activeResale.orderId = returnOrder.id;
        activeResale.productId = p2.id;
        activeResale.originalTitle = p2.title;
        activeResale.sellerId = 7;
        activeResale.photo = p2.cover;
        activeResale.sizeLabel = "私人定制 · 基码 S（按身高163cm体型）";
        activeResale.listPrice = MiscUtil.r2(299 * 0.75);
        activeResale.platformFeeRate = 0.08;
        activeResale.status = ResaleStatus.ACTIVE;
        activeResale.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(4));
        resale.add(activeResale);

        // 已成交二手（历史演示）
        ResaleListing soldResale = new ResaleListing();
        soldResale.id = ++nextResaleId;
        soldResale.orderId = featOrder.id;
        soldResale.productId = p1.id;
        soldResale.originalTitle = p1.title;
        soldResale.sellerId = 11;
        soldResale.photo = p1.cover;
        soldResale.sizeLabel = "现货 · M";
        soldResale.listPrice = 246;
        soldResale.platformFeeRate = 0.08;
        soldResale.status = ResaleStatus.SOLD;
        soldResale.soldTo = 6;
        soldResale.soldAt = TimeUtil.fmtTs(TimeUtil.daysAgo(20));
        soldResale.netToSeller = 226.32;
        soldResale.feeCharged = 19.68;
        soldResale.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(22));
        resale.add(soldResale);
    }

    /* ==================== 通知 / 佣金规则 ==================== */

    private record NotifSeed(int userId, String type, String title, String body, String link, boolean read, int ago) {
    }

    private void seedNotifications(int w4Id, List<Product> products, Order featOrder) {
        Product p1 = products.get(0);
        Product p2 = products.get(1);
        List<NotifSeed> notifs = List.of(
                new NotifSeed(1, "pool_remind", "🎉 作品已进入资源池",
                        "「法式碎花泡泡袖连衣裙」点赞超过当日 P60，市场认可！请准备真人穿搭图/规格表/3D与打版文件上橱窗。",
                        "/creator/window?workId=1", true, 13),
                new NotifSeed(1, "audit", "✅ 橱窗审核通过，商品已上架",
                        "「法式碎花泡泡袖连衣裙」审核通过，AI 已生成详情页并上架（原价 ¥328）。",
                        "/mall/product/" + p1.id, true, 12),
                new NotifSeed(1, "product", "🛍️ 新商品上架",
                        "「微醺玫瑰 · 缎面吊带连衣裙」已在商城开售，去数据看板看转化。",
                        "/creator/dashboard?productId=" + p2.id, false, 5),
                new NotifSeed(1, "audit", "❌ 橱窗审核未通过",
                        "「初夏微风 · 泡泡纱衬衫」缺少真人穿搭图与完整尺码表，请补齐后重新提交。",
                        "/creator/window?workId=" + w4Id, false, 3),
                new NotifSeed(1, "order", "💰 收到新订单",
                        "买家「我的小号」支付了「微醺玫瑰 · 缎面吊带连衣裙」定制订单。",
                        "/creator/dashboard", false, 2),
                new NotifSeed(1, "commission", "💎 佣金结算",
                        "「法式碎花泡泡袖连衣裙」T+7 佣金 ¥1,286.40 已结算，可在佣金中心提现。",
                        "/creator/commission", false, 1),
                new NotifSeed(1, "system", "📌 每日资源池提醒",
                        "今天你有 1 篇推文离 P60 一步之遥，再获得一些点赞即可入池变现。",
                        null, false, 0),

                new NotifSeed(2, "product", "🛍️ 新商品上架",
                        "「雾色晨雾 · 羊毛混纺大衣」AI 详情已生成并上架。",
                        "/creator/dashboard", true, 9),
                new NotifSeed(3, "audit", "✅ 橱窗审核通过",
                        "「初夏微风 · 泡泡纱衬衫」审核通过已上架。",
                        "/creator/dashboard", true, 7),

                new NotifSeed(14, "order", "📦 订单已发货",
                        "「法式碎花泡泡袖连衣裙」定制订单已发货（顺丰 SF1326091004521）。",
                        "/mall/orders/" + featOrder.id, false, 1),
                new NotifSeed(14, "order", "📦 订单已收货",
                        "「法式碎花泡泡袖连衣裙」确认收货成功，定制商品可在订单详情退/换货。",
                        "/mall/orders/" + featOrder.id, false, 0),
                new NotifSeed(14, "system", "📏 体型数据已保存",
                        "你的体型档案已更新（162/52/84/64/90），私人定制时将自动适配。",
                        null, true, 3),
                new NotifSeed(7, "resale", "🏷️ 二手挂单已生成",
                        "「微醺玫瑰 · 缎面吊带连衣裙」已按 ¥224.25 挂上二手集市（原价 299×75%）。",
                        "/mall/resale/mine", false, 4),
                new NotifSeed(99, "system", "🗂 今日待审橱窗 1 件",
                        "小织提交了「蓝调波点 · 方领连衣裙」橱窗材料，请复核（可用 force 接口演示）。",
                        "/admin", false, 0),
                new NotifSeed(99, "system", "📊 昨日审核 4 件",
                        "通过 3 / 驳回 1（缺少真人穿搭图）。",
                        null, true, 1));

        for (NotifSeed n : notifs) {
            Notification last = notify(n.userId(), n.type(), n.title(), n.body(), n.link());
            last.read = n.read();
            last.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(n.ago()));
        }
    }

    private void seedCommissionRules() {
        commissionRules.add(rule(1, "基础佣金", "所有已支付有效订单按 6% 基础佣金计", true, "level", "全部有效订单"));
        commissionRules.add(rule(2, "转化与销量上浮", "单品近30天转化率 ≥8% 且销量 ≥10 → +2%（封顶 10%）", true, "level", "单品达标即触发"));
        commissionRules.add(rule(3, "退货率下浮", "近30天退货率 >6% → −1.5%/档（>10% 再降一档）", true, "penalty", "超过阈值触发"));
        commissionRules.add(rule(4, "资源池重复度下浮", "与同款风格重叠度≥60% 的池内作品 ≥3 → −1；≥5 → −2", true, "penalty", "进入资源池的作品参与统计"));
    }

    private static CommissionRule rule(int id, String name, String desc, boolean active, String kind, String when) {
        CommissionRule r = new CommissionRule();
        r.id = id;
        r.name = name;
        r.desc = desc;
        r.active = active;
        r.kind = kind;
        r.when = when;
        return r;
    }

    /* ==================== 橱窗审核引擎（原 engine/window.ts + aiProduct.ts） ==================== */

    private Product approveWindowProduct(WindowOpts opts) {
        String createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(opts.dayAge + 1));
        WindowMaterial win = new WindowMaterial();
        win.id = ++nextWindowId;
        win.creatorId = opts.creatorId;
        win.workId = opts.work.id;
        win.status = WindowStatus.SUBMITTED;
        win.photos = new ArrayList<>(opts.photos);
        win.partsFabric = new ArrayList<>(opts.partsFabric);
        win.spec = new WindowSpec();
        win.spec.label = "标准成衣版";
        win.spec.sizeChart = new ArrayList<>(opts.chart);
        win.productName = opts.productName;
        win.category = opts.category;
        win.styleTags = new ArrayList<>(opts.styleTags);
        win.price = opts.price;
        win.baseFee = opts.baseFee;
        win.patternMatIds = new ArrayList<>(opts.patternMatIds);
        win.modelMatIds = new ArrayList<>(opts.modelMatIds);
        win.auditLog = new ArrayList<>();
        win.createdAt = createdAt;
        win.updatedAt = createdAt;
        windows.add(win);

        Product product = auditWindow(win); // 同步审核并自动上架
        if (product == null) {
            throw new IllegalStateException("seed 橱窗审核失败");
        }
        // 时间回拨到历史时点
        win.updatedAt = TimeUtil.fmtTs(TimeUtil.daysAgo(opts.dayAge));
        win.createdAt = createdAt;
        if (win.auditLog != null && !win.auditLog.isEmpty()) {
            win.auditLog.get(0).at = TimeUtil.fmtTs(TimeUtil.daysAgo(opts.dayAge));
        }
        product.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(opts.dayAge));
        product.cover = opts.cover;
        return product;
    }

    /** 完整性检查（原 engine/window.ts checkCompleteness）。 */
    private static List<String> missingForWindow(WindowMaterial win) {
        List<String> missing = new ArrayList<>();
        if (win.photos == null || win.photos.size() < 1) {
            missing.add("真人模特穿搭实景图（photos ≥ 1）");
        }
        boolean partsOk = win.partsFabric != null && !win.partsFabric.isEmpty();
        if (win.partsFabric != null) {
            for (FabricPart p : win.partsFabric) {
                if (p == null || isBlank(p.part) || isBlank(p.fabric)) partsOk = false;
            }
        }
        if (!partsOk) {
            missing.add("各部件面料说明（partsFabric）");
        }
        if (win.spec == null || win.spec.sizeChart == null || win.spec.sizeChart.size() < 2) {
            missing.add("规格尺码表 ≥ 2 档（spec.sizeChart）");
        }
        if (win.patternMatIds == null || win.patternMatIds.isEmpty()) {
            missing.add("打版结果文件（patternMatIds ≥ 1）");
        }
        if (win.modelMatIds == null || win.modelMatIds.isEmpty()) {
            missing.add("3D 结果文件（modelMatIds ≥ 1）");
        }
        return missing;
    }

    /** 执行审核：pass → 生成 Product；fail → rejected+记录缺失（原 engine/window.ts auditWindow）。 */
    private Product auditWindow(WindowMaterial win) {
        List<String> missing = missingForWindow(win);
        boolean pass = missing.isEmpty();
        User creator = usersById.get(win.creatorId);
        String nickname = creator != null ? creator.nickname : "创作者" + win.creatorId;
        String at = TimeUtil.nowIso();

        if (win.auditLog == null) win.auditLog = new ArrayList<>();
        AuditLogItem entry = new AuditLogItem();
        entry.passed = pass;
        entry.note = pass ? "材料完整，审核通过" : "缺少：" + String.join("、", missing);
        entry.at = at;
        win.auditLog.add(entry);
        win.updatedAt = at;

        if (pass) {
            win.status = WindowStatus.APPROVED;
            Work work = findWork(win.workId);
            if (work == null) {
                // 材料通过但 work 缺失（防御）
                win.status = WindowStatus.REJECTED;
                AuditLogItem e2 = new AuditLogItem();
                e2.passed = false;
                e2.note = "关联作品不存在，请先组织作品";
                e2.at = at;
                win.auditLog.add(e2);
                return null;
            }
            Product product = buildProduct(win, work);
            product.id = ++nextProductId;
            products.add(product);
            notify(win.creatorId, "audit", "✅ 橱窗审核通过，商品已上架",
                    "「" + win.productName + "」材料审核通过，AI 已生成商品详情页并上架商城（原价 ¥" + MiscUtil.jsNum(win.price)
                            + "，基础费用 ¥" + MiscUtil.jsNum(win.baseFee)
                            + "）。可在「商品管理」中修改非材料文案，材料变更需重新提交审核。",
                    "/mall/product/" + product.id);
            notify(win.creatorId, "product", "🛍️ 新商品上架",
                    "「" + win.productName + "」已在商城开售，去数据看板查看转化表现。",
                    "/creator/dashboard?productId=" + product.id);
            log.debug("[seed] 橱窗审核通过：{} 的橱窗材料完整，自动上架成功", nickname);
            return product;
        }

        win.status = WindowStatus.REJECTED;
        win.auditMissing = missing;
        notify(win.creatorId, "audit", "⚠️ 橱窗审核未通过，请补齐材料",
                "「" + (isBlank(win.productName) ? "未命名" : win.productName) + "」审核未通过：" + String.join("；", missing)
                        + "。材料已退回草稿状态，补齐后可重新提交（材料变更必须重新走审核）。",
                "/creator/window?workId=" + win.workId + "&reject=1");
        return null;
    }

    /** 依据 WindowMaterial+Work 生成 Product（不含入库存放；id 由调用方分配）。 */
    private Product buildProduct(WindowMaterial win, Work work) {
        AiDetail aiDetail = buildAiDetail(win, work);
        Product p = new Product();
        p.creatorId = win.creatorId;
        p.workId = win.workId;
        p.windowId = win.id;
        p.title = isBlank(win.productName) ? work.title : win.productName;
        p.category = win.category;
        p.styleTags = new ArrayList<>(win.styleTags != null && !win.styleTags.isEmpty() ? win.styleTags : work.styleTags);
        p.price = win.price;
        p.baseFee = win.baseFee;
        p.cover = win.photos != null && !win.photos.isEmpty() ? win.photos.get(0) : work.cover;
        if (win.photos != null && !win.photos.isEmpty()) {
            p.images = new ArrayList<>(win.photos);
        } else {
            List<String> imgs = new ArrayList<>();
            imgs.add(work.cover);
            if (work.mediaImages != null) imgs.addAll(work.mediaImages);
            p.images = imgs;
        }
        p.patternMatIds = new ArrayList<>(win.patternMatIds != null && !win.patternMatIds.isEmpty()
                ? win.patternMatIds : work.patternMatIds);
        p.modelMatIds = new ArrayList<>(win.modelMatIds != null && !win.modelMatIds.isEmpty()
                ? win.modelMatIds : work.modelMatIds);
        p.aiDetail = aiDetail;
        p.detailEdits = null;
        p.views = 0;
        p.sales = 0;
        p.status = "onSale";
        p.createdAt = win.updatedAt != null && !win.updatedAt.isEmpty() ? win.updatedAt : win.createdAt;
        p.prodDays = aiDetail.prodDays;
        p.likedBy = new ArrayList<>();
        return p;
    }

    /**
     * 生成 aiDetail（原 engine/aiProduct.ts buildAiDetail）。
     *
     * <p>说明：运行期的 AI 生成走 Python（{@code ai.AiServiceClient}）；此处是演示种子数据里
     * 历史商品的详情快照，必须与原实现逐字符一致，故就地复刻模板。
     */
    private AiDetail buildAiDetail(WindowMaterial win, Work work) {
        String category = CAT_CN.getOrDefault(win.category, isBlank(win.category) ? "成衣" : win.category);
        List<String> styleTags = win.styleTags == null ? List.of() : win.styleTags;
        String styleStr = String.join("·", styleTags.subList(0, Math.min(3, styleTags.size())));
        String title = isBlank(win.productName) ? work.title : win.productName;
        List<String> patternFiles = materialFileNames(win.patternMatIds);
        List<String> modelFiles = materialFileNames(win.modelMatIds);
        int photoN = win.photos == null ? 0 : win.photos.size();
        User creator = usersById.get(win.creatorId);
        String creatorNick = creator != null && creator.nickname != null && !creator.nickname.isEmpty()
                ? creator.nickname : "织梦创作者";

        AiDetail d = new AiDetail();
        d.intro = "把「" + (styleStr.isEmpty() ? "原创" : styleStr) + "」穿在身上：" + title + "，来自" + creatorNick
                + "的原创" + category + "。"
                + "版型在虚拟试衣中反复校正，上身不挑比例；"
                + (photoN > 0 ? photoN + " 组真人实拍场景照，所见即所得。" : "细节经多重质检，所见即所得。");

        String designTool = !modelFiles.isEmpty()
                ? (modelFiles.get(0).toLowerCase().contains(".zprj") ? "CLO 3D" : "CLO/建模软件")
                : "设计软件";
        String patternTool = !patternFiles.isEmpty() ? "DXF(R12)" : "DXF";
        d.story = "【从设计到生产】\n"
                + "① 设计：灵感与款式稿在 " + designTool + " 中完成结构推敲，风格标签「" + styleStr + "」。\n"
                + "② 打版：版片以 " + patternTool + " 输出并逐线校对（"
                + (!patternFiles.isEmpty() ? "版片文件：" + String.join("、", patternFiles) + "；" : "")
                + "含刀口/对位点/缝份标注），确保工厂可直接套版。\n"
                + "③ 3D 试穿：用 " + (!modelFiles.isEmpty() ? String.join("、", modelFiles) + " 与 " : "")
                + "CLO 3D 质检版型与垂坠效果，虚拟真人模特多尺码试穿通过后才放样。\n"
                + "④ 排产：柔性工厂 C2M 小单快反排产，按单生产减少库存浪费。\n"
                + "⑤ 质检：成衣经面料成分、车缝线距、尺寸偏差三项出厂质检（附质检报告）。\n"
                + "⑥ 发货：独立包装，从华东仓发出。";

        List<String> partLines = new ArrayList<>();
        if (win.partsFabric != null) {
            for (FabricPart pf : win.partsFabric) {
                String extra = pf.note != null && !pf.note.isEmpty() ? "（" + pf.note + "）" : "";
                partLines.add("· " + pf.part + "：" + pf.fabric + extra + "——" + fabricSentence(pf.fabric));
            }
        }

        d.sections = new ArrayList<>();
        AiSection fabric = new AiSection();
        fabric.icon = "fabric";
        fabric.title = "部件与面料";
        fabric.body = "面料克重与垂坠度经实测后确认，部件用料如下：\n"
                + (!partLines.isEmpty() ? String.join("\n", partLines) : "· 面料：优质成衣面料，触感与耐久度俱佳。")
                + "\n色牢度≥4 级，起毛起球测试达标，细节可放心。";
        d.sections.add(fabric);

        AiSection craft = new AiSection();
        craft.icon = "craft";
        craft.title = "工艺与版型";
        craft.body = "版片经 DXF 刀口、对位点与缝份标注校对，车缝采用"
                + ("外套".equals(win.category) ? "平缝+包边" : "锁边+平缝")
                + "工艺，针距 3cm/12-14 针；"
                + "关键受力部位（肩缝/侧缝/袖窿）双线加固，袖窿与领口顺滑不硌。放码按国际尺码换算，见下方规格表。";
        d.sections.add(craft);

        List<SizeChartRow> chart = win.spec == null || win.spec.sizeChart == null ? List.of() : win.spec.sizeChart;
        StringBuilder chartText = new StringBuilder();
        for (SizeChartRow r : chart) {
            List<String> bits = new ArrayList<>();
            if (r.bust != null) bits.add("胸围 " + MiscUtil.jsNum(r.bust));
            if (r.waist != null) bits.add("腰围 " + MiscUtil.jsNum(r.waist));
            if (r.hip != null) bits.add("臀围 " + MiscUtil.jsNum(r.hip));
            if (r.shoulder != null) bits.add("肩宽 " + MiscUtil.jsNum(r.shoulder));
            if (r.sleeve != null) bits.add("袖长 " + MiscUtil.jsNum(r.sleeve));
            if (r.length != null) bits.add("衣长 " + MiscUtil.jsNum(r.length));
            if (chartText.length() > 0) chartText.append('\n');
            chartText.append("· ").append(r.size).append("：").append(String.join(" / ", bits));
        }
        String specLabel = win.spec == null || isBlank(win.spec.label) ? "标准版型" : win.spec.label;
        AiSection sizeSection = new AiSection();
        sizeSection.icon = "size";
        sizeSection.title = "尺码与规格";
        sizeSection.body = "单位为 cm（成衣平铺）。" + specLabel + "。\n"
                + (chartText.length() > 0 ? chartText.toString() : "· 规格表以商品页为准。") + "\n"
                + "尺寸按国际尺码换算（如 M≈国际 M / 英码 10），选购拿不准可在商城「私人定制」录入体型，"
                + "系统自动推荐基码并提示不合适部位。";
        d.sections.add(sizeSection);

        int prodDays = win.prodDays != null ? win.prodDays : defaultProdDays(win.category);
        AiSection factory = new AiSection();
        factory.icon = "factory";
        factory.title = "生产与交付";
        factory.body = "生产商：" + MFG + "；生产周期 " + prodDays + " 天内完成（定制顺延）。"
                + "本商品由创作者 + 平台柔性供应链共同履约。";
        d.sections.add(factory);

        d.sizeChart = new ArrayList<>(chart);
        d.partsFabric = partLines;
        d.manufacturer = MFG;
        d.prodDays = prodDays;
        d.baseFeeNote = "基础费用（定制专用，下单即付）说明：用于私人定制产生的加工与试错成本——"
                + "① 个性化工时与改版 ② 材料（版片损耗/试样面料） ③ 人工（量体对版/车缝） ④ 质检与定制包装。"
                + "定制商品支持「退货退原价、基础费用不退」，退货自动进入二手集市，规则见购物条款。";
        return d;
    }

    private static String fabricSentence(String fabric) {
        String f = fabric == null ? "" : fabric;
        if (f.contains("真丝") || f.contains("桑蚕丝")) {
            return "真丝自带柔和光泽与良好垂坠，贴身亲肤透气，抗静电不闷汗；建议轻柔手洗、阴干。";
        }
        if (f.contains("羊毛")) {
            return "羊毛纤维卷曲回弹，挺括有型且保暖不透风，经防缩处理后打理更省心。";
        }
        if (f.contains("亚麻")) {
            return "亚麻天然粗犷的纹理自带松弛感，吸湿排汗性能出色，越穿越柔软。";
        }
        if (f.contains("棉")) {
            return "高支精梳棉触感细腻，吸湿透气，久穿不易起球变形。";
        }
        if (f.contains("醋酸") || f.contains("缎")) {
            return "醋酸缎面垂坠流动、光泽内敛，抗皱易打理，是通勤与约会的稳妥之选。";
        }
        if (f.contains("针织") || f.contains("毛")) {
            return "亲肤软糯的针织肌理，弹力适中包裹不勒，春秋叠穿利器。";
        }
        return "面料经过起毛起球与色牢度测试，触感与耐久度俱佳。";
    }

    private static int defaultProdDays(String category) {
        if ("外套".equals(category) || "套装".equals(category)) return 12;
        if ("裤装".equals(category)) return 8;
        return 9;
    }

    private List<String> materialFileNames(List<Integer> ids) {
        List<String> out = new ArrayList<>();
        if (ids == null) return out;
        for (Integer id : ids) {
            for (Material m : materials) {
                if (m.id != null && m.id.equals(id)) {
                    if (m.fileName != null) out.add(m.fileName);
                    break;
                }
            }
        }
        return out;
    }

    /* ==================== 佣金结算（原 engine/commission.ts settleDueCommissions） ==================== */

    private void settleDueCommissions() {
        String now = TimeUtil.nowIso();
        for (Order o : orders) {
            if (orderSettled(o)) continue;
            if (!orderSettleDue(o)) continue;
            double rate = commissionRateForProduct(o.productId) / 100.0;
            double gross = MiscUtil.r2(orderRevenue(o) * rate);
            if (gross <= 0) continue;
            ledger(o.creatorId, "commission_settle", gross, o.no);
            log.debug("[seed] 佣金结算 {} ¥{}（{}）", o.no, gross, now);
        }
    }

    /** 订单对创作者的有效收入（退货/取消后剩余）。 */
    private static double orderRevenue(Order o) {
        if (o.status == OrderStatus.CANCELLED) return 0;
        if (o.returnReq != null && "done".equals(o.returnReq.state)) {
            return o.kind == OrderKind.CUSTOM ? o.amounts.baseFee : 0; // 定制退货留 baseFee；direct 质量退货全退
        }
        return o.amounts.total;
    }

    private boolean orderSettled(Order o) {
        for (LedgerEvent l : ledger) {
            if ("commission_settle".equals(l.kind) && o.no.equals(l.refNo)) return true;
        }
        return false;
    }

    private static boolean orderSettleDue(Order o) {
        if (o.status == OrderStatus.CANCELLED || o.status == OrderStatus.CREATED) return false;
        double rev = orderRevenue(o);
        if (rev <= 0) return false;
        if (o.status == OrderStatus.RECEIVED || o.status == OrderStatus.COMPLETED) {
            Long baseTsBox = MiscUtil.parseTs(o.receivedAt != null ? o.receivedAt : o.createdAt);
            long baseTs = baseTsBox == null ? 0L : baseTsBox;
            return baseTs + 7 * 86400000L <= System.currentTimeMillis();
        }
        // 生产/质检/运输中的订单：按已支付且在途估算（演示：收货满 T+7 才真正结算）
        return false;
    }

    /** 单品佣金费率（原 engine/commission.ts commissionRateForProduct，这里只取 rate）。 */
    private double commissionRateForProduct(int productId) {
        Product product = null;
        for (Product p : products) {
            if (p.id != null && p.id == productId) {
                product = p;
                break;
            }
        }
        if (product == null) throw new IllegalStateException("商品不存在");

        long now = System.currentTimeMillis();
        long fromTs = TimeUtil.startOfDayKey(TimeUtil.dateKeyNow()) - 30L * 86400000L;
        String fromKey = TimeUtil.dateKeyOf(fromTs);
        int views = 0;
        for (ViewSeed v : viewsByDay) {
            if (v.productId == productId && v.dayKey != null && v.dayKey.compareTo(fromKey) >= 0) views += v.count;
        }
        int paid = 0;
        int returns = 0;
        for (Order o : orders) {
            if (o.productId != productId) continue;
            Long createdBox = MiscUtil.parseTs(o.createdAt);
            long created = createdBox == null ? 0L : createdBox;
            if (created < fromTs || created > now) continue;
            if (o.status == OrderStatus.CANCELLED) continue;
            if (o.status != OrderStatus.CREATED) paid++;
            if (o.returnReq != null && "done".equals(o.returnReq.state)) returns++;
        }
        double conversionRate = MiscUtil.pct(paid, views);
        double returnRate = MiscUtil.pct(returns, paid);
        int dup = poolStyleDuplication(product.styleTags, product.workId);

        double rate = 6; // BASE_RATE
        if (conversionRate >= 8 && paid >= 10) rate += 2;
        if (returnRate > 6) rate -= 1.5 * (returnRate > 10 ? 2 : 1);
        if (dup >= 5) rate -= 2;
        else if (dup >= 3) rate -= 1;
        return Math.max(2, Math.min(10, rate));
    }

    /** 资源池样式重复度：与其同 styleTags 重叠度≥60% 的池内其他作品数。 */
    private int poolStyleDuplication(List<String> styleTags, Integer selfWorkId) {
        Set<String> tagSet = new HashSet<>(styleTags == null ? List.of() : styleTags);
        if (tagSet.isEmpty()) return 0;
        int cnt = 0;
        Set<Integer> seen = new HashSet<>();
        for (PoolEntry e : pool) {
            if (e.workId == null || (selfWorkId != null && e.workId.intValue() == selfWorkId.intValue())) continue;
            if (seen.contains(e.workId)) continue;
            Work w = findWork(e.workId);
            if (w == null) continue;
            int overlap = 0;
            if (w.styleTags != null) {
                for (String t : w.styleTags) if (tagSet.contains(t)) overlap++;
            }
            double ratio = overlap / (double) Math.max(1, tagSet.size());
            if (ratio >= 0.6) {
                cnt++;
                seen.add(e.workId);
            }
        }
        return cnt;
    }

    /* ==================== 通知 / 记账（原 engine/helpers.ts） ==================== */

    private Notification notify(int userId, String type, String title, String body, String link) {
        Notification n = new Notification();
        n.id = ++nextNotificationId;
        n.userId = userId;
        n.type = type;
        n.title = title;
        n.body = body;
        n.link = link;
        n.read = false;
        n.createdAt = TimeUtil.nowIso();
        notifications.add(n);
        return n;
    }

    /** 记账：balance 按该用户上一笔流水累加。 */
    private LedgerEvent ledger(int userId, String kind, double amount, String refNo) {
        double prev = 0;
        for (int i = ledger.size() - 1; i >= 0; i--) {
            if (ledger.get(i).userId == userId) {
                prev = ledger.get(i).balance;
                break;
            }
        }
        LedgerEvent ev = new LedgerEvent();
        ev.id = ++nextLedgerId;
        ev.userId = userId;
        ev.kind = kind;
        ev.amount = MiscUtil.r2(amount);
        ev.balance = MiscUtil.r2(prev + amount);
        ev.refNo = refNo;
        ev.createdAt = TimeUtil.nowIso();
        ledger.add(ev);
        return ev;
    }

    /* ==================== 通用小工具 ==================== */

    /** 原实现的 orderNo(i)：ZM + Date.now()%1e11 的前 11 位 + 4 位序号。 */
    private static String seedOrderNo(int i) {
        String stamp = Long.toString(System.currentTimeMillis() % 100000000000L);
        if (stamp.length() > 11) stamp = stamp.substring(0, 11);
        return "ZM" + stamp + String.format("%04d", i);
    }

    private long hourOf(int dayAge, int h, int m) {
        return TimeUtil.daysAgo(dayAge, h, m) + (long) Math.floor(jsRandom.nextDouble() * 30) * 60000L;
    }

    private <T> T pickC(List<T> arr) {
        return arr.get((int) Math.floor(random.getAsDouble() * arr.size()));
    }

    private Work findWork(int workId) {
        for (Work w : works) {
            if (w.id != null && w.id == workId) return w;
        }
        return null;
    }

    private static OrderTimelineItem tl(String t, String text) {
        OrderTimelineItem item = new OrderTimelineItem();
        item.t = t;
        item.text = text;
        return item;
    }

    private static LogisticsTrace tr(String time, String text) {
        LogisticsTrace trace = new LogisticsTrace();
        trace.time = time;
        trace.text = text;
        return trace;
    }

    private static QcItem qcItem(String k, String v) {
        QcItem item = new QcItem();
        item.k = k;
        item.v = v;
        return item;
    }

    private static QcReport qcReport(long ts, String deviation) {
        QcReport r = new QcReport();
        r.pass = true;
        r.items = new ArrayList<>(List.of(
                qcItem("面料成分", "一致 ✓"), qcItem("车缝", "无跳线 ✓"), qcItem("尺寸偏差", deviation)));
        r.at = TimeUtil.fmtTs(ts);
        return r;
    }

    private static FabricPart fp(String part, String fabric) {
        FabricPart f = new FabricPart();
        f.part = part;
        f.fabric = fabric;
        return f;
    }

    private static FabricPart fp(String part, String fabric, String note) {
        FabricPart f = fp(part, fabric);
        f.note = note;
        return f;
    }

    private static SizeChartRow scr(String size, double bust, double waist, double hip, double shoulder,
                                    double sleeve, double length) {
        SizeChartRow r = new SizeChartRow();
        r.size = size;
        r.bust = bust;
        r.waist = waist;
        r.hip = hip;
        r.shoulder = shoulder;
        r.sleeve = sleeve;
        r.length = length;
        return r;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }

    /* ==================== 素材铸造 ==================== */

    /**
     * 等价原 {@code SeedData.addParsedMaterial}：走 {@link Parsers#parseByKind} 解析示例文件，
     * 字段逐一对齐（size 仍取原 sampleSize：优先 ensure() 清单里的磁盘大小）。
     */
    private Material addParsedMaterial(int ownerId, String title, String fileName, String kind, String content,
                                       List<String> tags) {
        MaterialKind mk = MaterialKind.of(kind);
        ParsedFields parsed = parsers.parseByKind(ParsePayload.of(mk, kind, fileName, content, null));
        Material m = new Material();
        m.id = ++nextMaterialId;
        m.creatorId = ownerId;
        m.title = title;
        m.kind = mk;
        m.ext = kind;
        m.size = sampleSize(fileName, content);
        m.fileName = fileName;
        m.layerNames = parsed.layerNames;
        m.entityCount = parsed.entityCount;
        m.patternSvg = parsed.patternSvg;
        m.objPreview = parsed.objPreview;
        m.cover = null;
        m.width = parsed.width;
        m.height = parsed.height;
        m.note = parsed.note;
        m.parseWarn = parsed.parseWarn;
        m.tags = new ArrayList<>(tags);
        m.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(30));
        materials.add(m);
        return m;
    }

    /** 官方图片作素材（轻量引用）。 */
    private Material addImageMaterial(int ownerId, String title, String img, List<String> tags, long size) {
        Material m = new Material();
        m.id = ++nextMaterialId;
        m.creatorId = ownerId;
        m.title = title;
        m.kind = MaterialKind.JPG;
        m.ext = "jpg";
        m.size = size;
        int slash = img.lastIndexOf('/');
        String fn = slash >= 0 ? img.substring(slash + 1) : img;
        m.fileName = fn.isEmpty() ? "photo.jpg" : fn;
        m.cover = img;
        m.tags = new ArrayList<>(tags);
        m.createdAt = TimeUtil.fmtTs(TimeUtil.daysAgo(20));
        materials.add(m);
        return m;
    }

    private long sampleSize(String fileName, String content) {
        Long s = sampleSizes.get(fileName);
        if (s != null) return s;
        return content.getBytes(StandardCharsets.UTF_8).length;
    }

    private String readSample(String name) {
        SamplesProvider.SampleContent c = samplesProvider.read(name);
        return c == null || c.content == null ? "" : c.content;
    }

    /* ==================== 作品 / 推文 / 池 铸造 ==================== */

    private Work addWork(WorkOpts o) {
        Work w = new Work();
        w.id = ++nextWorkId;
        w.creatorId = o.creatorId;
        w.title = o.title;
        w.category = o.category;
        w.styleTags = new ArrayList<>(o.styleTags);
        w.fabric = o.fabric == null ? "" : o.fabric;
        w.desc = o.desc == null ? "" : o.desc;
        w.cover = o.cover;
        w.patternMatIds = o.patternMatIds == null ? new ArrayList<>() : new ArrayList<>(o.patternMatIds);
        w.modelMatIds = o.modelMatIds == null ? new ArrayList<>() : new ArrayList<>(o.modelMatIds);
        w.mediaImages = o.mediaImages == null ? new ArrayList<>() : new ArrayList<>(o.mediaImages);
        w.createdAt = TimeUtil.fmtTs(o.createdAtTs != 0 ? o.createdAtTs : TimeUtil.daysAgo(20));
        works.add(w);
        return w;
    }

    private Post addPost(PostOpts o) {
        int hour = o.hour != null ? o.hour : 10 + (o.authorId % 8);
        long ts = hourOf(o.dayAge, hour, o.authorId % 60);
        Post p = new Post();
        p.id = ++nextPostId;
        p.authorId = o.authorId;
        p.workId = o.workId;
        p.content = o.content;
        p.images = o.images == null ? new ArrayList<>() : new ArrayList<>(o.images);
        p.tags = o.tags == null ? new ArrayList<>() : new ArrayList<>(o.tags);
        p.createdAt = TimeUtil.fmtTs(ts);
        p.dateKey = TimeUtil.dateKeyOf(ts);
        p.likes = o.likes;
        p.likedBy = new ArrayList<>();
        p.comments = new ArrayList<>();
        p.commentCount = 0;
        p.shareCount = o.likes / 11;
        p.patternMatIds = o.patternMatIds == null ? null : new ArrayList<>(o.patternMatIds);
        p.modelMatIds = o.modelMatIds == null ? null : new ArrayList<>(o.modelMatIds);

        int nComments = o.comments != null ? o.comments : Math.min(6, Math.max(0, o.likes / 160));
        List<Integer> authors = new ArrayList<>();
        for (int x = 1; x <= 18; x++) if (x != o.authorId) authors.add(x);
        for (int i = 0; i < nComments; i++) {
            CommentItem c = new CommentItem();
            c.id = ++nextCommentId;
            c.userId = pickC(authors);
            c.content = pickC(COMMENTS_POOL);
            c.createdAt = TimeUtil.fmtTs(ts + (i + 1) * 3600000L);
            c.likes = (int) Math.floor(random.getAsDouble() * 40);
            c.post = p;                 // 唯一真父子关系：Post 1—N CommentItem（FK 由 owning 侧写入）
            p.comments.add(c);
        }
        p.commentCount = p.comments.size();
        posts.add(p);
        return p;
    }

    private PoolEntry addPool(int postId, Integer workId, int creatorId, int dayAge, String reason,
                              double likeP60, int likeAtQualify, int commentAtQualify) {
        long ts = TimeUtil.daysAgo(dayAge);
        PoolEntry e = new PoolEntry();
        e.id = ++nextPoolId;
        e.postId = postId;
        e.workId = workId;
        e.creatorId = creatorId;
        e.qualifiedAt = TimeUtil.fmtTs(ts);
        e.dateKey = TimeUtil.dateKeyOf(ts);
        e.reason = reason;
        e.likeP60 = likeP60;
        e.likeAtQualify = likeAtQualify;
        e.commentAtQualify = commentAtQualify;
        e.notifiedAt = TimeUtil.fmtTs(ts);
        pool.add(e);
        return e;
    }
}
