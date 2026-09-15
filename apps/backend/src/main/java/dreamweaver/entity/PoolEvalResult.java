package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.ArrayList;
import java.util.List;

/** 资源池评估结果。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PoolEvalResult {
    public int evaluated;
    public String dateKey;
    public double p60;
    public int n;
    public List<PoolEntry> added = new ArrayList<>();
    public List<String> explain = new ArrayList<>();
}
