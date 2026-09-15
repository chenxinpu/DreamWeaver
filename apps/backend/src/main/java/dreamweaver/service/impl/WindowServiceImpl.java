package dreamweaver.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.AuditLogItem;
import dreamweaver.entity.FabricPart;
import dreamweaver.entity.Product;
import dreamweaver.entity.Role;
import dreamweaver.entity.SizeChartRow;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.WindowSpec;
import dreamweaver.entity.WindowStatus;
import dreamweaver.entity.Work;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.ProductService;
import dreamweaver.service.WindowService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 橱窗材料业务实现（对应原橱窗审核引擎 + {@code WindowController} 内的请求体解析/鉴权/定价规则）。
 *
 * <ul>
 *   <li>完整性规则 → 通过即生成 AI 商品详情页 {@link Product}(onSale) 并上架（id 由数据库生成）；</li>
 *   <li>任一缺失 → rejected + auditLog + 通知补材料；</li>
 *   <li>草稿保存 / 修改重提 / 删除 / 列表 / 详情。</li>
 * </ul>
 *
 * <p>原价与基础费用不再由创作者填写，提交时若缺失由平台按品类默认定价补齐，故不参与完整性校验。
 *
 * <p>本类实现冻结接口 {@link WindowService}（审核能力），并额外暴露橱窗材料的 CRUD 业务方法，
 * 供 {@code controller.WindowController} 直接调用（控制器只做参数解析 + 包响应）。
 */
@Service
public class WindowServiceImpl implements WindowService {

    private static final List<String> CATEGORIES = List.of("连衣裙", "衬衫", "半裙", "外套", "裤装", "套装");

    /** 平台默认定价（橱窗材料表单不再采集原价/基础费用，审核通过时由平台按品类给参考价）。 */
    private static final Map<String, Double> DEFAULT_PRICE = Map.of(
            "连衣裙", 299.0, "衬衫", 189.0, "半裙", 169.0, "外套", 699.0, "裤装", 229.0, "套装", 459.0);
    private static final Map<String, Double> DEFAULT_BASE_FEE = Map.of(
            "连衣裙", 79.0, "衬衫", 59.0, "半裙", 59.0, "外套", 109.0, "裤装", 69.0, "套装", 99.0);

    private final WindowMaterialRepository windowMaterialRepository;
    private final WorkRepository workRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final ProductService productService;
    private final NotifyService notify;
    private final DtoMapper dto;
    private final ObjectMapper json;

    public WindowServiceImpl(WindowMaterialRepository windowMaterialRepository,
                             WorkRepository workRepository,
                             ProductRepository productRepository,
                             UserRepository userRepository,
                             ProductService productService,
                             NotifyService notify,
                             DtoMapper dto,
                             ObjectMapper json) {
        this.windowMaterialRepository = windowMaterialRepository;
        this.workRepository = workRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.productService = productService;
        this.notify = notify;
        this.dto = dto;
        this.json = json;
    }

    /* -------------------------------- 列表/详情 -------------------------------- */

    /** 我的橱窗材料列表（可按状态过滤，按 updatedAt 倒序）。 */
    @Transactional(readOnly = true)
    public Map<String, Object> list(int uid, String status) {
        String filter = status == null || status.isEmpty() ? null : status;

        List<WindowMaterial> windows;
        if (filter == null) {
            windows = new ArrayList<>(windowMaterialRepository.findByCreatorIdOrderByUpdatedAtDesc(uid));
        } else {
            WindowStatus st = statusOf(filter);
            windows = st == null
                    ? new ArrayList<>()
                    : new ArrayList<>(windowMaterialRepository
                            .findByCreatorIdAndStatusOrderByUpdatedAtDesc(uid, st));
        }
        // 复刻原实现的字符串排序语义（updatedAt 倒序，null 视为 ""）
        windows.sort((a, b) -> MiscUtil.toStr(b.updatedAt, "").compareTo(MiscUtil.toStr(a.updatedAt, "")));

        List<Map<String, Object>> list = new ArrayList<>();
        for (WindowMaterial w : windows) {
            Map<String, Object> m = dto.toMap(w);
            Work work = w.workId == 0 ? null : workRepository.findById(w.workId).orElse(null);
            Product product = firstProductOfWindow(w.id);
            Map<String, Object> wb = null;
            if (work != null) {
                wb = new LinkedHashMap<>();
                wb.put("id", work.id);
                wb.put("title", work.title);
                wb.put("cover", work.cover);
            }
            Map<String, Object> pb = null;
            if (product != null) {
                pb = new LinkedHashMap<>();
                pb.put("id", product.id);
                pb.put("title", product.title);
                pb.put("status", product.status);
            }
            m.put("work", wb);
            m.put("product", pb);
            list.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("list", list);
        out.put("total", list.size());
        return out;
    }

    /** 橱窗材料详情（创作者本人 / 审核员 / 管理员）。 */
    @Transactional(readOnly = true)
    public Map<String, Object> detail(int uid, int id) {
        WindowMaterial w = windowMaterialRepository.findById(id).orElse(null);
        if (w == null) throw Errors.notFound("橱窗材料不存在");
        if (w.creatorId != uid) {
            User user = userRepository.findById(uid).orElse(null);
            if (user == null || (user.role != Role.AUDITOR && user.role != Role.ADMIN)) {
                throw Errors.deny();
            }
        }
        Work work = w.workId == 0 ? null : workRepository.findById(w.workId).orElse(null);
        Product product = firstProductOfWindow(w.id);

        Map<String, Object> m = dto.toMap(w);
        m.put("work", work == null ? null : dto.toMap(work));
        m.put("product", product == null ? null : dto.toMap(product));
        m.put("completeness", completenessMap(checkCompleteness(w)));
        return m;
    }

    /* -------------------------------- 新建/更新 -------------------------------- */

    /** 新建橱窗材料（action=submit 时当场审核）。 */
    @Transactional
    public Map<String, Object> create(int uid, Map<String, Object> body) {
        Map<String, Object> b = body == null ? new LinkedHashMap<String, Object>() : body;

        User user = userRepository.findById(uid).orElse(null);
        if (user == null || user.role != Role.CREATOR) {
            throw Errors.deny("仅创作者可提交橱窗材料");
        }

        WindowBody rb = readBody(b);
        Work work = workByIdAndCreator(rb.workId, uid);
        if (work == null) throw Errors.bad("WORK_NOT_FOUND", "作品不存在");
        if (!CATEGORIES.contains(rb.category)) {
            throw Errors.bad("BAD_REQUEST", "category 需为 " + String.join("/", CATEGORIES));
        }

        String at = TimeUtil.nowIso();
        WindowMaterial w = new WindowMaterial();
        w.creatorId = uid;
        w.workId = rb.workId;
        w.postId = rb.postId;
        w.status = WindowStatus.DRAFT;
        w.photos = rb.photos;
        w.partsFabric = rb.partsFabric;
        w.spec = rb.spec;
        w.productName = isBlank(rb.productName) ? work.title : rb.productName;
        w.category = rb.category;
        w.styleTags = rb.styleTags.isEmpty()
                ? (work.styleTags != null ? work.styleTags : new ArrayList<String>())
                : rb.styleTags;
        w.price = rb.price;
        w.baseFee = rb.baseFee;
        w.patternMatIds = rb.patternMatIds.isEmpty()
                ? (work.patternMatIds != null ? work.patternMatIds : new ArrayList<Integer>())
                : rb.patternMatIds;
        w.modelMatIds = rb.modelMatIds.isEmpty()
                ? (work.modelMatIds != null ? work.modelMatIds : new ArrayList<Integer>())
                : rb.modelMatIds;
        w.auditLog = new ArrayList<>();
        w.createdAt = at;
        w.updatedAt = at;
        windowMaterialRepository.save(w);   // id 由数据库生成

        if ("submit".equals(rb.action)) {
            ensurePricing(w);
            AuditResult result = submitAndAudit(w);
            Map<String, Object> m = dto.toMap(w);
            m.put("audit", auditMap(result));
            m.put("completeness", completenessMap(checkCompleteness(w)));
            return m;
        }

        Map<String, Object> m = dto.toMap(w);
        m.put("audit", null);
        m.put("completeness", completenessMap(checkCompleteness(w)));
        return m;
    }

    /** 草稿更新 / 被拒后修改重提。 */
    @Transactional
    public Map<String, Object> update(int uid, int id, Map<String, Object> body) {
        WindowMaterial w = windowMaterialRepository.findById(id).orElse(null);
        if (w == null) throw Errors.notFound("橱窗材料不存在");
        validateOwn(w, uid);

        Map<String, Object> b = body == null ? new LinkedHashMap<String, Object>() : body;

        if (truthy(b.get("workId"))) {
            Work work = workByIdAndCreator(MiscUtil.toInt(b.get("workId"), 0), uid);
            if (work == null) throw Errors.bad("WORK_NOT_FOUND", "作品不存在");
            w.workId = work.id;
        }
        if (b.get("photos") instanceof List<?>) w.photos = strList(b.get("photos"));
        if (b.get("partsFabric") instanceof List<?>) w.partsFabric = fabricParts(b.get("partsFabric"));
        if (truthy(b.get("spec"))) {
            // spec 是 JSON 列：替换整个值对象以确保脏检查生效（就地修改 public 字段不会被 flush）
            WindowSpec next = new WindowSpec();
            if (w.spec != null) {
                next.label = w.spec.label;
                next.sizeChart = w.spec.sizeChart;
                next.note = w.spec.note;
            }
            Map<String, Object> spec = asMap(b.get("spec"));
            if (spec.get("sizeChart") instanceof List<?>) next.sizeChart = sizeChartRows(spec.get("sizeChart"));
            if (spec.containsKey("label")) next.label = String.valueOf(spec.get("label"));
            if (spec.containsKey("note")) next.note = String.valueOf(spec.get("note"));
            w.spec = next;
        }
        if (truthy(b.get("productName"))) w.productName = String.valueOf(b.get("productName"));
        if (truthy(b.get("category"))) w.category = String.valueOf(b.get("category"));
        if (b.get("styleTags") instanceof List<?>) w.styleTags = strList(b.get("styleTags"));
        if (b.containsKey("price")) w.price = MiscUtil.toDouble(b.get("price"), 0);
        if (b.containsKey("baseFee")) w.baseFee = MiscUtil.toDouble(b.get("baseFee"), 0);
        if (b.get("patternMatIds") instanceof List<?>) w.patternMatIds = intList(b.get("patternMatIds"));
        if (b.get("modelMatIds") instanceof List<?>) w.modelMatIds = intList(b.get("modelMatIds"));

        boolean wasApproved = w.status == WindowStatus.APPROVED;
        w.status = WindowStatus.DRAFT;
        w.updatedAt = TimeUtil.nowIso();
        if (wasApproved) {
            // 材料变更 → 原商品下架提示（需重新审核）
            Product product = firstProductOfWindow(w.id);
            if (product != null && "onSale".equals(product.status)) {
                product.status = "offShelf";
            }
        }

        if ("submit".equals(b.get("action"))) {
            ensurePricing(w);
            AuditResult result = submitAndAudit(w);
            Map<String, Object> m = dto.toMap(w);
            m.put("audit", auditMap(result));
            m.put("offShelf", wasApproved);
            m.put("completeness", completenessMap(checkCompleteness(w)));
            return m;
        }

        Map<String, Object> m = dto.toMap(w);
        m.put("audit", null);
        m.put("offShelf", wasApproved);
        m.put("completeness", completenessMap(checkCompleteness(w)));
        return m;
    }

    /** 提交审核。 */
    @Transactional
    public Map<String, Object> submit(int uid, int id) {
        WindowMaterial w = windowMaterialRepository.findById(id).orElse(null);
        if (w == null) throw Errors.notFound("橱窗材料不存在");
        validateOwn(w, uid);

        ensurePricing(w);
        AuditResult result = submitAndAudit(w);
        Map<String, Object> m = dto.toMap(w);
        m.put("audit", auditMap(result));
        m.put("completeness", completenessMap(checkCompleteness(w)));
        return m;
    }

    /** 删除橱窗材料（仅草稿 / 被拒状态可删；审核中、已通过需先处理关联商品）。 */
    @Transactional
    public Map<String, Object> remove(int uid, int id) {
        WindowMaterial w = windowMaterialRepository.findById(id).orElse(null);
        if (w == null) throw Errors.notFound("橱窗材料不存在");
        validateOwn(w, uid);
        if (w.status == WindowStatus.APPROVED || w.status == WindowStatus.SUBMITTED) {
            throw Errors.deny(w.status == WindowStatus.APPROVED
                    ? "该材料已审核通过并生成商品，请先到「商品管理」下架后再处理"
                    : "该材料正在审核中，暂不能删除，可在审核通过/驳回后再删除");
        }
        if (!productRepository.findByWindowId(w.id).isEmpty()) {
            throw Errors.deny("该材料已生成商品，请先在商品管理中下架删除关联商品");
        }

        windowMaterialRepository.delete(w);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("deleted", true);
        out.put("id", w.id);
        return out;
    }

    /* ------------------------------ 审核（冻结接口） ------------------------------ */

    /** 完整性检查（对应 checkCompleteness()）。 */
    @Override
    @Transactional(readOnly = true)
    public Completeness checkCompleteness(WindowMaterial win) {
        List<String> missing = new ArrayList<>();

        // 真人模特穿搭实景图（photos ≥ 1）
        if (win.photos == null || win.photos.isEmpty()) {
            missing.add("真人模特穿搭实景图（photos ≥ 1）");
        }
        // 各部件面料说明（partsFabric）：非空且每项 part/fabric 都齐备
        List<FabricPart> parts = win.partsFabric == null ? List.of() : win.partsFabric;
        boolean partsOk = !parts.isEmpty();
        for (FabricPart p : parts) {
            if (p == null || isBlank(p.part) || isBlank(p.fabric)) {
                partsOk = false;
                break;
            }
        }
        if (!partsOk) {
            missing.add("各部件面料说明（partsFabric）");
        }
        // 规格尺码表 ≥ 2 档（spec.sizeChart）
        List<SizeChartRow> sizeChart = win.spec == null || win.spec.sizeChart == null
                ? new ArrayList<SizeChartRow>() : win.spec.sizeChart;
        if (sizeChart.size() < 2) {
            missing.add("规格尺码表 ≥ 2 档（spec.sizeChart）");
        }
        // 打版结果文件（patternMatIds ≥ 1）
        if (win.patternMatIds == null || win.patternMatIds.isEmpty()) {
            missing.add("打版结果文件（patternMatIds ≥ 1）");
        }
        // 3D 结果文件（modelMatIds ≥ 1）
        if (win.modelMatIds == null || win.modelMatIds.isEmpty()) {
            missing.add("3D 结果文件（modelMatIds ≥ 1）");
        }

        Completeness c = new Completeness();
        c.pass = missing.isEmpty();
        c.missing = missing;
        return c;
    }

    /** 执行审核（对应 auditWindow()）：pass → 生成 Product；fail → rejected + 记录缺失。 */
    @Override
    @Transactional
    public AuditResult auditWindow(WindowMaterial win) {
        Completeness c = checkCompleteness(win);
        boolean pass = c.pass;
        List<String> missing = c.missing;

        User creator = userRepository.findById(win.creatorId).orElse(null);
        String nickname = creator != null ? creator.nickname : "创作者" + win.creatorId;
        String at = TimeUtil.nowIso();

        // 就地追加审计日志会绕过脏检查，改为替换整个列表（JSON 列）
        List<AuditLogItem> log = win.auditLog == null ? new ArrayList<>() : new ArrayList<>(win.auditLog);
        log.add(auditItem(pass, pass ? "材料完整，审核通过" : "缺少：" + String.join("、", missing), at));
        win.auditLog = log;
        win.updatedAt = at;

        if (pass) {
            win.status = WindowStatus.APPROVED;
            Work work = win.workId == 0 ? null : workRepository.findById(win.workId).orElse(null);
            if (work == null) {
                // 材料通过但 work 缺失（防御）
                win.status = WindowStatus.REJECTED;
                List<AuditLogItem> log2 = new ArrayList<>(win.auditLog);
                log2.add(auditItem(false, "关联作品不存在，请先组织作品", at));
                win.auditLog = log2;
                windowMaterialRepository.save(win);
                AuditResult r = new AuditResult();
                r.pass = false;
                r.missing = new ArrayList<String>(List.of("作品"));
                r.note = "关联作品不存在";
                r.product = null;
                return r;
            }
            // 等价 TS：const draft = buildProduct(win, work); const product = { id: <数据库生成>, ...draft };
            // buildProduct 内部会调 Python AI 服务；失败时抛 503（此时不会写入商品行）
            Product product = productService.buildProduct(win, work);
            productRepository.save(product);          // id 由数据库生成
            notify.notify(win.creatorId, "audit", "✅ 橱窗审核通过，商品已上架",
                    "「" + win.productName + "」材料审核通过，AI 已生成商品详情页并上架商城（原价 ¥" + num(win.price)
                            + "，基础费用 ¥" + num(win.baseFee)
                            + "）。可在「商品管理」中修改非材料文案，材料变更需重新提交审核。",
                    "/mall/product/" + product.id);
            notify.notify(win.creatorId, "product", "🛍️ 新商品上架",
                    "「" + win.productName + "」已在商城开售，去数据看板查看转化表现。",
                    "/creator/dashboard?productId=" + product.id);
            windowMaterialRepository.save(win);

            AuditResult r = new AuditResult();
            r.pass = true;
            r.missing = new ArrayList<>();
            r.product = product;
            r.note = nickname + " 的橱窗材料完整，自动上架成功";
            return r;
        }

        win.status = WindowStatus.REJECTED;
        win.auditMissing = missing;
        notify.notify(win.creatorId, "audit", "⚠️ 橱窗审核未通过，请补齐材料",
                "「" + (isBlank(win.productName) ? "未命名" : win.productName) + "」审核未通过："
                        + String.join("；", missing)
                        + "。材料已退回草稿状态，补齐后可重新提交（材料变更必须重新走审核）。",
                "/creator/window?workId=" + win.workId + "&reject=1");
        windowMaterialRepository.save(win);

        AuditResult r = new AuditResult();
        r.pass = false;
        r.missing = missing;
        r.product = null;
        r.note = "缺少材料：" + String.join("、", missing);
        return r;
    }

    /** 提交（含重新提交）时执行审核（对应 submitAndAudit()，一次请求内完成）。 */
    @Override
    @Transactional
    public AuditResult submitAndAudit(WindowMaterial win) {
        win.status = WindowStatus.SUBMITTED;
        win.updatedAt = TimeUtil.nowIso();
        return auditWindow(win);
    }

    /* ------------------------------- 请求体解析 ------------------------------- */

    /** readBody 的解析结果（对应 TS readBody 的返回对象，postId 缺席即 null）。 */
    private static final class WindowBody {
        int workId;
        Integer postId;
        List<String> photos = new ArrayList<>();
        List<FabricPart> partsFabric = new ArrayList<>();
        WindowSpec spec = new WindowSpec();
        String productName = "";
        String category = "";
        List<String> styleTags = new ArrayList<>();
        double price;
        double baseFee;
        List<Integer> patternMatIds = new ArrayList<>();
        List<Integer> modelMatIds = new ArrayList<>();
        String action = "draft";
    }

    private WindowBody readBody(Map<String, Object> b) {
        WindowBody out = new WindowBody();

        int workId = MiscUtil.toInt(b.get("workId"), 0);
        if (workId == 0) throw Errors.bad("BAD_REQUEST", "请选择作品(workId)");
        out.workId = workId;

        out.action = "submit".equals(b.get("action")) ? "submit" : "draft";
        out.photos = strList(b.get("photos"));
        out.partsFabric = fabricParts(b.get("partsFabric"));

        Map<String, Object> specRaw = asMap(b.get("spec"));
        WindowSpec spec = new WindowSpec();
        spec.label = truthy(specRaw.get("label")) ? String.valueOf(specRaw.get("label")) : "标准版型";
        spec.sizeChart = sizeChartRows(specRaw.get("sizeChart"));
        if (truthy(specRaw.get("note"))) spec.note = String.valueOf(specRaw.get("note"));
        out.spec = spec;

        out.category = strOr(b.get("category"));
        // 原价/基础费用不再由表单填写：未提供时采用平台按品类默认定价
        double price = MiscUtil.toDouble(b.get("price"), 0);
        out.price = price > 0 ? price : defaultPrice(out.category);
        double baseFee = MiscUtil.toDouble(b.get("baseFee"), 0);
        out.baseFee = baseFee > 0 ? baseFee : defaultBaseFee(out.category);

        out.productName = strOr(b.get("productName"));
        out.styleTags = strList(b.get("styleTags"));
        if (truthy(b.get("postId"))) out.postId = MiscUtil.toInt(b.get("postId"), 0);
        out.patternMatIds = intList(b.get("patternMatIds"));
        out.modelMatIds = intList(b.get("modelMatIds"));
        return out;
    }

    /* -------------------------------- 内部工具 -------------------------------- */

    /** 平台默认定价补齐：原价/基础费用缺失时按品类自动给参考价。 */
    private void ensurePricing(WindowMaterial w) {
        if (!(w.price > 0)) w.price = defaultPrice(w.category);
        if (!(w.baseFee > 0)) w.baseFee = defaultBaseFee(w.category);
    }

    private void validateOwn(WindowMaterial w, int uid) {
        if (w.creatorId != uid) throw Errors.deny("只能操作自己的橱窗材料");
    }

    private Work workByIdAndCreator(int workId, int creatorId) {
        Work work = workId == 0 ? null : workRepository.findById(workId).orElse(null);
        return work != null && work.creatorId == creatorId ? work : null;
    }

    private Product firstProductOfWindow(int windowId) {
        List<Product> products = productRepository.findByWindowId(windowId);
        return products.isEmpty() ? null : products.get(0);
    }

    private static WindowStatus statusOf(String value) {
        for (WindowStatus s : WindowStatus.values()) {
            if (s.value().equals(value)) return s;
        }
        return null;
    }

    /** {@code audit: {pass, missing, note, product: {id,title}|null}} */
    private static Map<String, Object> auditMap(AuditResult r) {
        Map<String, Object> audit = new LinkedHashMap<>();
        audit.put("pass", r.pass);
        audit.put("missing", r.missing == null ? new ArrayList<String>() : r.missing);
        audit.put("note", r.note);
        Map<String, Object> product = null;
        if (r.product != null) {
            product = new LinkedHashMap<>();
            product.put("id", r.product.id);
            product.put("title", r.product.title);
        }
        audit.put("product", product);
        return audit;
    }

    /** {@code completeness: {pass, missing}} */
    private static Map<String, Object> completenessMap(Completeness c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("pass", c.pass);
        m.put("missing", c.missing == null ? new ArrayList<String>() : c.missing);
        return m;
    }

    private static AuditLogItem auditItem(boolean passed, String note, String at) {
        AuditLogItem item = new AuditLogItem();
        item.passed = passed;
        item.note = note;
        item.at = at;
        return item;
    }

    private static double defaultPrice(String category) {
        Double v = category == null ? null : DEFAULT_PRICE.get(category);
        return v == null ? 299.0 : v;
    }

    private static double defaultBaseFee(String category) {
        Double v = category == null ? null : DEFAULT_BASE_FEE.get(category);
        return v == null ? 79.0 : v;
    }

    private static boolean isBlank(String s) {
        return s == null || s.isEmpty();
    }

    /** 等价于 JS 模板字符串里数字的呈现（299 而非 299.0）。 */
    private static String num(double v) {
        if (!Double.isNaN(v) && !Double.isInfinite(v) && v == Math.rint(v) && Math.abs(v) < 1e15) {
            return String.valueOf((long) v);
        }
        return String.valueOf(v);
    }

    /** JS 假值语义（用于复刻 `b.x || 默认值` / `if (b.x)`）。 */
    private static boolean truthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d != 0 && !Double.isNaN(d);
        }
        return !String.valueOf(v).isEmpty();
    }

    /** {@code String(x || '')} */
    private static String strOr(Object v) {
        return truthy(v) ? String.valueOf(v) : "";
    }

    /** 等价于 JS {@code Array.isArray(v) && ok(v)} 的映射。 */
    private static List<String> strList(Object v) {
        List<String> out = new ArrayList<>();
        if (!(v instanceof List<?> list)) return out;
        for (Object o : list) out.add(String.valueOf(o));
        return out;
    }

    private static List<Integer> intList(Object v) {
        List<Integer> out = new ArrayList<>();
        if (!(v instanceof List<?> list)) return out;
        for (Object o : list) out.add(MiscUtil.toInt(o, 0));
        return out;
    }

    /** partsFabric: Array.isArray(v) ? v.filter((p) => p && p.part) : [] */
    private List<FabricPart> fabricParts(Object v) {
        List<FabricPart> out = new ArrayList<>();
        if (!(v instanceof List<?> list)) return out;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?>)) continue;
            Map<String, Object> m = asMap(o);
            if (!truthy(m.get("part"))) continue;
            out.add(json.convertValue(m, FabricPart.class));
        }
        return out;
    }

    /** spec.sizeChart: Array.isArray(v) ? v : [] */
    private List<SizeChartRow> sizeChartRows(Object v) {
        List<SizeChartRow> out = new ArrayList<>();
        if (!(v instanceof List<?> list)) return out;
        for (Object o : list) {
            if (!(o instanceof Map<?, ?>)) continue;
            out.add(json.convertValue(asMap(o), SizeChartRow.class));
        }
        return out;
    }

    /** 把任意对象规范成 Map（非对象 → 空 Map），键统一转成 String。 */
    private static Map<String, Object> asMap(Object v) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (!(v instanceof Map<?, ?> m)) return out;
        for (Map.Entry<?, ?> e : m.entrySet()) out.put(String.valueOf(e.getKey()), e.getValue());
        return out;
    }
}
