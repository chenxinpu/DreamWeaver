package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** AI 生成的商品详情页内容（实际生成由 Python AI 服务完成）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiDetail {
    public String intro = "";
    public String story = "";
    public List<AiSection> sections = new ArrayList<>();
    public List<SizeChartRow> sizeChart = new ArrayList<>();
    public List<String> partsFabric = new ArrayList<>();
    public String manufacturer = "";
    public int prodDays;
    public String baseFeeNote = "";
}
