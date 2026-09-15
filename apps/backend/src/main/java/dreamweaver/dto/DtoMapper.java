package dreamweaver.dto;

import dreamweaver.entity.CommentItem;
import dreamweaver.entity.Material;
import dreamweaver.entity.Order;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Post;
import dreamweaver.entity.Product;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.Work;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * DTO 序列化辅助：去掉内部字段 + 组装 author/linkedWork/viewer 等展示对象。
 *
 * <p>说明：原实现用对象展开（{@code ...spread}）保留实体全部字段，本实现等价地用
 * Jackson 把实体转成 {@code Map} 后增删键，保证字段级契约完全一致（含 {@code null} 值的呈现）。
 */
@Component
public class DtoMapper {

    private final ObjectMapper json;
    private final UserRepository userRepository;
    private final WorkRepository workRepository;
    private final MaterialRepository materialRepository;
    private final PostRepository postRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final ProductRepository productRepository;
    private final WindowMaterialRepository windowMaterialRepository;

    /**
     * 说明：本类是「实体 → 展示用 DTO」的组装器（Assembler），需要按 id 反查作者/关联作品/素材等
     * 展示字段，因此允许直接依赖 repository —— 这是装配器组件的正常依赖，不属于控制层越界。
     */
    public DtoMapper(ObjectMapper json,
                     UserRepository userRepository,
                     WorkRepository workRepository,
                     MaterialRepository materialRepository,
                     PostRepository postRepository,
                     PoolEntryRepository poolEntryRepository,
                     ProductRepository productRepository,
                     WindowMaterialRepository windowMaterialRepository) {
        this.json = json;
        this.userRepository = userRepository;
        this.workRepository = workRepository;
        this.materialRepository = materialRepository;
        this.postRepository = postRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.productRepository = productRepository;
        this.windowMaterialRepository = windowMaterialRepository;
    }

    /* ------------------------------- 基础映射 ------------------------------- */

    public Map<String, Object> toUserPublic(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.id);
        m.put("nickname", u.nickname);
        m.put("avatar", u.avatar);
        m.put("bio", u.bio);
        m.put("role", u.role.value());
        m.put("level", u.level);
        m.put("followers", u.followers);
        m.put("following", u.following);
        m.put("createdAt", u.createdAt);
        if (u.body != null) m.put("body", u.body);
        return m;
    }

    public Map<String, Object> toCommentDTO(CommentItem c) {
        User user = userById(c.userId);
        Map<String, Object> m = toMap(c);
        m.put("author", user == null ? null : toUserPublic(user));
        return m;
    }

    public Map<String, Object> workBrief(Work w) {
        if (w == null) return null;
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", w.id);
        m.put("title", w.title);
        m.put("category", w.category);
        m.put("cover", w.cover);
        m.put("styleTags", w.styleTags);
        m.put("fabric", w.fabric);
        return m;
    }

    public List<Map<String, Object>> materialBrief(List<Integer> ids) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (ids == null) return out;
        for (Integer id : ids) {
            Material m = materialById(id);
            if (m == null) continue;
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("id", m.id);
            b.put("kind", m.kind.value());
            b.put("fileName", m.fileName);
            b.put("cover", m.cover);
            out.add(b);
        }
        return out;
    }

    /* -------------------------------- 推文 DTO -------------------------------- */

    public Map<String, Object> postDTO(Post p, Integer viewerId) {
        return postDTO(p, viewerId, false);
    }

    public Map<String, Object> postDTO(Post p, Integer viewerId, boolean detail) {
        User author = userById(p.authorId);
        Work work = p.workId == null ? null : workById(p.workId);
        List<Integer> pattern = p.patternMatIds == null ? List.of() : p.patternMatIds;
        List<Integer> model = p.modelMatIds == null ? List.of() : p.modelMatIds;
        List<Integer> allMat = new ArrayList<>(pattern);
        allMat.addAll(model);
        List<Map<String, Object>> preview = materialBrief(allMat);
        if (preview.size() > 4) preview = new ArrayList<>(preview.subList(0, 4));

        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", p.id);
        dto.put("authorId", p.authorId);
        dto.put("author", author == null ? null : toUserPublic(author));
        dto.put("content", p.content);
        dto.put("images", p.images);
        dto.put("tags", p.tags);
        dto.put("createdAt", p.createdAt);
        dto.put("dateKey", p.dateKey);
        dto.put("likes", p.likes);
        dto.put("commentCount", p.commentCount);
        dto.put("shareCount", p.shareCount);
        dto.put("workId", p.workId);
        if (work != null) dto.put("linkedWork", workBrief(work));
        dto.put("patternMatIds", pattern);
        dto.put("modelMatIds", model);
        dto.put("materialPreview", preview);
        dto.put("patternCount", pattern.size());
        dto.put("modelCount", model.size());

        Map<String, Object> viewer = new LinkedHashMap<>();
        viewer.put("liked", viewerId != null && p.likedBy != null && p.likedBy.contains(viewerId));
        User vu = viewerId == null ? null : userById(viewerId);
        viewer.put("collected", vu != null && vu.collectPostIds != null && vu.collectPostIds.contains(p.id));
        dto.put("viewer", viewer);

        dto.put("inPool", !poolEntryRepository.findByPostId(p.id).isEmpty());

        if (detail) {
            List<Map<String, Object>> comments = new ArrayList<>();
            if (p.comments != null) for (CommentItem c : p.comments) comments.add(toCommentDTO(c));
            dto.put("comments", comments);
            // 作者查看自己推文时提供「市场认可进度」
            if (viewerId != null && p.authorId == viewerId) {
                List<Post> todayPosts = p.dateKey == null ? List.of() : postRepository.findByDateKey(p.dateKey);
                List<Integer> likesAll = new ArrayList<>(todayPosts.stream().map(x -> x.likes).toList());
                likesAll.sort(Integer::compareTo);
                int n = likesAll.size();
                double p60 = n >= 3 ? likesAll.get(Math.min(n - 1, (int) Math.ceil(n * 0.6) - 1)) : 0;
                Map<String, Object> market = new LinkedHashMap<>();
                market.put("p60", Math.round(p60));
                market.put("p60Note", n >= 3
                        ? "当日共 " + n + " 篇推文，P60=" + Math.round(p60) + "（点赞超过即入池）"
                        : (n > 0 ? "当日仅 " + n + " 篇（冷启动），P60=0，点赞 >0 即入池" : "当日暂无其他推文"));
                market.put("commentTarget", 10);
                market.put("likes", p.likes);
                market.put("comments", p.commentCount);
                market.put("qualified", p.likes > p60 || p.commentCount >= 10);
                dto.put("market", market);
            }
        }
        return dto;
    }

    /* ------------------------------ 资源池条目 DTO ------------------------------ */

    public Map<String, Object> poolEntryDTO(PoolEntry e, Integer viewerId) {
        Post post = postRepository.findById(e.postId).orElse(null);
        Work work = e.workId == null ? null : workById(e.workId);
        Product product = e.workId == null ? null : firstOrNull(productRepository.findByWorkId(e.workId));
        WindowMaterial win = e.workId == null ? null : firstOrNull(windowMaterialRepository.findByWorkId(e.workId));
        User creator = userById(e.creatorId);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", e.id);
        m.put("postId", e.postId);
        m.put("workId", e.workId);
        m.put("creatorId", e.creatorId);
        m.put("qualifiedAt", e.qualifiedAt);
        m.put("dateKey", e.dateKey);
        m.put("reason", e.reason);
        m.put("likeP60", e.likeP60);
        m.put("likeAtQualify", e.likeAtQualify);
        m.put("commentAtQualify", e.commentAtQualify);
        m.put("notifiedAt", e.notifiedAt);
        m.put("post", post == null ? null : postDTO(post, viewerId));
        if (work != null) m.put("work", workBrief(work));
        m.put("productStatus", product == null ? null : product.status);
        if (product != null) m.put("productId", product.id);
        m.put("windowStatus", win == null ? null : win.status.value());
        m.put("creator", creator == null ? null : toUserPublic(creator));
        return m;
    }

    /* ------------------------------- 商品详情 DTO ------------------------------- */

    public Map<String, Object> productDetailDTO(Product p, Integer viewerId) {
        User creator = userById(p.creatorId);
        Work work = workById(p.workId);
        WindowMaterial win = windowMaterialRepository.findById(p.windowId).orElse(null);

        Map<String, Object> m = toMap(p);
        m.remove("likedBy");
        if (creator != null) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("id", creator.id);
            c.put("nickname", creator.nickname);
            c.put("avatar", creator.avatar);
            c.put("followers", creator.followers);
            m.put("creator", c);
        } else {
            m.put("creator", null);
        }
        if (work != null) m.put("work", workBrief(work));
        if (win != null) {
            Map<String, Object> w = new LinkedHashMap<>();
            w.put("id", win.id);
            w.put("status", win.status.value());
            w.put("updatedAt", win.updatedAt);
            w.put("auditLog", win.auditLog == null ? List.of() : win.auditLog);
            m.put("window", w);
        } else {
            // 原实现显式写 window: null（键必须存在），与 work（undefined → 省略）不同
            m.put("window", null);
        }
        m.put("patternMatIds", p.patternMatIds);
        m.put("modelMatIds", p.modelMatIds);
        m.put("patternMaterials", materialBrief(p.patternMatIds));
        m.put("modelMaterials", materialBrief(p.modelMatIds));
        Map<String, Object> viewer = new LinkedHashMap<>();
        viewer.put("liked", viewerId != null && p.likedBy != null && p.likedBy.contains(viewerId));
        User vu = viewerId == null ? null : userById(viewerId);
        viewer.put("collected", vu != null && vu.collectProductIds != null && vu.collectProductIds.contains(p.id));
        m.put("viewer", viewer);
        return m;
    }

    /* -------------------------------- 订单 DTO -------------------------------- */

    public Map<String, Object> orderDTO(Order o, Integer viewerId, Role role) {
        boolean isOwner = viewerId != null && o.buyerId == viewerId;
        boolean isSeller = viewerId != null && o.creatorId == viewerId;
        boolean noAfterSale = o.returnReq == null || "none".equals(o.returnReq.state);
        boolean settled = o.status == dreamweaver.entity.OrderStatus.RECEIVED
                || o.status == dreamweaver.entity.OrderStatus.COMPLETED;
        boolean canReturn = isOwner && o.kind == dreamweaver.entity.OrderKind.CUSTOM && settled && noAfterSale;
        boolean canExchange = canReturn;
        boolean canCancel = isOwner && ((o.kind == dreamweaver.entity.OrderKind.DIRECT
                && o.shippedAt == null && o.status != dreamweaver.entity.OrderStatus.CANCELLED)
                || (o.kind == dreamweaver.entity.OrderKind.CUSTOM
                        && o.status == dreamweaver.entity.OrderStatus.CREATED));
        boolean canPay = isOwner && o.status == dreamweaver.entity.OrderStatus.CREATED;
        boolean canConfirm = isOwner && o.status == dreamweaver.entity.OrderStatus.SHIPPING;

        Map<String, Object> m = toMap(o);
        if (o.stage != null) m.put("stage", o.stage);
        Map<String, Object> can = new LinkedHashMap<>();
        can.put("isOwner", isOwner);
        can.put("isSeller", isSeller);
        can.put("canReturn", canReturn);
        can.put("canExchange", canExchange);
        can.put("canCancel", canCancel);
        can.put("canPay", canPay);
        can.put("canConfirm", canConfirm);
        can.put("canAdvance", role == Role.AUDITOR || role == Role.ADMIN || isSeller || isOwner);
        m.put("can", can);
        return m;
    }

    /* -------------------------------- 内部工具 -------------------------------- */

    /** 实体 → Map（保留实体上 @JsonInclude(NON_NULL) 造成的“可选字段缺席”语义）。 */
    @SuppressWarnings("unchecked")
    public Map<String, Object> toMap(Object entity) {
        return json.convertValue(entity, new TypeReference<LinkedHashMap<String, Object>>() {
        });
    }

    private static <T> T firstOrNull(List<T> list) {
        return list == null || list.isEmpty() ? null : list.get(0);
    }

    public User userById(int id) {
        return userRepository.findById(id).orElse(null);
    }

    public Work workById(int id) {
        return workRepository.findById(id).orElse(null);
    }

    public Material materialById(int id) {
        return materialRepository.findById(id).orElse(null);
    }
}
