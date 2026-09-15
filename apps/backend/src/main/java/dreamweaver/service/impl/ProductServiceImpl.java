package dreamweaver.service.impl;

import dreamweaver.ai.AiServiceClient;
import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.AiDetail;
import dreamweaver.entity.AiSection;
import dreamweaver.entity.DetailEdits;
import dreamweaver.entity.Product;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.ViewSeed;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import dreamweaver.entity.Work;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.ViewSeedRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.ProductService;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 商品业务实现（取代原商品组装器 + {@code ProductsController} 内的排序/筛选/分页/收藏逻辑）。
 *
 * <p><b>架构约定</b>：详情页文案（intro / story / sections / partsFabric / baseFeeNote、
 * 面料措辞、生产商与生产周期模板）由 Python AI 服务生成
 * （{@code POST /ai/product-detail}），Java 侧<b>不内联任何文案模板</b>，
 * 只负责委托调用并把结果组装进 {@link Product}。
 *
 * <p>{@link #buildProduct(WindowMaterial, Work)} 返回<b>不带 id</b> 的 Product，
 * 由调用方 {@code save()} 后读取数据库生成的主键。
 */
@Service
public class ProductServiceImpl implements ProductService {

    private static final List<String> CATEGORIES = List.of("连衣裙", "衬衫", "半裙", "外套", "裤装", "套装");

    private final AiServiceClient ai;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final ViewSeedRepository viewSeedRepository;
    private final NotifyService notify;
    private final DtoMapper dto;

    public ProductServiceImpl(AiServiceClient ai,
                              ProductRepository productRepository,
                              UserRepository userRepository,
                              WindowMaterialRepository windowMaterialRepository,
                              ViewSeedRepository viewSeedRepository,
                              NotifyService notify,
                              DtoMapper dto) {
        this.ai = ai;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.viewSeedRepository = viewSeedRepository;
        this.notify = notify;
        this.dto = dto;
    }

    /* ------------------------------ 组装（冻结接口） ------------------------------ */

    /** 取制造商默认（原 defaultManufacturer()）。 */
    @Override
    public String defaultManufacturer() {
        return "织梦柔性智造工厂 · 华东1号";
    }

    /** 生产周期默认（原 defaultProdDays()）：外套/套装 12 天；裤装 8 天；其他 9 天。 */
    @Override
    public int defaultProdDays(String category) {
        if ("外套".equals(category) || "套装".equals(category)) return 12;
        if ("裤装".equals(category)) return 8;
        return 9;
    }

    /**
     * 生成 aiDetail（原 buildAiDetail()）：委托 Python AI 服务。
     *
     * <p>调用失败会抛出 {@code ApiException(503, "AI_UNAVAILABLE")}，<b>不要吞掉</b>，让其冒泡到
     * {@code GlobalExceptionHandler}。
     */
    @Override
    public AiDetail buildAiDetail(WindowMaterial win, Work work) {
        return ai.buildProductDetail(win, work);
    }

    /**
     * 依据 WindowMaterial + Work 生成 Product（原 buildProduct()，不含 id）。
     *
     * <p>字段与 TS 逐字段对齐：{@code cover} 取首张实拍图（为空回退作品封面）；
     * {@code images} 为空时回退 {@code [work.cover, ...work.mediaImages]}；
     * {@code styleTags / patternMatIds / modelMatIds} 仅在为空数组时回退作品字段。
     */
    @Override
    public Product buildProduct(WindowMaterial win, Work work) {
        AiDetail aiDetail = buildAiDetail(win, work);

        Product p = new Product();
        p.creatorId = win.creatorId;
        p.workId = win.workId;
        p.windowId = win.id;
        p.title = isBlank(win.productName) ? work.title : win.productName;
        p.category = win.category;
        // 注意：JPA 不允许不同实体共享同一个集合实例（否则抛 Found shared references to a collection），
        // 因此这里一律复制新列表，不要直接把上游实体的集合引用赋给 Product。
        p.styleTags = copyOf(win.styleTags != null ? win.styleTags
                : (work.styleTags != null ? work.styleTags : List.of()));
        p.price = win.price;
        p.baseFee = win.baseFee;
        p.cover = coverOf(win, work);
        p.images = copyOf(imagesOf(win, work));
        p.patternMatIds = copyOf(win.patternMatIds != null && !win.patternMatIds.isEmpty()
                ? win.patternMatIds
                : (work.patternMatIds != null ? work.patternMatIds : List.of()));
        p.modelMatIds = copyOf(win.modelMatIds != null && !win.modelMatIds.isEmpty()
                ? win.modelMatIds
                : (work.modelMatIds != null ? work.modelMatIds : List.of()));
        p.aiDetail = aiDetail;
        p.views = 0;
        p.sales = 0;
        p.status = "onSale";
        p.createdAt = isBlank(win.updatedAt) ? win.createdAt : win.updatedAt;
        p.prodDays = aiDetail == null ? defaultProdDays(win.category) : aiDetail.prodDays;
        p.likedBy = new ArrayList<>();
        return p;
    }

    /* --------------------------------- 商城 --------------------------------- */

    /** {@code GET /api/mall/products}：在售商品 + 品类/关键词筛选 + 排序 + 分页。 */
    @Transactional(readOnly = true)
    public Map<String, Object> mallProducts(Integer uid, String category, String kw,
                                            String sort, String page, String pageSize) {
        List<Product> list = new ArrayList<>(productRepository.findByStatus("onSale"));
        if (truthy(category)) {
            String cat = category;
            list.removeIf(p -> !cat.equals(p.category));
        }
        if (truthy(kw)) {
            String k = kw.toLowerCase(Locale.ROOT);
            list.removeIf(p -> !(p.title + p.category + String.join(" ", tagsOf(p)))
                    .toLowerCase(Locale.ROOT).contains(k));
        }

        String s = truthy(sort) ? sort : "hot";
        if ("priceAsc".equals(s)) list.sort((a, b) -> Double.compare(a.price, b.price));
        else if ("priceDesc".equals(s)) list.sort((a, b) -> Double.compare(b.price, a.price));
        else if ("sales".equals(s)) list.sort((a, b) -> Integer.compare(b.sales, a.sales));
        else list.sort((a, b) -> Double.compare(score(b), score(a)));

        Map<String, Object> paged = MiscUtil.paginate(list, numOr(page, 1), numOr(pageSize, 12));
        @SuppressWarnings("unchecked")
        List<Product> slice = (List<Product>) paged.get("list");

        Map<Integer, User> creators = creatorsOf(slice);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Product p : slice) {
            User creator = creators.get(p.creatorId);
            Map<String, Object> it = new LinkedHashMap<>();
            it.put("id", p.id);
            it.put("title", p.title);
            it.put("cover", p.cover);
            it.put("price", p.price);
            it.put("baseFee", p.baseFee);
            it.put("category", p.category);
            it.put("styleTags", p.styleTags);
            it.put("sales", p.sales);
            it.put("views", p.views);
            if (creator != null) {
                Map<String, Object> c = new LinkedHashMap<>();
                c.put("id", creator.id);
                c.put("nickname", creator.nickname);
                c.put("avatar", creator.avatar);
                it.put("creator", c);
            } else {
                it.put("creator", null);
            }
            it.put("hasCustom", p.baseFee > 0);
            items.add(it);
        }

        paged.put("categories", CATEGORIES);
        paged.put("list", items);
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("viewerId", uid);
        paged.put("meta", meta);
        return paged;
    }

    /** {@code GET /api/creator/products}：创作者我的全部商品（含未上架 / 下架）。 */
    @Transactional(readOnly = true)
    public Map<String, Object> myProducts(int uid, String status, String kw, String page, String pageSize) {
        User user = userRepository.findById(uid).orElse(null);
        if (user == null || (user.role != Role.CREATOR && user.role != Role.AUDITOR && user.role != Role.ADMIN)) {
            throw Errors.deny("仅创作者可查看");
        }

        String st = truthy(status) ? status : null;
        List<Product> list = new ArrayList<>(st == null
                ? productRepository.findByCreatorIdOrderByCreatedAtDesc(uid)
                : productRepository.findByCreatorIdAndStatusOrderByCreatedAtDesc(uid, st));
        if (truthy(kw)) {
            String k = kw.toLowerCase(Locale.ROOT);
            list.removeIf(p -> !(p.title + p.category).toLowerCase(Locale.ROOT).contains(k));
        }
        // 复刻原实现的字符串排序语义（createdAt 倒序，null 视为 ""）
        list.sort((a, b) -> MiscUtil.toStr(b.createdAt, "").compareTo(MiscUtil.toStr(a.createdAt, "")));

        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("draft", 0);
        counts.put("onSale", 0);
        counts.put("offShelf", 0);
        for (Product p : list) {
            Object cur = counts.get(p.status);
            counts.put(p.status, (cur == null ? 0 : (Integer) cur) + 1);
        }

        Map<String, Object> paged = MiscUtil.paginate(list, numOr(page, 1), numOr(pageSize, 30));
        @SuppressWarnings("unchecked")
        List<Product> slice = (List<Product>) paged.get("list");

        List<Map<String, Object>> items = new ArrayList<>();
        for (Product p : slice) {
            Map<String, Object> d = dto.productDetailDTO(p, uid);
            WindowMaterial w = windowMaterialRepository.findById(p.windowId).orElse(null);
            d.put("windowStatus", w == null || w.status == null ? null : w.status.value());
            items.add(d);
        }

        paged.put("counts", counts);
        paged.put("list", items);
        return paged;
    }

    /* ------------------------------- 商品管理 ------------------------------- */

    /** {@code GET /api/products/{id}}：商品详情。 */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(Integer uid, int id) {
        Product p = productRepository.findById(id).orElse(null);
        if (p == null) throw Errors.notFound("商品不存在");
        return dto.productDetailDTO(p, uid);
    }

    /** 创作者编辑非材料内容 detailEdits。 */
    @Transactional
    public Map<String, Object> editDetail(int uid, int id, Map<String, Object> body) {
        Product p = requireOwn(uid, id);

        Map<String, Object> b = body == null ? new LinkedHashMap<String, Object>() : body;
        // detailEdits 是 JSON 列：替换整个值对象以确保脏检查生效（就地修改 public 字段不会被 flush）
        DetailEdits de = new DetailEdits();
        if (p.detailEdits != null) {
            de.intro = p.detailEdits.intro;
            de.story = p.detailEdits.story;
            de.manufacturer = p.detailEdits.manufacturer;
            de.sections = p.detailEdits.sections;
        }
        if (b.containsKey("intro")) de.intro = String.valueOf(b.get("intro"));
        if (b.containsKey("story")) de.story = String.valueOf(b.get("story"));
        if (b.containsKey("manufacturer")) de.manufacturer = String.valueOf(b.get("manufacturer"));
        if (b.get("sections") instanceof List<?> sections) {
            List<AiSection> out = new ArrayList<>();
            for (Object o : sections) {
                Map<String, Object> sm = o instanceof Map<?, ?> ? asMap(o) : new LinkedHashMap<String, Object>();
                AiSection sec = new AiSection();
                sec.title = jsStr(sm, "title");
                sec.body = jsStr(sm, "body");
                out.add(sec);
            }
            de.sections = out;
        }
        p.detailEdits = de;

        return dto.productDetailDTO(p, uid);
    }

    /** 上/下架。 */
    @Transactional
    public Map<String, Object> shelf(int uid, int id, Map<String, Object> body) {
        Product p = requireOwn(uid, id);

        Map<String, Object> b = body == null ? new LinkedHashMap<String, Object>() : body;
        Object raw = b.get("action");
        String action = truthy(raw) ? String.valueOf(raw) : "off";
        if ("off".equals(action)) {
            p.status = "offShelf";
        } else if ("on".equals(action)) {
            WindowMaterial w = windowMaterialRepository.findById(p.windowId).orElse(null);
            if (w != null && w.status != WindowStatus.APPROVED) {
                throw Errors.bad("WINDOW_NOT_APPROVED", "该商品材料未通过橱窗审核，无法上架");
            }
            p.status = "onSale";
        } else {
            throw Errors.bad("BAD_REQUEST", "action 需为 on/off");
        }

        return dto.productDetailDTO(p, uid);
    }

    /* ------------------------------- 浏览/收藏 ------------------------------- */

    /** 浏览计数（游客亦可，幂等演示用途）。 */
    @Transactional
    public Map<String, Object> view(int id) {
        Product p = productRepository.findById(id).orElse(null);
        if (p == null) throw Errors.notFound("商品不存在");
        p.views++;

        String dayKey = TimeUtil.dateKeyNow();
        ViewSeed rec = viewSeedRepository.findByProductIdAndDayKey(id, dayKey).orElse(null);
        if (rec != null) {
            rec.count++;
        } else {
            ViewSeed seed = new ViewSeed();
            seed.productId = id;
            seed.creatorId = p.creatorId;
            seed.dayKey = dayKey;
            seed.count = 1;
            viewSeedRepository.save(seed);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("views", p.views);
        return out;
    }

    /** 收藏 / 取消收藏（原 toggleCollect：重复点赞不重复计数、不重复写收藏；取消幂等）。 */
    @Transactional
    public Map<String, Object> toggleLike(int uid, int id, boolean like) {
        Product p = productRepository.findById(id).orElse(null);
        if (p == null) throw Errors.notFound("商品不存在");

        User user = userRepository.findById(uid).orElse(null);
        if (user == null) throw Errors.deny();
        if (p.likedBy == null) p.likedBy = new ArrayList<>();
        boolean has = p.likedBy.contains(uid);
        List<Integer> collects = user.collectProductIds == null
                ? new ArrayList<Integer>() : user.collectProductIds;

        if (like) {
            if (!has) {
                List<Integer> nextLiked = new ArrayList<>(p.likedBy);
                nextLiked.add(uid);
                p.likedBy = nextLiked;
                List<Integer> next = new ArrayList<>(collects);
                next.add(p.id);
                user.collectProductIds = next;
            }
            if (p.creatorId != uid) {
                notify.notify(p.creatorId, "like", "❤️ 商品被收藏",
                        user.nickname + " 收藏了「" + p.title + "」", "/creator/dashboard");
            }
        } else {
            if (has) {
                List<Integer> next = new ArrayList<>();
                for (Integer x : p.likedBy) {
                    if (x == null || x.intValue() != uid) next.add(x);
                }
                p.likedBy = next;
            }
            List<Integer> keep = new ArrayList<>();
            for (Integer x : collects) {
                if (x == null || p.id == null || x.intValue() != p.id) keep.add(x);
            }
            user.collectProductIds = keep;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("liked", like);
        return out;
    }

    /* -------------------------------- 内部工具 -------------------------------- */

    private Product requireOwn(int uid, int id) {
        Product p = productRepository.findById(id).orElse(null);
        if (p == null) throw Errors.notFound("商品不存在");
        if (p.creatorId != uid) throw Errors.deny();
        return p;
    }

    private Map<Integer, User> creatorsOf(List<Product> products) {
        List<Integer> ids = new ArrayList<>();
        for (Product p : products) {
            if (!ids.contains(p.creatorId)) ids.add(p.creatorId);
        }
        Map<Integer, User> out = new HashMap<>();
        for (User u : userRepository.findAllById(ids)) out.put(u.id, u);
        return out;
    }

    /** score = sales * 3 + views / 100（热度排序）。 */
    private static double score(Product p) {
        return p.sales * 3 + p.views / 100.0;
    }

    private static List<String> tagsOf(Product p) {
        return p.styleTags == null ? List.of() : p.styleTags;
    }

    /** {@code (win.photos[0] as string) || work.cover} */
    private static String coverOf(WindowMaterial win, Work work) {
        List<String> photos = win.photos;
        if (photos != null && !photos.isEmpty()) {
            String first = photos.get(0);
            if (first != null && !first.isEmpty()) return first;
        }
        return work.cover;
    }

    /** 复制成新列表，避免与上游实体共享集合实例（JPA 限制）。 */
    private static <T> List<T> copyOf(List<T> src) {
        return src == null ? null : new ArrayList<>(src);
    }

    /** {@code win.photos.length ? win.photos : [work.cover, ...(work.mediaImages || [])]} */
    private static List<String> imagesOf(WindowMaterial win, Work work) {
        if (win.photos != null && !win.photos.isEmpty()) return win.photos;
        List<String> out = new ArrayList<>();
        out.add(work.cover);
        if (work.mediaImages != null) out.addAll(work.mediaImages);
        return out;
    }

    /** 等价于 JS `Number(x) || dft`：0 / NaN / 空串都取默认值。 */
    private static int numOr(String raw, int dft) {
        int v = MiscUtil.toInt(raw, dft);
        return v == 0 ? dft : v;
    }

    private static boolean truthy(String s) {
        return s != null && !s.isEmpty();
    }

    private static boolean truthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d != 0 && !Double.isNaN(d);
        }
        return !String.valueOf(v).isEmpty();
    }

    private static boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }

    /** 把任意对象规范成 Map（非对象 → 空 Map），键统一转成 String。 */
    private static Map<String, Object> asMap(Object v) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!(v instanceof Map<?, ?> m)) return out;
        for (Map.Entry<?, ?> e : m.entrySet()) out.put(String.valueOf(e.getKey()), e.getValue());
        return out;
    }

    /** 等价于 JS {@code String(s.title)}：键缺失（undefined）→ "undefined"，显式 null → "null"。 */
    private static String jsStr(Map<String, Object> m, String key) {
        return m.containsKey(key) ? String.valueOf(m.get(key)) : "undefined";
    }
}
