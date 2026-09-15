package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 橱窗审核日志。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuditLogItem {
    public boolean passed;
    public String note = "";
    public String at;
}
