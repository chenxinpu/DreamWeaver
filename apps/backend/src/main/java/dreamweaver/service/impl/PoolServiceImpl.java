package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.AppSettings;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.PoolEvalResult;
import dreamweaver.entity.Post;
import dreamweaver.repository.AppSettingsRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.PostRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.PoolService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 资源池业务实现（取代原资源池引擎类，SPEC §3.1）。
 *
 * <ul>
 *   <li>每天 00:05 自动评估（scheduler）+ 点赞/评论/发帖增量评估 + POST /api/dev/eval-pool 手动</li>
 *   <li>P60 = 当日全平台推文点赞集合升序第 ceil(n*0.6) 个（n≥3）；n&lt;3 取 0</li>
 *   <li>合格：likes &gt; P60 或 commentCount ≥ 10 → PoolEntry（同推文同日只入池一次）</li>
 * </ul>
 */
@Service
public class PoolServiceImpl implements PoolService {

    /** 单行设置表固定主键（原内存库 settings 单行记录的等价物）。 */
    private static final int SETTINGS_ID = 1;

    private final PostRepository postRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final AppSettingsRepository appSettingsRepository;
    private final NotifyService notify;
    private final DtoMapper dto;

    public PoolServiceImpl(PostRepository postRepository,
                           PoolEntryRepository poolEntryRepository,
                           AppSettingsRepository appSettingsRepository,
                           NotifyService notify,
                           DtoMapper dto) {
        this.postRepository = postRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.appSettingsRepository = appSettingsRepository;
        this.notify = notify;
        this.dto = dto;
    }

    static double p60Of(List<Integer> likes) {
        int n = likes.size();
        if (n == 0) return 0;
        List<Integer> sorted = new ArrayList<>(likes);
        sorted.sort(Integer::compareTo);
        if (n >= 3) {
            int idx = (int) Math.ceil(n * 0.6) - 1;
            return sorted.get(Math.max(0, Math.min(n - 1, idx)));
        }
        // 冷启动（当日 <3 篇推文）：P60 置 0，点赞 >0 即视为超出当日热度分位
        return 0;
    }

    /** 评估某个日期（默认今天）的全平台推文，返回新增入池明细。 */
    @Override
    @Transactional
    public PoolEvalResult evalPool(String dateKey) {
        String key = dateKey == null || dateKey.isBlank() ? TimeUtil.dateKeyNow() : dateKey;
        List<Post> posts = postRepository.findByDateKey(key);
        List<Integer> likesAll = posts.stream().map(p -> p.likes).toList();
        double p60 = p60Of(likesAll);
        PoolEvalResult result = new PoolEvalResult();
        result.dateKey = key;
        result.p60 = p60;
        result.n = posts.size();

        for (Post post : posts) {
            if (post.authorId <= 0) continue;
            boolean above = post.likes > p60;
            boolean manyComments = post.commentCount >= 10;
            if (!above && !manyComments) continue;
            boolean already = poolEntryRepository.existsByPostIdAndDateKey(post.id, key);
            result.evaluated++;
            if (already) continue;

            List<String> reasons = new ArrayList<>();
            if (above) reasons.add("点赞超过当日P60");
            if (manyComments) reasons.add("评论数≥10");

            PoolEntry entry = new PoolEntry();
            entry.postId = post.id;
            entry.workId = post.workId;
            entry.creatorId = post.authorId;
            entry.qualifiedAt = TimeUtil.nowIso();
            entry.dateKey = key;
            entry.reason = String.join(" / ", reasons);
            entry.likeP60 = p60;
            entry.likeAtQualify = post.likes;
            entry.commentAtQualify = post.commentCount;
            entry.notifiedAt = TimeUtil.nowIso();
            poolEntryRepository.save(entry);
            result.added.add(entry);

            String link = post.workId != null
                    ? "/creator/window?workId=" + post.workId + "&from=pool&poolId=" + entry.id
                    : "/creator/pool?poolId=" + entry.id;
            notify.notify(post.authorId, "pool_remind", "🎉 作品已进入资源池",
                    "你的推文「" + cut(post.content, 24) + "…」" + entry.reason + "（当日 P60=" + fmtP60(p60)
                            + "，你的点赞 " + post.likes + "）。市场认可度达标！请准备真人穿搭图/规格表/3D与打版文件，上橱窗 → 审核通过即自动上架商城。",
                    link);
            result.explain.add("post#" + post.id + "(" + cut(post.content, 12) + "…) 点赞" + post.likes
                    + ">P60(" + fmtP60(p60) + ") " + (manyComments ? "且评论≥10" : "") + " → 已入池");
        }

        AppSettings settings = appSettingsRepository.findById(SETTINGS_ID).orElseGet(AppSettings::new);
        settings.lastPoolEval = TimeUtil.nowIso();
        appSettingsRepository.save(settings);
        return result;
    }

    /** 引擎说明（pool/meta 用）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> poolMeta() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("engine", "资源池自动筛选：当日全平台推文点赞升序 P60(ceil(0.6n))；点赞超过 P60 或评论≥10 自动入池");
        m.put("lastEval", appSettingsRepository.findById(SETTINGS_ID).map(s -> s.lastPoolEval).orElse(null));
        m.put("rule", List.of(
                "每日 00:05 自动评估一次；点赞/评论/发帖后对该作者推文增量评估",
                "点赞集合 P60 = 当日推文点赞数升序第 ceil(n*0.6) 个；当日不足 3 篇为冷启动，P60=0（点赞>0 即入池）",
                "合格即创建资源池条目并向创作者发送提醒（准备橱窗材料）"));
        return m;
    }

    /**
     * 当前创作者池（{@code GET /api/creator/pool}）：筛选 + qualifiedAt 倒序 + **手写 slice 分页**
     * （原实现不走 {@code paginate}，故此处不做 100 条上限与 page≥1 收口，交由 {@link #jsSlice} 复刻 JS 语义）。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> creatorPool(int creatorId, String page, String pageSize) {
        List<PoolEntry> entries = poolEntryRepository.findByCreatorIdOrderByQualifiedAtDesc(creatorId);

        int pageValue = numOr(page, 1);
        int pageSizeValue = numOr(pageSize, 20);
        long start = (long) (pageValue - 1) * pageSizeValue;

        List<Map<String, Object>> list = new ArrayList<>();
        for (PoolEntry e : jsSlice(entries, start, start + pageSizeValue)) {
            list.add(dto.poolEntryDTO(e, creatorId));
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("list", list);
        data.put("total", entries.size());
        data.put("page", pageValue);
        data.put("pageSize", pageSizeValue);
        data.put("meta", poolMeta());
        return data;
    }

    /**
     * {@code POST /api/dev/eval-pool} 的响应体：评估结果 + DTO 化的 {@code added}。
     *
     * <p>说明：{@link PoolService} 是冻结接口（只有 {@code evalPool}/{@code poolMeta}），
     * 该方法作为额外公开方法供 {@code PoolController} 调用，保持控制器无业务逻辑。
     */
    @Transactional
    public Map<String, Object> evalPoolResponse(Integer viewerId) {
        PoolEvalResult result = evalPool(null);   // null = 今天
        Map<String, Object> data = dto.toMap(result);
        List<Map<String, Object>> added = new ArrayList<>();
        for (PoolEntry e : result.added) {
            added.add(dto.poolEntryDTO(e, viewerId));
        }
        data.put("added", added);
        return data;
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 等价 JS 的 entries.slice(start, start + pageSize)（含负数下标语义） */
    private static <T> List<T> jsSlice(List<T> src, long start, long end) {
        int n = src.size();
        long s = start < 0 ? Math.max(0, n + start) : Math.min(start, n);
        long e = end < 0 ? Math.max(0, n + end) : Math.min(end, n);
        if (e <= s) return new ArrayList<>();
        return new ArrayList<>(src.subList((int) s, (int) e));
    }

    /** 等价 JS 的 `Number(x) || dft`（含 `?pageSize=0` → 默认值） */
    private static int numOr(String v, int dft) {
        int n = MiscUtil.toInt(v, dft);
        return n == 0 ? dft : n;
    }

    private static String fmtP60(double p60) {
        long l = Math.round(p60);
        return String.valueOf(l);
    }

    private static String cut(String s, int n) {
        if (s == null) return "";
        return s.length() <= n ? s : s.substring(0, n);
    }
}
