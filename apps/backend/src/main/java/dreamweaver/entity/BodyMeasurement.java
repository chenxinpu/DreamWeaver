package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonInclude;

/** 体型数据（单位 cm）。 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class BodyMeasurement {
    public double height;
    public double weight;
    public double bust;
    public double underBust;
    public double waist;
    public double hip;
    public double shoulderWidth;
    public double armLength;
    public double thigh;
    public double calf;
    public double neck;
    public double backLength;
    /** manual | ai */
    public String source = "manual";
    public String updatedAt;
}
