package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** 创作者对详情页的人工修改（材料不可改，改材料需重新审核）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DetailEdits {
    public String intro;
    public String story;
    public List<AiSection> sections;
    public String manufacturer;
}
