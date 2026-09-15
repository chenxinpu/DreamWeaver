package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 二手挂单状态。 */
public enum ResaleStatus {
    ACTIVE("active"), SOLD("sold"), CANCELLED("cancelled");

    private final String value;

    ResaleStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static ResaleStatus of(String v) {
        if (v == null) return ACTIVE;
        for (ResaleStatus s : values()) if (s.value.equals(v)) return s;
        return ACTIVE;
    }
}
