package dreamweaver.common;

/** 业务异常：由 {@link GlobalExceptionHandler} 转换为统一 JSON 响应。 */
public class ApiException extends RuntimeException {

    private final String code;
    private final int status;

    public ApiException(String code, String msg, int status) {
        super(msg);
        this.code = code;
        this.status = status;
    }

    public String code() {
        return code;
    }

    public int status() {
        return status;
    }
}
