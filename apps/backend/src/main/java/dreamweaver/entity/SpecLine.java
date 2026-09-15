package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 定制规格调整行。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SpecLine {
    public String part = "";
    public String label;
    public double body;
    public double ease;
    public double base;
    public double target;
    /** ok | tight | loose */
    public String flag = "ok";
    public String advise = "";
}
