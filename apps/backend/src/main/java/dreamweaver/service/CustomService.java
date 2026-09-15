package dreamweaver.service;

import dreamweaver.ai.AiDtos;
import dreamweaver.entity.BodyMeasurement;
import dreamweaver.entity.Product;
import dreamweaver.entity.SizeChartRow;
import dreamweaver.entity.SpecLine;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 私人定制业务：规格调整（SPEC §3.4 主算法）+ 定制上下文组装 + AI 对话/款式变体透传。
 *
 * <p>调整算法：目标成品尺寸 = 体型 + 品类松量（胸/腰/臀/肩/袖）；
 * 基码 = 能满足全部目标的最小档，否则取最大档并将不足维度标 tight。
 *
 * <p><b>架构红线</b>：AI 生成类能力（{@code /custom/chat} 的对话规则模板、
 * {@code /custom/variant} 的款式变体 SVG）由 Python AI 服务实现，
 * 本层只做确定性业务算法与参数组装，通过 {@code ai.AiServiceClient} 调用，
 * <b>不内联任何生成逻辑</b>；AI 不可用时 {@code ApiException(503,"AI_UNAVAILABLE")} 直接冒泡。
 */
public interface CustomService {

    /** 规格调整结果（字段名/顺序与改造前定制引擎的 {@code AdaptResult} 完全一致）。 */
    class AdaptResult {
        public String baseSize = "";
        public List<SizeChartRow> chart = new ArrayList<>();
        public List<SpecLine> adjustedSpec = new ArrayList<>();
        public List<String> fitAlerts = new ArrayList<>();
        public List<String> explain = new ArrayList<>();
        public Map<String, Object> totalEstimate = new LinkedHashMap<>();
    }

    /**
     * 组装 {@code GET /api/custom/product/:id/context} 的响应体：
     * product / sizeChart / easeTemplate / easeExplain / baseFeeNote / myBody / user。
     */
    Map<String, Object> context(int userId, int productId);

    /** {@code POST /api/custom/adapt}：规格调整（核心算法 §3.4）。 */
    AdaptResult adapt(Map<String, Object> body);

    /** {@code POST /api/custom/chat}：AI 定制对话（规则模板由 Python AI 服务实现）。 */
    Map<String, Object> chat(int userId, Map<String, Object> body);

    /** {@code POST /api/custom/variant}：款式变体生成图（SVG 由 Python AI 服务实现）。 */
    AiDtos.VariantResponse variant(Map<String, Object> body);

    /** {@code POST /api/custom/preview}：汇总调整后规格图预览。 */
    Map<String, Object> preview(Map<String, Object> body);

    /**
     * 规格调整主算法（供定制下单等其它业务复用）：目标成品 = 体型 + 松量 → 选基码 → fitAlerts。
     */
    AdaptResult adaptToProduct(Product product, BodyMeasurement body);
}
