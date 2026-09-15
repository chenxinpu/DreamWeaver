package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 履约阶段（推导值，不入库语义）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderStage {
    public String name = "";
    public int percent;
    public String eta;
    public String doneAt;
}
