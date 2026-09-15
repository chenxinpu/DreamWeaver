package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** 质检报告。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class QcReport {
    public boolean pass;
    public List<QcItem> items = new ArrayList<>();
    public String at;
}
