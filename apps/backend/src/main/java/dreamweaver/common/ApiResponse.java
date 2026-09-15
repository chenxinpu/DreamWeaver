package dreamweaver.common;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 统一响应体，与既有契约保持一致：
 * 成功 {@code {ok:true,data:...}}；失败 {@code {ok:false,code,msg}}。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse(boolean ok, Object data, String code, String msg) {

    public static ApiResponse ok(Object data) {
        return new ApiResponse(true, data, null, null);
    }

    public static ApiResponse fail(String code, String msg) {
        return new ApiResponse(false, null, code, msg);
    }
}
