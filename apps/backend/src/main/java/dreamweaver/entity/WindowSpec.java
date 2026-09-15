package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** 产品规格（橱窗材料之一）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WindowSpec {
    public String label = "";
    public List<SizeChartRow> sizeChart = new ArrayList<>();
    public String note;
}
