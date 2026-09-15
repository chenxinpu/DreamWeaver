package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.CommentItem;
import dreamweaver.entity.Material;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Post;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.Work;
import dreamweaver.repository.CommentRepository;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.PoolService;
import dreamweaver.service.PostService;
import dreamweaver.service.RealtimeService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** feed / posts 业务实现（原 {@code controller.FeedController} 的内联逻辑，逐行等价于 apps/server/src/routes/feed.ts）。 */
@Service
public class PostServiceImpl implements PostService {

    /** 原实现：const TAGS_REG = /#[^\s#，,]+/g（\s 为 JS 语义，含全角空格/NBSP） */
    private static final Pattern TAGS_REG = Pattern.compile("#[^\\s#，,]+", Pattern.UNICODE_CHARACTER_CLASS);

    /** JS Date.parse 失败（NaN）时用于比较的哨兵值：任何真实时间都远大于它 */
    private static final long TS_MISSING = -9_000_000_000_000L;

    private static final long DAY_MS = 86_400_000L;

    private final PostRepository postRepository;
    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final WorkRepository workRepository;
    private final MaterialRepository materialRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final DtoMapper dto;
    private final PoolService poolService;
    private final NotifyService notify;
    private final RealtimeService realtime;

    public PostServiceImpl(PostRepository postRepository,
                           CommentRepository commentRepository,
                           UserRepository userRepository,
                           WorkRepository workRepository,
                           MaterialRepository materialRepository,
                           PoolEntryRepository poolEntryRepository,
                           DtoMapper dto,
                           PoolService poolService,
                           NotifyService notify,
                           RealtimeService realtime) {
        this.postRepository = postRepository;
        this.commentRepository = commentRepository;
        this.userRepository = userRepository;
        this.workRepository = workRepository;
        this.materialRepository = materialRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.dto = dto;
        this.poolService = poolService;
        this.notify = notify;
        this.realtime = realtime;
    }

    /* ------------------------------- 发推文 ------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> createPost(int userId, Map<String, Object> body) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw Errors.deny();
        if (user.role != Role.CREATOR) throw Errors.deny("仅创作者可发布推文");

        Map<String, Object> b = body == null ? Map.of() : body;
        String content = falsy(b.get("content")) ? "" : String.valueOf(b.get("content"));
        if (jsTrim(content).isEmpty()) throw Errors.bad("BAD_REQUEST", "推文内容不能为空");

        Object workIdRaw = b.get("workId");
        boolean hasWorkId = !falsy(workIdRaw);
        Work work = null;
        if (hasWorkId) {
            Integer wid = MiscUtil.toIntOrNull(workIdRaw);
            if (wid != null) work = workOfCreator(wid, userId);
        }
        if (hasWorkId && work == null) throw Errors.bad("WORK_NOT_FOUND", "关联作品不存在");

        List<Integer> patternMatIds = intList(b.get("patternMatIds"));
        List<Integer> modelMatIds = intList(b.get("modelMatIds"));
        List<Integer> allMatIds = new ArrayList<>(patternMatIds);
        allMatIds.addAll(modelMatIds);
        if (!allMatIds.isEmpty()) {
            for (Integer mid : allMatIds) {
                if (!materialOwned(mid, userId)) {
                    throw Errors.bad("MATERIAL_NOT_OWNED", "素材不存在或不属于当前账号");
                }
            }
        }

        // 素材预览：images 自动补素材封面
        List<String> images = strList(b.get("images"));
        if (images.isEmpty() && work != null && work.mediaImages != null && !work.mediaImages.isEmpty()) {
            images.addAll(work.mediaImages.subList(0, Math.min(3, work.mediaImages.size())));
        }
        for (Integer mid : allMatIds) {
            Material m = materialRepository.findById(mid).orElse(null);
            if (m != null && m.cover != null && !m.cover.isEmpty() && images.size() < 6) images.add(m.cover);
        }

        Object tagsRaw = b.get("tags");
        List<String> tags;
        if (tagsRaw instanceof List<?> tl && !tl.isEmpty()) {
            tags = strList(tagsRaw);
        } else {
            tags = new ArrayList<>();
            Matcher matcher = TAGS_REG.matcher(content);
            while (matcher.find() && tags.size() < 6) {
                String t = matcher.group();
                tags.add(t.length() > 1 ? t.substring(1) : "");
            }
        }

        Post p = new Post();
        p.authorId = userId;
        if (work != null) p.workId = work.id;
        p.content = content;
        p.images = new ArrayList<>(images.subList(0, Math.min(9, images.size())));
        p.tags = tags;
        p.createdAt = TimeUtil.nowIso();
        p.dateKey = TimeUtil.dateKeyNow();
        p.likes = 0;
        p.likedBy = new ArrayList<>();
        p.comments = new ArrayList<>();
        p.commentCount = 0;
        p.shareCount = 0;
        p.patternMatIds = patternMatIds;
        p.modelMatIds = modelMatIds;
        postRepository.save(p);

        // 发布后增量评估（作者今日推文）
        poolService.evalPool(TimeUtil.dateKeyNow());

        User author = userRepository.findById(userId).orElse(null);
        Map<String, Object> data = dto.postDTO(p, userId, true);
        data.put("materialPreview", dto.materialBrief(allMatIds));
        data.put("author", author == null ? null : dto.toUserPublic(author));
        return data;
    }

    /* ------------------------------- 信息流 ------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> feed(Integer viewerId, String tab, String page, String pageSize) {
        String tabValue = falsy(tab) ? "rec" : tab;
        User user = viewerId == null ? null : userRepository.findById(viewerId).orElse(null);
        List<Post> posts = new ArrayList<>(postRepository.findAll());

        if ("follow".equals(tabValue) && user != null && user.follows != null && !user.follows.isEmpty()) {
            Set<Integer> followed = new HashSet<>(user.follows);
            posts.removeIf(p -> !followed.contains(p.authorId));
        } else if ("hot".equals(tabValue)) {
            // 近 7 天按互动热度
            long weekAgo = System.currentTimeMillis() - 7 * DAY_MS;
            posts.removeIf(p -> {
                Long ts = MiscUtil.parseTs(p.createdAt);
                return (ts == null ? TS_MISSING : ts) < weekAgo;
            });
            posts.sort((a, b) -> Integer.compare(hotScore(b), hotScore(a)));
        } else {
            // rec：关注优先 + 热度补足（确定性）
            Set<Integer> followSet = user == null || user.follows == null ? Set.of() : new HashSet<>(user.follows);
            long now = System.currentTimeMillis();
            List<Post> rec = new ArrayList<>();
            List<Post> other = new ArrayList<>();
            for (Post p : posts) {
                if (followSet.contains(p.authorId)) rec.add(p);
                else other.add(p);
            }
            rec.sort((a, b) -> Double.compare(recScore(b, now), recScore(a, now)));
            other.sort((a, b) -> Double.compare(recScore(b, now), recScore(a, now)));
            List<Post> merged = new ArrayList<>(rec);
            merged.addAll(other);
            posts = merged;
        }
        posts.sort((a, b) -> nz(b.createdAt).compareTo(nz(a.createdAt)));

        Map<String, Object> paged = MiscUtil.paginate(posts, numOr(page, 1), numOr(pageSize, 10));
        List<Map<String, Object>> list = new ArrayList<>();
        if (paged.get("list") instanceof List<?> slice) {
            for (Object o : slice) {
                if (o instanceof Post p) list.add(dto.postDTO(p, viewerId));
            }
        }
        paged.put("list", list);
        paged.put("tab", tabValue);
        paged.put("meta", poolService.poolMeta());
        return paged;
    }

    /** 我的推文（作者本人，按近 1/3/7 天筛选；每条附带 market 市场认可进度） */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> myPosts(int userId, String days, String page, String pageSize) {
        int d = Math.min(30, Math.max(1, numOr(days, 7)));
        long since = System.currentTimeMillis() - (long) d * DAY_MS;

        List<Post> list = new ArrayList<>();
        for (Post p : postRepository.findByAuthorId(userId)) {
            Long ts = MiscUtil.parseTs(p.createdAt);
            if ((ts == null ? TS_MISSING : ts) >= since) list.add(p);
        }
        list.sort((a, b) -> nz(b.createdAt).compareTo(nz(a.createdAt)));

        Map<String, Object> paged = MiscUtil.paginate(list, numOr(page, 1), numOr(pageSize, 30));
        List<Map<String, Object>> out = new ArrayList<>();
        if (paged.get("list") instanceof List<?> slice) {
            for (Object o : slice) {
                if (o instanceof Post p) out.add(dto.postDTO(p, userId, true));
            }
        }
        paged.put("days", d);
        paged.put("list", out);
        return paged;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> postDetail(Integer viewerId, int postId) {
        Post p = postById(postId);
        return dto.postDTO(p, viewerId, true);
    }

    /* ------------------------------- 互动 ------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> like(int userId, int postId) {
        Post p = postById(postId);
        toggleLike(p, userId, true);
        poolService.evalPool(TimeUtil.dateKeyNow());
        realtime.publishPostInteraction(p, "like");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("likes", p.likes);
        data.put("liked", true);
        return data;
    }

    @Override
    @Transactional
    public Map<String, Object> unlike(int userId, int postId) {
        Post p = postById(postId);
        toggleLike(p, userId, false);
        realtime.publishPostInteraction(p, "unlike");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("likes", p.likes);
        data.put("liked", false);
        return data;
    }

    @Override
    @Transactional
    public Map<String, Object> comment(int userId, int postId, Map<String, Object> body) {
        Post p = postById(postId);

        Map<String, Object> b = body == null ? Map.of() : body;
        Object raw = b.get("content");
        String content = falsy(raw) ? "" : jsTrim(String.valueOf(raw));
        if (content.isEmpty()) throw Errors.bad("BAD_REQUEST", "评论不能为空");

        // CommentItem 直接用 CommentRepository 落库：主键 IDENTITY 在 save() 时即生成，
        // 保证响应里的 comment.id 与后续 GET /posts/{id} 读回的一致；
        // 同时把 c 挂到 p.comments（@OneToMany mappedBy 的反向集合，只影响内存，不产生重复插入）。
        CommentItem c = new CommentItem();
        c.post = p;
        c.userId = userId;
        c.content = content;
        c.createdAt = TimeUtil.nowIso();
        c.likes = 0;
        commentRepository.save(c);
        if (p.comments == null) p.comments = new ArrayList<>();
        p.comments.add(c);
        p.commentCount = p.comments.size();
        postRepository.save(p);
        poolService.evalPool(TimeUtil.dateKeyNow());

        if (p.authorId != userId) {
            notify.notify(p.authorId, "comment", "💬 收到了新评论",
                    nicknameOf(userId) + " 评论：「" + cut(content, 24) + "」", "/post/" + p.id);
        }

        realtime.publishPostInteraction(p, "comment");

        User u = userRepository.findById(userId).orElse(null);
        Map<String, Object> comment = dto.toMap(c);
        comment.put("author", u == null ? null : dto.toUserPublic(u));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("comment", comment);
        data.put("commentCount", p.commentCount);
        return data;
    }

    @Override
    @Transactional
    public Map<String, Object> share(int postId) {
        Post p = postById(postId);
        p.shareCount++;
        postRepository.save(p);
        realtime.publishPostInteraction(p, "share");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("shareCount", p.shareCount);
        return data;
    }

    /* --------------------------- 首页达人/精选补充 --------------------------- */

    /** 消费者首页补充：达人/官方精选（可选） */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> recommendSeed() {
        List<User> creators = new ArrayList<>(userRepository.findByRole(Role.CREATOR));
        creators.sort((a, b) -> Integer.compare(b.followers, a.followers));
        if (creators.size() > 6) creators = new ArrayList<>(creators.subList(0, 6));

        List<Map<String, Object>> creatorList = new ArrayList<>();
        for (User c : creators) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", c.id);
            m.put("nickname", c.nickname);
            m.put("avatar", c.avatar);
            m.put("bio", c.bio);
            m.put("followers", c.followers);
            creatorList.add(m);
        }

        List<Work> featured = new ArrayList<>();
        for (PoolEntry e : poolEntryRepository.findAll()) {
            if (e.workId == null) continue;
            Work w = workRepository.findById(e.workId).orElse(null);
            if (w != null) featured.add(w);
        }
        if (featured.size() > 4) featured = new ArrayList<>(featured.subList(0, 4));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("creators", creatorList);
        data.put("featured", featured);
        return data;
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 点赞/取消赞 通用处理器（幂等：重复点赞/取消不改变计数）。 */
    private void toggleLike(Post p, int uid, boolean doLike) {
        List<Integer> likedBy = p.likedBy == null ? new ArrayList<>() : p.likedBy;
        boolean has = likedBy.contains(uid);
        if (doLike && !has) {
            likedBy.add(uid);
            p.likedBy = likedBy;
            p.likes++;
        }
        if (!doLike && has) {
            likedBy.remove(Integer.valueOf(uid));
            p.likedBy = likedBy;
            p.likes = Math.max(0, p.likes - 1);
        }
        postRepository.save(p);
        if (doLike && !has && p.authorId != uid) {
            notify.notify(p.authorId, "like", "❤️ 收到了新点赞",
                    nicknameOf(uid) + " 赞了你的推文「" + cut(p.content, 20) + "…」", "/post/" + p.id);
        }
    }

    private static int hotScore(Post p) {
        return p.likes + p.commentCount * 3 + p.shareCount * 2;
    }

    private static double recScore(Post p, long now) {
        Long createdTs = MiscUtil.parseTs(p.createdAt);
        double freshness = Math.max(0, 3 - (now - (createdTs == null ? TS_MISSING : createdTs)) / 86_400_000.0);
        return p.likes + p.commentCount * 4 + p.shareCount * 2 + freshness * 2;
    }

    private Post postById(int id) {
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) throw Errors.notFound("推文不存在");
        return p;
    }

    private Work workOfCreator(int id, int uid) {
        Work w = workRepository.findById(id).orElse(null);
        return w != null && w.creatorId == uid ? w : null;
    }

    private boolean materialOwned(int id, int uid) {
        Material m = materialRepository.findById(id).orElse(null);
        return m != null && m.creatorId == uid;
    }

    /** 等价原实现「按 uid 查昵称，查不到或为空则回退『用户』」 */
    private String nicknameOf(int uid) {
        User u = userRepository.findById(uid).orElse(null);
        return u == null || u.nickname == null || u.nickname.isEmpty() ? "用户" : u.nickname;
    }

    private static String cut(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n);
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static List<String> strList(Object v) {
        List<String> out = new ArrayList<>();
        if (v instanceof List<?> l) {
            for (Object o : l) out.add(o == null ? "null" : String.valueOf(o));   // JS String(x)
        }
        return out;
    }

    private static List<Integer> intList(Object v) {
        List<Integer> out = new ArrayList<>();
        if (v instanceof List<?> l) {
            for (Object o : l) {
                Integer n = MiscUtil.toIntOrNull(o);
                if (n != null) out.add(n);
            }
        }
        return out;
    }

    /** 等价 JS 的 `Number(x) || dft`（含 `?pageSize=0` → 默认值） */
    private static int numOr(String v, int dft) {
        int n = MiscUtil.toInt(v, dft);
        return n == 0 ? dft : n;
    }

    /** 等价 JS 的真值判断（''、0、NaN、false、null/undefined 为假） */
    private static boolean falsy(Object v) {
        if (v == null) return true;
        if (v instanceof Boolean b) return !b;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d == 0 || Double.isNaN(d);
        }
        return String.valueOf(v).isEmpty();
    }

    /** 等价 JS 的 String.prototype.trim()（含全角空格/NBSP/BOM） */
    private static String jsTrim(String s) {
        int start = 0;
        int end = s.length();
        while (start < end && isJsSpace(s.charAt(start))) start++;
        while (end > start && isJsSpace(s.charAt(end - 1))) end--;
        return s.substring(start, end);
    }

    private static boolean isJsSpace(char c) {
        return c == '\u00A0' || c == '\uFEFF' || Character.isWhitespace(c) || Character.isSpaceChar(c);
    }
}
