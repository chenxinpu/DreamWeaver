package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 订单时间线节点。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderTimelineItem {
    public String t;
    public String text = "";
}
