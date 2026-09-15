package dreamweaver.common;

/**
 * 当前请求的登录用户（由 {@link AuthInterceptor} 写入）。
 *
 * <p>与既有契约保持一致：<b>公开接口不做鉴权</b>，因此公开路径下
 * {@link #currentUserId()} 返回 {@code null}（等价于原实现的 {@code undefined}）。
 */
public final class RequestContext {

    private static final ThreadLocal<Integer> USER = new ThreadLocal<>();

    private RequestContext() {
    }

    public static void set(Integer userId) {
        if (userId == null) USER.remove();
        else USER.set(userId);
    }

    public static Integer currentUserId() {
        return USER.get();
    }

    /** 必须已登录（网关已校验，理论上不会为 null） */
    public static int requireUserId() {
        Integer id = USER.get();
        if (id == null) throw dreamweaver.common.Errors.unauthorized(
                "请先登录（POST /api/auth/login {userId} 获取 token）");
        return id;
    }

    public static void clear() {
        USER.remove();
    }
}
