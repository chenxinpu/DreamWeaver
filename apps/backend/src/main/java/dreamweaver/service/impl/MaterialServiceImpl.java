package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.Material;
import dreamweaver.entity.MaterialKind;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.Work;
import dreamweaver.parser.ParsePayload;
import dreamweaver.parser.ParsedFields;
import dreamweaver.parser.Parsers;
import dreamweaver.parser.SamplesProvider;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.MaterialService;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 素材业务实现：逐行等价改造前的 {@code MaterialsController}
 * （对应原 {@code apps/server/src/routes/materials.ts}）。
 *
 * <p>持久化统一走 {@link MaterialRepository}：主键由数据库 {@code IDENTITY} 生成，
 * 事务提交时由 JPA 自动 flush。
 */
@Service
public class MaterialServiceImpl implements MaterialService {

    private final MaterialRepository materialRepository;
    private final UserRepository userRepository;
    private final WorkRepository workRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final Parsers parsers;
    private final SamplesProvider samplesProvider;

    public MaterialServiceImpl(MaterialRepository materialRepository,
                               UserRepository userRepository,
                               WorkRepository workRepository,
                               WindowMaterialRepository windowMaterialRepository,
                               Parsers parsers,
                               SamplesProvider samplesProvider) {
        this.materialRepository = materialRepository;
        this.userRepository = userRepository;
        this.workRepository = workRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.parsers = parsers;
        this.samplesProvider = samplesProvider;
    }

    /* ------------------------------- 导入帮助 ------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> importHelp() {
        Map<String, Object> out = new LinkedHashMap<>(parsers.importHelpText());
        List<SamplesProvider.SampleFile> samples;
        try {
            samples = parsers.samples();
        } catch (Exception e) {
            samples = new ArrayList<>();   // 原实现：读取 samples 目录失败时降级为空列表
        }
        if (samples == null) samples = new ArrayList<>();
        out.put("samples", samples);
        out.put("samplePath", "/api/materials/sample-content?file=");
        return out;
    }

    /* ------------------------------- 示例原文 ------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public SamplesProvider.SampleContent sampleContent(String file) {
        String safe = baseName(file == null ? "" : file);
        // 原实现：常量路径下 fs.existsSync(p) 失败 → bad('NOT_FOUND','示例文件不存在')（400 + NOT_FOUND）
        Path p = safe.isEmpty() ? null : samplesProvider.samplesDir().resolve(safe);
        if (p == null || !Files.exists(p)) throw Errors.bad("NOT_FOUND", "示例文件不存在");
        SamplesProvider.SampleContent sc = parsers.readSample(safe);
        if (sc == null) throw Errors.bad("NOT_FOUND", "示例文件不存在");
        return sc;
    }

    /* ------------------------------- 导入入库 ------------------------------- */

    @Override
    @Transactional
    public Material importMaterial(Integer currentUserId, Map<String, Object> body) {
        User user = currentUserId == null ? null : userRepository.findById(currentUserId).orElse(null);
        if (user == null) throw Errors.deny();
        int uid = user.id;

        Map<String, Object> b = body == null ? Map.of() : body;

        Object nameRaw = b.get("fileName");
        if (falsy(nameRaw)) nameRaw = b.get("filename");
        String fileName = falsy(nameRaw) ? "" : String.valueOf(nameRaw);
        if (fileName.isEmpty()) throw Errors.bad("BAD_REQUEST", "请提供 fileName");

        Object kindRaw = b.get("kind");
        MaterialKind kind = falsy(kindRaw)
                ? parsers.guessKindByExt(fileName)
                : MaterialKind.of(String.valueOf(kindRaw));

        List<String> tags = strList(b.get("tags"));

        // 文本格式内容可能是 text 或 base64（兼容两种传法）
        boolean isTextKind = Parsers.TEXT_KINDS.contains(kind);
        String content = b.containsKey("content") ? String.valueOf(b.get("content")) : null;
        String base64 = b.containsKey("base64") ? String.valueOf(b.get("base64")) : null;

        String ext = extOf(fileName, kind);

        ParsePayload payload = new ParsePayload();
        payload.kind = kind;
        payload.ext = ext;
        payload.fileName = fileName;
        payload.text = content;
        payload.base64 = isTextKind ? base64 : (base64 == null || base64.isEmpty() ? content : base64);

        ParsedFields parsed;
        try {
            parsed = parsers.parseByKind(payload);
        } catch (RuntimeException e) {
            String msg = e.getMessage() == null ? "" : e.getMessage();
            throw Errors.bad("PARSE_FAILED", "解析失败：" + msg);
        }

        Material m = new Material();
        m.creatorId = uid;
        m.title = falsy(b.get("title")) ? baseNameNoExt(fileName) : String.valueOf(b.get("title"));
        m.kind = parsed.kind;
        m.ext = parsed.ext;
        m.size = parsed.size;
        m.fileName = fileName;
        if (parsed.layerNames != null) m.layerNames = parsed.layerNames;
        if (parsed.entityCount != null) m.entityCount = parsed.entityCount;
        if (parsed.patternSvg != null && !parsed.patternSvg.isEmpty()) m.patternSvg = parsed.patternSvg;
        if (parsed.objPreview != null) m.objPreview = parsed.objPreview;
        if (parsed.cover != null && !parsed.cover.isEmpty()) m.cover = parsed.cover;
        if (parsed.width != null) m.width = parsed.width;
        if (parsed.height != null) m.height = parsed.height;
        if (parsed.note != null && !parsed.note.isEmpty()) m.note = parsed.note;
        if (parsed.parseWarn != null && !parsed.parseWarn.isEmpty()) m.parseWarn = parsed.parseWarn;
        m.tags = tags;
        m.createdAt = TimeUtil.nowIso();

        // 主键由数据库生成（@GeneratedValue IDENTITY）：save() 后直接读返回实体的 id
        return materialRepository.save(m);
    }

    /* --------------------------------- 列表 --------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> list(int currentUserId, String mine, String kind, String kw,
                                    String userId, String page, String pageSize) {
        boolean onlyMine = !"0".equals(falsy(mine) ? "1" : mine);
        String kindFilter = falsy(kind) ? null : kind;
        String kwFilter = falsy(kw) ? null : kw;
        int targetUserId;
        if (falsy(userId)) {
            targetUserId = currentUserId;
        } else {
            Integer v = MiscUtil.toIntOrNull(userId);
            // 非法 userId 等价 JS 的 NaN：不匹配任何素材
            targetUserId = v == null ? -1 : v;
        }

        List<Material> base;
        if (!onlyMine) {
            // mine=0：全量素材（MaterialRepository 无「全量按时间倒序」派生方法，取出后统一过滤）
            base = materialRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"));
        } else if (kindFilter != null) {
            MaterialKind exact = exactKind(kindFilter);
            // 未知 kind 等价原实现的不匹配任何素材
            base = exact == null ? List.of()
                    : materialRepository.findByCreatorIdAndKindOrderByCreatedAtDesc(targetUserId, exact);
        } else {
            base = materialRepository.findByCreatorIdOrderByCreatedAtDesc(targetUserId);
        }

        List<Material> filtered = new ArrayList<>();
        String kwLower = kwFilter == null ? null : kwFilter.toLowerCase(Locale.ROOT);
        for (Material m : base) {
            if (kindFilter != null && !kindFilter.equals(m.kind.value())) continue;
            if (kwLower != null) {
                List<String> tagList = m.tags;
                if (tagList == null) tagList = List.of();
                String hay = (nz(m.title) + nz(m.fileName) + String.join(" ", tagList)).toLowerCase(Locale.ROOT);
                if (!hay.contains(kwLower)) continue;
            }
            filtered.add(m);
        }
        // 等价原实现：按 createdAt 倒序（空值视为 ""），稳定排序保留同刻素材的原有先后
        filtered.sort((a, b) -> nz(b.createdAt).compareTo(nz(a.createdAt)));

        Map<String, Object> paged = MiscUtil.paginate(filtered, numOr(page, 1), numOr(pageSize, 20));

        // 分组计数基于「该用户全部素材」，不受 kind/kw/分页影响
        Map<String, Object> group = new LinkedHashMap<>();
        for (Material m : materialRepository.findByCreatorId(targetUserId)) {
            String key = m.kind.value();
            Object prev = group.get(key);
            group.put(key, (prev == null ? 0 : ((Number) prev).intValue()) + 1);
        }

        paged.put("group", group);
        return paged;
    }

    /* ------------------------------- 详情/删除 ------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public Material detail(long id) {
        return materialRepository.findById((int) id)
                .orElseThrow(() -> Errors.notFound("素材不存在"));
    }

    @Override
    @Transactional
    public Map<String, Object> remove(Integer currentUserId, long id) {
        int uid = currentUserId == null ? 0 : currentUserId;
        int materialId = (int) id;
        Material m = materialRepository.findById(materialId).orElse(null);
        if (m == null) throw Errors.notFound("素材不存在");
        if (m.creatorId != uid) throw Errors.deny("只能删除自己的素材");

        boolean usedByWork = false;
        for (Work w : workRepository.findByCreatorIdOrderByCreatedAtDesc(uid)) {
            if (idList(w.patternMatIds).contains(materialId) || idList(w.modelMatIds).contains(materialId)) {
                usedByWork = true;
                break;
            }
        }
        boolean usedByWindow = false;
        for (WindowMaterial w : windowMaterialRepository.findByCreatorIdOrderByUpdatedAtDesc(uid)) {
            if (idList(w.patternMatIds).contains(materialId) || idList(w.modelMatIds).contains(materialId)) {
                usedByWindow = true;
                break;
            }
        }
        if (usedByWork || usedByWindow) {
            throw Errors.bad("MATERIAL_IN_USE", "素材正被作品/橱窗材料使用，无法删除");
        }

        materialRepository.deleteById(materialId);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deleted", true);
        return data;
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 精确解析 kind 过滤值：只认枚举的小写值，未知取值返回 null（等价原实现的「不匹配任何素材」）。 */
    private static MaterialKind exactKind(String kindFilter) {
        for (MaterialKind k : MaterialKind.values()) {
            if (k.value().equals(kindFilter)) return k;
        }
        return null;
    }

    private static List<Integer> idList(List<Integer> ids) {
        return ids == null ? List.of() : ids;
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

    /** 等价 Node 的 path.extname（含以 '.' 开头的隐藏文件名返回 ''）。 */
    private static String rawExt(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot <= 0) return "";
        return fileName.substring(dot);
    }

    /** 等价 TS：path.extname(fileName).replace('.','').toLowerCase() || kind */
    private static String extOf(String fileName, MaterialKind kind) {
        String raw = rawExt(fileName);
        String ext = raw.isEmpty() ? "" : raw.substring(1).toLowerCase(Locale.ROOT);
        return ext.isEmpty() ? kind.value() : ext;
    }

    /** 等价 Node 的 path.basename(p)（仅按 '/' 切分、去掉尾部斜杠） */
    private static String baseName(String p) {
        String s = p;
        int end = s.length();
        while (end > 0 && s.charAt(end - 1) == '/') end--;
        s = s.substring(0, end);
        int slash = s.lastIndexOf('/');
        return slash >= 0 ? s.substring(slash + 1) : s;
    }

    /** 等价 Node 的 path.basename(fileName, path.extname(fileName)) */
    private static String baseNameNoExt(String fileName) {
        String base = baseName(fileName);
        String ext = rawExt(fileName);
        if (!ext.isEmpty() && base.endsWith(ext)) return base.substring(0, base.length() - ext.length());
        return base;
    }
}
