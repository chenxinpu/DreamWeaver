package dreamweaver.ai;

import dreamweaver.entity.SizeChartRow;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** Java 核心 ↔ Python AI 服务之间的数据契约。 */
public final class AiDtos {

    private AiDtos() {
    }

    /** AI 商品详情页生成入参 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProductDetailRequest {
        public String title;
        public String category;
        public String productName;
        public List<String> styleTags = new ArrayList<>();
        public int photosCount;
        public String creatorNickname;
        public List<FabricPartReq> partsFabric = new ArrayList<>();
        public List<SizeChartRow> sizeChart = new ArrayList<>();
        public String specLabel;
        public List<String> patternFiles = new ArrayList<>();
        public List<String> modelFiles = new ArrayList<>();
        public Integer prodDays;
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FabricPartReq {
        public String part;
        public String fabric;
        public String note;

        public FabricPartReq() {
        }

        public FabricPartReq(String part, String fabric, String note) {
            this.part = part;
            this.fabric = fabric;
            this.note = note;
        }
    }

    /** 定制 AI 对话入参 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatRequest {
        public ProductBrief product = new ProductBrief();
        public List<ChatTurn> history = new ArrayList<>();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ProductBrief {
        public int id;
        public String title;
        public double price;
        public double baseFee;
        public String category;
        public List<String> styleTags = new ArrayList<>();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatTurn {
        public String role;
        public String content;

        public ChatTurn() {
        }

        public ChatTurn(String role, String content) {
            this.role = role;
            this.content = content;
        }
    }

    /** AI 对话出参 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatResponse {
        public String reply = "";
        public List<ChatOption> options = new ArrayList<>();
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ChatOption {
        public String key;
        public String title;
        public String desc;
    }

    /** 款式变体生成入参 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VariantRequest {
        public ProductBrief product = new ProductBrief();
        public String optionKey;
    }

    /** 款式变体出参 */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class VariantResponse {
        public String image = "";
        public String title = "";
        public String desc = "";
        public List<String> applied = new ArrayList<>();
    }
}
