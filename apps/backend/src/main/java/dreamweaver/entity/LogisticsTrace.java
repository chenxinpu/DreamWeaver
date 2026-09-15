package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 物流轨迹。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LogisticsTrace {
    public String time;
    public String text = "";
}
