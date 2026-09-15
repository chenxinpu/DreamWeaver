package dreamweaver.common;

/** 业务断言快捷方法，对应原 Node 实现的 bad/deny/notFound。 */
public final class Errors {

    private Errors() {
    }

    /** 参数错误 → 400 */
    public static ApiException bad(String code, String msg) {
        return new ApiException(code, msg, 400);
    }

    /** 无权限 → 403 */
    public static ApiException deny() {
        return new ApiException("FORBIDDEN", "无权限操作", 403);
    }

    public static ApiException deny(String msg) {
        return new ApiException("FORBIDDEN", msg, 403);
    }

    /** 未登录 → 401 */
    public static ApiException unauthorized(String msg) {
        return new ApiException("UNAUTHORIZED", msg, 401);
    }

    /** 资源不存在 → 404 */
    public static ApiException notFound() {
        return new ApiException("NOT_FOUND", "资源不存在", 404);
    }

    public static ApiException notFound(String msg) {
        return new ApiException("NOT_FOUND", msg, 404);
    }
}
