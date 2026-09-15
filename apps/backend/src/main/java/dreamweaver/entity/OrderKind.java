package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 订单类型：direct 直接购买 / custom 私人定制。 */
public enum OrderKind {
    DIRECT("direct"), CUSTOM("custom");

    private final String value;

    OrderKind(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static OrderKind of(String v) {
        if (v == null) return DIRECT;
        for (OrderKind k : values()) if (k.value.equals(v)) return k;
        return DIRECT;
    }
}
