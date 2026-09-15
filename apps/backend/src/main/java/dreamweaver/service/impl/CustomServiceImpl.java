package dreamweaver.service.impl;

import dreamweaver.ai.AiDtos;
import dreamweaver.ai.AiServiceClient;
import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.BodyMeasurement;
import dreamweaver.entity.Product;
import dreamweaver.entity.SizeChartRow;
import dreamweaver.entity.SpecLine;
import dreamweaver.entity.User;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.service.CustomService;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 私人定制业务实现（取代原定制引擎 + {@code CustomController} 内的请求体解析逻辑）。
 *
 * <p>调整算法：目标成品尺寸 = 体型 + 品类松量（胸/腰/臀/肩/袖）；
 * 基码 = 能满足全部目标的最小档，否则取最大档并将不足维度标 tight。
 *
 * <p><b>架构红线</b>：AI 生成类能力（原 {@code customChat} 规则模板、{@code genVariantSvg} 款式变体 SVG）
 * 由 Python AI 服务实现，本类只通过 {@code ai.AiServiceClient} 调用；
 * 只保留 {@code easeFor} / {@code adaptToProduct} 这类确定性业务算法，AI 异常直接冒泡。
 */
@Service
public class CustomServiceImpl implements CustomService {

    /** 成品超出目标该值(cm) → loose（容差外，提示改小或接受） */
    private static final int LOOSE_TOL = 9;
    /** 成品小于目标超过 1cm 即 tight */
    private static final int TIGHT_TOL = 1;

    /** 参与判定的维度（顺序即输出顺序） */
    private static final String[] ALL_KEYS = {"bust", "waist", "hip", "shoulder", "sleeve"};

    private static final Map<String, String> PART_LABEL;

    /** JS {@code new Date().toISOString()}：UTC、毫秒 3 位。 */
    private static final DateTimeFormatter ISOZ =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.ROOT).withZone(ZoneOffset.UTC);

    static {
        Map<String, String> labels = new LinkedHashMap<>();
        labels.put("bust", "胸围");
        labels.put("waist", "腰围");
        labels.put("hip", "臀围");
        labels.put("shoulder", "肩宽");
        labels.put("sleeve", "袖长");
        labels.put("length", "衣长");
        PART_LABEL = Collections.unmodifiableMap(labels);
    }

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final DtoMapper dto;
    private final AiServiceClient ai;

    public CustomServiceImpl(ProductRepository productRepository,
                             UserRepository userRepository,
                             DtoMapper dto,
                             AiServiceClient ai) {
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.dto = dto;
        this.ai = ai;
    }

    /* ------------------------------- context ------------------------------- */

    /** 定制上下文（product / sizeChart / easeTemplate / easeExplain / baseFeeNote / myBody / user）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> context(int userId, int productId) {
        Product product = requireProduct(productId);
        User user = userRepository.findById(userId).orElse(null);
        Map<String, Object> data = contextOf(product, user == null ? null : user.body);
        data.put("user", user == null ? null : dto.toUserPublic(user));
        return data;
    }

    /** 组装 context 主体（不含 user，由 {@link #context(int, int)} 追加在最后以保持键序）。 */
    private Map<String, Object> contextOf(Product product, BodyMeasurement body) {
        List<SizeChartRow> chart = product.aiDetail != null && product.aiDetail.sizeChart != null
                ? product.aiDetail.sizeChart
                : List.<SizeChartRow>of();

        Map<String, Object> productBrief = new LinkedHashMap<>();
        productBrief.put("id", product.id);
        productBrief.put("title", product.title);
        productBrief.put("cover", product.cover);
        productBrief.put("category", product.category);
        productBrief.put("price", product.price);
        productBrief.put("baseFee", product.baseFee);
        productBrief.put("styleTags", product.styleTags);

        Map<String, Object> ease = product.category == null ? null : EASE_CATEGORIES.get(product.category);
        if (ease == null) ease = EASE_FALLBACK;

        StringBuilder easeRef = new StringBuilder();
        boolean first = true;
        for (Map.Entry<String, Object> e : ease.entrySet()) {
            if (!first) easeRef.append('、');
            first = false;
            easeRef.append(e.getKey()).append('+').append(numText(e.getValue()));
        }

        String baseFeeNote = product.aiDetail == null ? null : product.aiDetail.baseFeeNote;
        if (baseFeeNote == null || baseFeeNote.isEmpty()) {
            baseFeeNote = "私人定制基础费用 ¥" + MiscUtil.jsNum(product.baseFee) + "（加工/材料/人工），退货仅退原价。";
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("product", productBrief);
        out.put("sizeChart", chart);
        out.put("easeTemplate", ease);
        out.put("easeExplain", "松量说明（品类 " + product.category + "）：" + easeRef + "。需要成品尺寸 = 体型 + 松量。");
        out.put("baseFeeNote", baseFeeNote);
        out.put("myBody", body);
        return out;
    }

    /* -------------------------------- adapt -------------------------------- */

    /** 规格调整（核心算法 §3.4）。 */
    @Override
    @Transactional(readOnly = true)
    public AdaptResult adapt(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Product product = requireProduct(MiscUtil.toInt(b.get("productId"), -1));
        BodyMeasurement measurement = bodyFromInput(asMap(b.get("body")));
        return adaptToProduct(product, measurement);
    }

    /* --------------------------------- chat --------------------------------- */

    /** AI 交互（规则模板由 Python AI 服务实现）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> chat(int userId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Product product = requireProduct(MiscUtil.toInt(b.get("productId"), -1));
        List<AiDtos.ChatTurn> history = toTurns(b.get("history"));
        User user = userRepository.findById(userId).orElse(null);
        BodyMeasurement measurement;
        if (b.get("body") instanceof Map<?, ?> raw) {
            measurement = bodyFromInput(asMap(raw));
        } else {
            measurement = user == null ? null : user.body;
        }

        AiDtos.ChatResponse reply = ai.customChat(product, history);

        Map<String, Object> estimate = new LinkedHashMap<>();
        if (measurement != null) {
            estimate = adaptToProduct(product, measurement).totalEstimate;
        } else {
            estimate.put("price", product.price);
            estimate.put("baseFee", product.baseFee);
            estimate.put("total", product.price + product.baseFee);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("reply", reply.reply);
        out.put("options", reply.options);
        out.put("hasBody", measurement != null);
        out.put("baseEstimate", estimate);
        return out;
    }

    /* -------------------------------- variant -------------------------------- */

    /** 款式变体生成图（SVG 由 Python AI 服务实现）。 */
    @Override
    @Transactional(readOnly = true)
    public AiDtos.VariantResponse variant(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Product product = requireProduct(MiscUtil.toInt(b.get("productId"), -1));
        String optionKey = jsOr(b.get("optionKey"), "");
        if (optionKey.isEmpty()) throw Errors.bad("BAD_REQUEST", "请选择 optionKey");
        return ai.customVariant(product, optionKey);
    }

    /* -------------------------------- preview -------------------------------- */

    /** 汇总调整后规格图预览。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> preview(Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Product product = requireProduct(MiscUtil.toInt(b.get("productId"), -1));
        BodyMeasurement measurement = bodyFromInput(asMap(b.get("body")));
        List<String> options = toStrList(b.get("options"));

        AdaptResult adapt = adaptToProduct(product, measurement);

        List<Map<String, Object>> variants = new ArrayList<>();
        int limit = Math.min(3, options.size());
        for (int i = 0; i < limit; i++) {
            String key = options.get(i);
            AiDtos.VariantResponse v = ai.customVariant(product, key);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", key);
            item.put("title", v.title);
            item.put("desc", v.desc);
            item.put("image", v.image);
            variants.add(item);
        }

        List<String> explain = new ArrayList<>(adapt.explain);
        explain.add("已应用定制选项 " + options.size() + " 项（" + String.join("、", options) + "），确认后生成定制订单。");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("baseSize", adapt.baseSize);
        out.put("adjustedSpec", adapt.adjustedSpec);
        out.put("fitAlerts", adapt.fitAlerts);
        out.put("chart", adapt.chart);
        out.put("totalEstimate", adapt.totalEstimate);
        out.put("variantImages", variants);
        out.put("explain", explain);
        return out;
    }

    /* -------------------------------- 松量 -------------------------------- */

    /** 品类松量（SPEC §3.4，单位 cm） */
    private double easeFor(String category, String key) {
        String cat = category == null ? "" : category;
        String k = key == null ? "" : key;
        switch (k) {
            case "bust":
                return cat.contains("连衣裙") || cat.contains("套装") ? 8
                        : (cat.contains("衬衫") || cat.contains("外套") ? 12 : 8);
            case "waist":
                return cat.contains("半裙") || cat.contains("裤装") ? 4
                        : (cat.contains("连衣裙") || cat.contains("套装") ? 6 : 8);
            case "hip":
                return cat.contains("半裙") ? 6 : 8;
            case "shoulder":
                return cat.contains("衬衫") || cat.contains("外套") ? 1.5 : 1;
            case "sleeve":
                return 2;
            default:
                return 0;
        }
    }

    /* ------------------------------ 主算法 ------------------------------ */

    @Override
    @Transactional(readOnly = true)
    public AdaptResult adaptToProduct(Product product, BodyMeasurement body) {
        List<SizeChartRow> chart = new ArrayList<>();
        if (product != null && product.aiDetail != null && product.aiDetail.sizeChart != null) {
            chart.addAll(product.aiDetail.sizeChart);
        }
        String category = product == null || product.category == null ? "" : product.category;
        List<String> keys = relevantKeys(chart);

        List<Row> rows = new ArrayList<>();
        for (String k : keys) {
            Double bv = bodyOf(body, k);
            if (bv == null || !(bv > 0)) continue;
            rows.add(new Row(k, bv, easeFor(category, k)));
        }

        List<Need> needs = new ArrayList<>();
        for (Row r : rows) needs.add(new Need(r.key, MiscUtil.r2(r.body + r.ease)));

        // 选基码：能满足全部目标的最小档
        String baseSize = chart.isEmpty() ? "" : str(chart.get(chart.size() - 1).size);
        boolean anyFit = false;
        for (SizeChartRow row : chart) {
            boolean okAll = true;
            for (Need n : needs) {
                Double v = chartVal(row, n.key);
                if (v != null && !(v >= n.target - TIGHT_TOL)) {
                    okAll = false;
                    break;
                }
            }
            if (okAll) {
                baseSize = str(row.size);
                anyFit = true;
                break;
            }
        }
        if (!anyFit && !chart.isEmpty()) baseSize = str(chart.get(chart.size() - 1).size);

        SizeChartRow baseRow = null;
        for (SizeChartRow r : chart) {
            if (str(r.size).equals(baseSize)) {
                baseRow = r;
                break;
            }
        }

        List<SpecLine> adjustedSpec = new ArrayList<>();
        for (Row r : rows) {
            Double v = baseRow == null ? null : chartVal(baseRow, r.key);
            double target = MiscUtil.r2(r.body + r.ease);
            String label = PART_LABEL.containsKey(r.key) ? PART_LABEL.get(r.key) : r.key;
            String flag = "ok";
            String advise;
            if (v == null) {
                advise = "该规格表未提供此维度数据，请与创作者确认";
            } else if (v < target - TIGHT_TOL) {
                flag = "tight";
                advise = label + "成品仅 " + MiscUtil.jsNum(v) + "cm，容纳不下所需 " + MiscUtil.jsNum(target) + "cm（体型 "
                        + MiscUtil.jsNum(r.body) + " + 松量 " + MiscUtil.jsNum(r.ease) + "）→ 建议改大一码或在 AI 定制中加放该部位";
            } else if (v > target + LOOSE_TOL) {
                flag = "loose";
                advise = label + "成品 " + MiscUtil.jsNum(v) + "cm 比所需 " + MiscUtil.jsNum(target) + "cm 大 "
                        + MiscUtil.jsNum(MiscUtil.r2(v - target)) + "cm（超出舒适容差）→ 可接受宽松或选更小码";
            } else {
                advise = label + "成品 " + MiscUtil.jsNum(v) + "cm 覆盖所需 " + MiscUtil.jsNum(target) + "cm，穿着舒适。";
            }
            SpecLine s = new SpecLine();
            s.part = r.key;
            s.label = label;
            s.body = r.body;
            s.ease = r.ease;
            s.base = v == null ? target : v;
            s.target = target;
            s.flag = flag;
            s.advise = advise;
            adjustedSpec.add(s);
        }

        List<SpecLine> tightRows = new ArrayList<>();
        List<SpecLine> looseRows = new ArrayList<>();
        for (SpecLine s : adjustedSpec) {
            if ("tight".equals(s.flag)) tightRows.add(s);
            else if ("loose".equals(s.flag)) looseRows.add(s);
        }

        List<String> fitAlerts = new ArrayList<>();
        if (!tightRows.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < tightRows.size(); i++) {
                SpecLine s = tightRows.get(i);
                if (i > 0) sb.append('、');
                sb.append(s.label).append("（成品 ").append(MiscUtil.jsNum(s.base)).append("cm < 需要 ")
                        .append(MiscUtil.jsNum(s.target)).append("cm）");
            }
            fitAlerts.add("⚠️ 系统提示：该规格可能不合适——" + sb + "。建议改大一码或在定制中调整该部位。");
        }
        if (!anyFit && !chart.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < needs.size(); i++) {
                Need n = needs.get(i);
                if (i > 0) sb.append('、');
                sb.append(PART_LABEL.containsKey(n.key) ? PART_LABEL.get(n.key) : n.key)
                        .append("需 ").append(MiscUtil.jsNum(n.target)).append("cm");
            }
            fitAlerts.add("⚠️ 您的体型超出「" + str(chart.get(chart.size() - 1).size) + "」码范围（" + sb
                    + "），建议私人定制加放或联系创作者沟通。");
        }
        if (tightRows.isEmpty() && !looseRows.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < looseRows.size(); i++) {
                SpecLine s = looseRows.get(i);
                if (i > 0) sb.append('、');
                sb.append(s.label).append("偏大 ").append(MiscUtil.jsNum(MiscUtil.r2(s.base - s.target))).append("cm");
            }
            fitAlerts.add("📏 提示：" + sb + "，可选更小码或接受宽松效果。");
        }

        List<String> explain = new ArrayList<>();
        StringBuilder easeRef = new StringBuilder();
        for (int i = 0; i < keys.size(); i++) {
            String k = keys.get(i);
            if (i > 0) easeRef.append('、');
            easeRef.append(PART_LABEL.containsKey(k) ? PART_LABEL.get(k) : k)
                    .append(" +").append(MiscUtil.jsNum(easeFor(category, k)));
        }
        explain.add("品类「" + (product == null ? null : product.category) + "」松量参考：" + easeRef + "。");
        StringBuilder targetRef = new StringBuilder();
        for (int i = 0; i < rows.size(); i++) {
            Row r = rows.get(i);
            if (i > 0) targetRef.append('；');
            targetRef.append(PART_LABEL.containsKey(r.key) ? PART_LABEL.get(r.key) : r.key)
                    .append("目标 = 体型 ").append(MiscUtil.jsNum(r.body)).append(" + 松量 ").append(MiscUtil.jsNum(r.ease))
                    .append(" = ").append(MiscUtil.jsNum(MiscUtil.r2(r.body + r.ease))).append("cm");
        }
        explain.add(targetRef.toString());
        explain.add("基码策略：优先取能覆盖全部目标成品尺寸的最小档；无档可覆盖时取最大档并把不足维度标为 tight。当前推荐基码「"
                + baseSize + "」。");

        double price = product == null ? 0 : product.price;
        double baseFee = product == null ? 0 : product.baseFee;

        AdaptResult out = new AdaptResult();
        out.baseSize = baseSize;
        out.chart = chart;
        out.adjustedSpec = adjustedSpec;
        out.fitAlerts = fitAlerts;
        out.explain = explain;
        out.totalEstimate.put("price", price);
        out.totalEstimate.put("baseFee", baseFee);
        out.totalEstimate.put("total", MiscUtil.r2(price + baseFee));
        return out;
    }

    /* --------------------- context 松量模板（确定性常量） --------------------- */

    private static final Map<String, Map<String, Object>> EASE_CATEGORIES = new LinkedHashMap<>();
    private static final Map<String, Object> EASE_FALLBACK = easeRow("bust", 8, "waist", 6, "hip", 8);

    static {
        EASE_CATEGORIES.put("连衣裙", easeRow("bust", 8, "waist", 6, "hip", 8));
        EASE_CATEGORIES.put("衬衫", easeRow("bust", 12, "shoulder", 1.5));
        EASE_CATEGORIES.put("外套", easeRow("bust", 12, "shoulder", 1.5));
        EASE_CATEGORIES.put("半裙", easeRow("waist", 4, "hip", 6));
        EASE_CATEGORIES.put("裤装", easeRow("waist", 4, "hip", 8));
        EASE_CATEGORIES.put("套装", easeRow("bust", 8, "waist", 6, "hip", 8));
    }

    /* --------------------------- 请求体解析（原 controller） --------------------------- */

    private Product requireProduct(int id) {
        return productRepository.findById(id).orElseThrow(() -> Errors.notFound("商品不存在"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object raw) {
        if (raw instanceof Map<?, ?> m) return (Map<String, Object>) m;
        return null;
    }

    /** 对应原 routes/custom.ts 的 bodyFromInput（缺省值/NaN 语义逐条对齐）。 */
    private static BodyMeasurement bodyFromInput(Map<String, Object> x) {
        BodyMeasurement body = new BodyMeasurement();
        body.height = num(x, "height", 165);
        body.weight = num(x, "weight", 55);
        body.bust = num(x, "bust", 84);
        body.underBust = num(x, "underBust", 74);
        body.waist = num(x, "waist", 64);
        body.hip = num(x, "hip", 90);
        body.shoulderWidth = num(x, "shoulderWidth", 38);
        body.armLength = num(x, "armLength", 54);
        body.thigh = num(x, "thigh", 51);
        body.calf = num(x, "calf", 34);
        body.neck = num(x, "neck", 33);
        body.backLength = num(x, "backLength", 39);
        body.source = x != null && "ai".equals(x.get("source")) ? "ai" : "manual";
        body.updatedAt = ISOZ.format(Instant.now());
        return body;
    }

    /** JS {@code Number.isFinite(Number(v)) ? Number(v) : d} */
    private static double num(Map<String, Object> x, String key, double dft) {
        if (x == null || !x.containsKey(key)) return dft; // undefined → NaN → 缺省值
        Object v = x.get(key);
        if (v == null) return 0; // Number(null) === 0
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1 : 0;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return 0; // Number('') === 0
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return dft;
        }
    }

    private static List<AiDtos.ChatTurn> toTurns(Object raw) {
        List<AiDtos.ChatTurn> out = new ArrayList<>();
        if (!(raw instanceof List<?> list)) return out;
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> m)) continue;
            out.add(new AiDtos.ChatTurn(MiscUtil.toStr(m.get("role"), ""), MiscUtil.toStr(m.get("content"), "")));
        }
        return out;
    }

    private static List<String> toStrList(Object raw) {
        List<String> out = new ArrayList<>();
        if (!(raw instanceof List<?> list)) return out;
        for (Object item : list) out.add(jsStr(item));
        return out;
    }

    /* ------------------------------ 内部工具 ------------------------------ */

    private static final class Row {
        final String key;
        final double body;
        final double ease;

        Row(String key, double body, double ease) {
            this.key = key;
            this.body = body;
            this.ease = ease;
        }
    }

    private static final class Need {
        final String key;
        final double target;

        Need(String key, double target) {
            this.key = key;
            this.target = target;
        }
    }

    /** 参与判定维度：表里有数据 */
    private static List<String> relevantKeys(List<SizeChartRow> chart) {
        List<String> keys = new ArrayList<>();
        for (String k : ALL_KEYS) {
            for (SizeChartRow r : chart) {
                if (chartVal(r, k) != null) {
                    keys.add(k);
                    break;
                }
            }
        }
        return keys;
    }

    private static Double bodyOf(BodyMeasurement b, String key) {
        if (b == null) return null;
        switch (key) {
            case "bust": return b.bust;
            case "waist": return b.waist;
            case "hip": return b.hip;
            case "shoulder": return b.shoulderWidth;
            case "sleeve": return b.armLength;
            default: return null;
        }
    }

    private static Double chartVal(SizeChartRow row, String key) {
        if (row == null) return null;
        switch (key) {
            case "bust": return row.bust;
            case "waist": return row.waist;
            case "hip": return row.hip;
            case "shoulder": return row.shoulder;
            case "sleeve": return row.sleeve;
            case "length": return row.length;
            default: return null;
        }
    }

    private static Map<String, Object> easeRow(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) m.put(String.valueOf(kv[i]), kv[i + 1]);
        return m;
    }

    private static String str(String s) {
        return s == null ? "" : s;
    }

    /** 整数模板值按 JS 数字语义输出（8 → "8"，1.5 → "1.5"）。 */
    private static String numText(Object v) {
        if (v instanceof Number n) return MiscUtil.jsNum(n.doubleValue());
        return String.valueOf(v);
    }

    /** JS {@code String(v)} */
    private static String jsStr(Object v) {
        if (v == null) return "null";
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) {
            return String.valueOf(v);
        }
        if (v instanceof Number n) return MiscUtil.jsNum(n.doubleValue());
        return String.valueOf(v);
    }

    /** JS {@code v || dft} 再 {@code String()} */
    private static String jsOr(Object v, String dft) {
        return jsTruthy(v) ? jsStr(v) : dft;
    }

    /** JS 真值语义（null/undefined/false/0/NaN/'' 为假，其余为真，含空对象/空数组）。 */
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
}
