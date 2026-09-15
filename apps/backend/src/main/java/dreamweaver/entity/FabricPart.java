package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 部件-面料对应。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FabricPart {
    public String part = "";
    public String fabric = "";
    public String note;
}
