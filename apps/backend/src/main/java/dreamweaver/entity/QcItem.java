package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 质检项。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QcItem {
    public String k = "";
    public String v = "";
}
