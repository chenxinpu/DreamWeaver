package dreamweaver.ai;

import dreamweaver.ai.AiDtos.ChatRequest;
import dreamweaver.ai.AiDtos.ChatResponse;
import dreamweaver.ai.AiDtos.ProductDetailRequest;
import dreamweaver.ai.AiDtos.VariantRequest;
import dreamweaver.ai.AiDtos.VariantResponse;
import dreamweaver.common.ApiException;
import dreamweaver.common.MiscUtil;
import dreamweaver.entity.AiDetail;
import dreamweaver.entity.FabricPart;
import dreamweaver.entity.Product;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.Work;
import dreamweaver.repository.MaterialRepository;
import dreamweaver.repository.UserRepository;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Python AI 服务客户端。
 *
 * <p>架构约定：<b>AI 生成类能力只能由 Python 服务实现</b>，Java 侧不内联任何生成逻辑，
 * 只负责把领域数据组装成请求、把结果落库并驱动后续业务（审核、上架、下单）。
 */
@Service
public class AiServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AiServiceClient.class);

    private final ObjectMapper json = new ObjectMapper()
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    private final UserRepository userRepository;
    private final MaterialRepository materialRepository;

    @Value("${dw.ai-base-url:http://127.0.0.1:8789}")
    private String baseUrl;

    @Value("${dw.internal-token:dw-internal-dev-token}")
    private String internalToken;

    public AiServiceClient(UserRepository userRepository, MaterialRepository materialRepository) {
        this.userRepository = userRepository;
        this.materialRepository = materialRepository;
    }

    /* ------------------------------ 对外能力 ------------------------------ */

    /** 生成商品详情页内容（原 aiProduct.buildAiDetail）。 */
    public AiDetail buildProductDetail(WindowMaterial win, Work work) {
        ProductDetailRequest req = new ProductDetailRequest();
        req.title = win.productName != null && !win.productName.isBlank() ? win.productName : work.title;
        req.productName = win.productName;
        req.category = win.category;
        req.styleTags = win.styleTags == null ? List.of() : win.styleTags;
        req.photosCount = win.photos == null ? 0 : win.photos.size();
        req.creatorNickname = userRepository.findById(win.creatorId)
                .map(u -> u.nickname).orElse("织梦创作者");
        req.specLabel = win.spec == null ? null : win.spec.label;
        req.sizeChart = win.spec == null || win.spec.sizeChart == null ? List.of() : win.spec.sizeChart;
        req.prodDays = win.prodDays;
        List<AiDtos.FabricPartReq> parts = new ArrayList<>();
        if (win.partsFabric != null) {
            for (FabricPart pf : win.partsFabric) {
                parts.add(new AiDtos.FabricPartReq(pf.part, pf.fabric, pf.note));
            }
        }
        req.partsFabric = parts;
        req.patternFiles = fileNames(win.patternMatIds);
        req.modelFiles = fileNames(win.modelMatIds);

        return post("/ai/product-detail", req, AiDetail.class, "AI 详情页生成");
    }

    /** 定制 AI 对话（原 custom.customChat）。 */
    public ChatResponse customChat(Product product, List<AiDtos.ChatTurn> history) {
        ChatRequest req = new ChatRequest();
        req.product = brief(product);
        req.history = history == null ? List.of() : history;
        return post("/ai/custom/chat", req, ChatResponse.class, "AI 定制对话");
    }

    /** 款式变体生成（原 custom.genVariantSvg）。 */
    public VariantResponse customVariant(Product product, String optionKey) {
        VariantRequest req = new VariantRequest();
        req.product = brief(product);
        req.optionKey = optionKey;
        return post("/ai/custom/variant", req, VariantResponse.class, "AI 款式变体生成");
    }

    /** AI 服务探活（供网关/BFF 聚合健康信息）。 */
    public boolean healthy() {
        try {
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create(baseUrl + "/health"))
                            .timeout(Duration.ofSeconds(2)).GET().build(),
                    HttpResponse.BodyHandlers.ofString());
            return res.statusCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }

    public String baseUrl() {
        return baseUrl;
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    private AiDtos.ProductBrief brief(Product p) {
        AiDtos.ProductBrief b = new AiDtos.ProductBrief();
        b.id = p.id;
        b.title = p.title;
        b.price = p.price;
        b.baseFee = p.baseFee;
        b.category = p.category;
        b.styleTags = p.styleTags == null ? List.of() : p.styleTags;
        return b;
    }

    private List<String> fileNames(List<Integer> ids) {
        List<String> out = new ArrayList<>();
        if (ids == null) return out;
        for (Integer id : ids) {
            materialRepository.findById(id).ifPresent(m -> out.add(m.fileName));
        }
        return out;
    }

    private <T> T post(String path, Object body, Class<T> type, String what) {
        try {
            String payload = json.writeValueAsString(body);
            HttpResponse<String> res = http.send(
                    HttpRequest.newBuilder(URI.create(baseUrl + path))
                            .timeout(Duration.ofSeconds(15))
                            .header("Content-Type", "application/json;charset=UTF-8")
                            .header("X-Internal-Token", internalToken)
                            .POST(HttpRequest.BodyPublishers.ofString(payload, java.nio.charset.StandardCharsets.UTF_8))
                            .build(),
                    HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
            if (res.statusCode() >= 300) {
                log.error("[ai] {} 失败 status={} body={}", what, res.statusCode(), res.body());
                throw aiUnavailable(what + "失败（AI 服务返回 " + res.statusCode() + "）");
            }
            return json.readValue(res.body(), type);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("[ai] {} 调用异常 baseUrl={}", what, baseUrl, e);
            throw aiUnavailable(what + "不可用：" + MiscUtil.toStr(e.getMessage(), "未知错误")
                    + "（请确认 Python AI 服务已启动于 " + baseUrl + "）");
        }
    }

    private ApiException aiUnavailable(String msg) {
        return new ApiException("AI_UNAVAILABLE", msg, 503);
    }
}
