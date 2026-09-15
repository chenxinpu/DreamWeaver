package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 用户角色。 */
public enum Role {
    CONSUMER("consumer"),
    CREATOR("creator"),
    AUDITOR("auditor"),
    ADMIN("admin");

    private final String value;

    Role(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static Role of(String v) {
        if (v == null) return CONSUMER;
        for (Role r : values()) if (r.value.equals(v)) return r;
        return CONSUMER;
    }
}
