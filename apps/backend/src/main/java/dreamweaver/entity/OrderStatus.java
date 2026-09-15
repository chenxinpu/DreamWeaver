package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 订单状态机。 */
public enum OrderStatus {
    CREATED("created"), PAID("paid"), PRODUCING("producing"), QC("qc"),
    SHIPPING("shipping"), RECEIVED("received"), COMPLETED("completed"), CANCELLED("cancelled");

    private final String value;

    OrderStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static OrderStatus of(String v) {
        if (v == null) return CREATED;
        for (OrderStatus s : values()) if (s.value.equals(v)) return s;
        return CREATED;
    }
}
