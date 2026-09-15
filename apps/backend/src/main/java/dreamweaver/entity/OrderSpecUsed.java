package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** 下单时采用的规格。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class OrderSpecUsed {
    public String size;
    public List<SpecLine> adjusted;
    public BodyMeasurement body;
}
