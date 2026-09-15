package dreamweaver.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

/** 素材类型。 */
public enum MaterialKind {
    DXF("dxf"), SVG("svg"), OBJ("obj"), GLB("glb"), PNG("png"), JPG("jpg"),
    ZPRJ("zprj"), AI("ai"), PDF("pdf");

    private final String value;

    MaterialKind(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static MaterialKind of(String v) {
        if (v == null) return PDF;
        for (MaterialKind k : values()) if (k.value.equals(v)) return k;
        return PDF;
    }
}
