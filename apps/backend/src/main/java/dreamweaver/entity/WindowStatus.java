package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 橱窗材料审核状态。 */
public enum WindowStatus {
    DRAFT("draft"), SUBMITTED("submitted"), APPROVED("approved"), REJECTED("rejected");

    private final String value;

    WindowStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static WindowStatus of(String v) {
        if (v == null) return DRAFT;
        for (WindowStatus s : values()) if (s.value.equals(v)) return s;
        return DRAFT;
    }
}
