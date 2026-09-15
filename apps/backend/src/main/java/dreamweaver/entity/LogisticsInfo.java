package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** 物流信息。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LogisticsInfo {
    public String company = "";
    public String trackingNo = "";
    public List<LogisticsTrace> traces = new ArrayList<>();
}
