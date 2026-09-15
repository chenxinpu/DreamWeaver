package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.Material;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Product;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowStatus;
import dreamweaver.entity.Work;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.WorkService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** works 业务实现（原 {@code controller.WorksController} 的内联逻辑，逐行等价于 apps/server/src/routes/works.ts）。 */
@Service
public class WorkServiceImpl implements WorkService {

    private static final List<String> CATEGORIES = List.of("连衣裙", "衬衫", "半裙", "外套", "裤装", "套装");

    private final WorkRepository workRepository;
    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final ProductRepository productRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final DtoMapper dto;

    public WorkServiceImpl(WorkRepository workRepository,
                           UserRepository userRepository,
                           MaterialRepository materialRepository,
                           WindowMaterialRepository windowMaterialRepository,
                           ProductRepository productRepository,
                           PoolEntryRepository poolEntryRepository,
                           DtoMapper dto) {
        this.workRepository = workRepository;
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.productRepository = productRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.dto = dto;
    }

    /* ------------------------------- 组织作品 ------------------------------- */

    @Override
    @Transactional
    public Work create(int userId, Map<String, Object> body) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || user.role != Role.CREATOR) throw Errors.deny("仅创作者可组织作品");

        Map<String, Object> b = body == null ? Map.of() : body;
        if (falsy(b.get("title"))) throw Errors.bad("BAD_REQUEST", "请填写作品标题");
        Object category = b.get("category");
        if (category == null || !CATEGORIES.contains(String.valueOf(category))) {
            throw Errors.bad("BAD_REQUEST", "category 需为 " + String.join("/", CATEGORIES));
        }
        List<Integer> patternMatIds = intList(b.get("patternMatIds"));
        List<Integer> modelMatIds = intList(b.get("modelMatIds"));
        if (!owned(patternMatIds, userId) || !owned(modelMatIds, userId)) {
            throw Errors.bad("MATERIAL_NOT_OWNED", "素材不存在或不属于当前账号");
        }

        Work w = new Work();
        w.creatorId = userId;
        w.title = String.valueOf(b.get("title"));
        w.category = String.valueOf(category);
        w.styleTags = strList(b.get("styleTags"));
        w.fabric = falsy(b.get("fabric")) ? "" : String.valueOf(b.get("fabric"));
        w.desc = falsy(b.get("desc")) ? "" : String.valueOf(b.get("desc"));
        w.cover = falsy(b.get("cover")) ? "" : String.valueOf(b.get("cover"));
        w.patternMatIds = patternMatIds;
        w.modelMatIds = modelMatIds;
        w.mediaImages = strList(b.get("mediaImages"));
        w.createdAt = TimeUtil.nowIso();
        workRepository.save(w);
        return w;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> mine(Integer userId) {
        int creatorId = userId == null ? 0 : userId;
        List<Work> list = new ArrayList<>(workRepository.findByCreatorIdOrderByIdAsc(creatorId));
        list.sort((a, b) -> nz(b.createdAt).compareTo(nz(a.createdAt)));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("list", list);
        data.put("total", list.size());
        return data;
    }

    /** 编辑作品（作品管理 → 编辑） */
    @Override
    @Transactional
    public Work edit(Integer userId, int workId, Map<String, Object> body) {
        int uid = userId == null ? 0 : userId;
        Work w = workRepository.findById(workId).orElse(null);
        if (w == null) throw Errors.notFound("作品不存在");
        if (w.creatorId != uid) throw Errors.deny("只能编辑自己的作品");

        Map<String, Object> b = body == null ? Map.of() : body;
        if (b.containsKey("title")) w.title = String.valueOf(b.get("title"));
        if (b.containsKey("category")) {
            Object category = b.get("category");
            if (category == null || !CATEGORIES.contains(String.valueOf(category))) {
                throw Errors.bad("BAD_REQUEST", "category 需为 " + String.join("/", CATEGORIES));
            }
            w.category = String.valueOf(category);
        }
        if (b.get("styleTags") instanceof List<?>) w.styleTags = merged(w.styleTags, strList(b.get("styleTags")));
        if (b.containsKey("fabric")) w.fabric = String.valueOf(b.get("fabric"));
        if (b.containsKey("desc")) w.desc = String.valueOf(b.get("desc"));
        if (b.containsKey("cover")) w.cover = String.valueOf(b.get("cover"));
        if (b.get("mediaImages") instanceof List<?>) {
            w.mediaImages = merged(w.mediaImages, strList(b.get("mediaImages")));
        }
        if (b.containsKey("patternMatIds") || b.containsKey("modelMatIds")) {
            List<Integer> patternMatIds = b.get("patternMatIds") == null
                    ? new ArrayList<>(w.patternMatIds == null ? List.<Integer>of() : w.patternMatIds)
                    : intList(b.get("patternMatIds"));
            List<Integer> modelMatIds = b.get("modelMatIds") == null
                    ? new ArrayList<>(w.modelMatIds == null ? List.<Integer>of() : w.modelMatIds)
                    : intList(b.get("modelMatIds"));
            if (!owned(patternMatIds, uid) || !owned(modelMatIds, uid)) {
                throw Errors.bad("MATERIAL_NOT_OWNED", "素材不存在或不属于当前账号");
            }
            w.patternMatIds = merged(w.patternMatIds, patternMatIds);
            w.modelMatIds = merged(w.modelMatIds, modelMatIds);
        }
        workRepository.save(w);
        return w;
    }

    /** 删除作品（作品管理 → 删除）：已被橱窗材料/商品/资源池引用的作品不允许删除 */
    @Override
    @Transactional
    public Map<String, Object> remove(Integer userId, int workId) {
        int uid = userId == null ? 0 : userId;
        Work w = workRepository.findById(workId).orElse(null);
        if (w == null) throw Errors.notFound("作品不存在");
        if (w.creatorId != uid) throw Errors.deny("只能删除自己的作品");

        boolean usedByWindow = false;
        for (WindowMaterial win : windowMaterialRepository.findByWorkId(workId)) {
            if (win.status != WindowStatus.REJECTED) {
                usedByWindow = true;
                break;
            }
        }
        boolean usedByProduct = !productRepository.findByWorkId(workId).isEmpty();
        boolean usedByPool = !poolEntryRepository.findByWorkId(workId).isEmpty();
        if (usedByWindow || usedByProduct || usedByPool) {
            throw Errors.bad("WORK_IN_USE", "该作品已被橱窗/商品/资源池引用，无法删除；可先删除对应橱窗材料或下架商品");
        }
        workRepository.delete(w);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("deleted", true);
        data.put("id", w.id);
        return data;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> detail(int workId) {
        Work w = workRepository.findById(workId).orElse(null);
        if (w == null) throw Errors.notFound("作品不存在");
        List<PoolEntry> poolEntries = poolEntryRepository.findByWorkId(workId);
        Product product = productRepository.findByWorkId(workId).stream().findFirst().orElse(null);
        Map<String, Object> data = dto.toMap(w);
        data.put("inPool", !poolEntries.isEmpty());
        data.put("pool", poolEntries);
        if (product == null) {
            data.put("product", null);
        } else {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("id", product.id);
            pm.put("status", product.status);
            pm.put("title", product.title);
            data.put("product", pm);
        }
        return data;
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 等价原实现「每个 id 都必须是 uid 名下素材」（空集合恒为 true） */
    private boolean owned(List<Integer> ids, int uid) {
        for (Integer id : ids) {
            Material m = materialRepository.findById(id).orElse(null);
            if (m == null || m.creatorId != uid) return false;
        }
        return true;
    }

    /**
     * 元素集合（{@code @ElementCollection}）就地更新：实体上被 Hibernate 包装过的集合必须
     * {@code clear()+addAll()} 才能被脏检查捕获，直接换成新 List 有丢更新风险。
     */
    private static <T> List<T> merged(List<T> current, List<T> next) {
        if (current == null) return next;
        current.clear();
        current.addAll(next);
        return current;
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
}
