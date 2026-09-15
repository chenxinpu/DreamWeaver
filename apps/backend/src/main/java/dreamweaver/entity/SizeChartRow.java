package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 尺码表行。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SizeChartRow {
    public String size = "";
    public Double bust;
    public Double waist;
    public Double hip;
    public Double shoulder;
    public Double sleeve;
    public Double length;
}
