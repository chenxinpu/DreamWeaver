package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 详情页图文段落。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AiSection {
    public String icon;
    public String title = "";
    public String body = "";
}
