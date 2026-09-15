package dreamweaver.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.regex.Pattern;

/**
 * 游客可访问的公开接口（浏览信息流 / 商城 / 素材预览等只读能力，无需登录）。
 * 互动（点赞/评论/下单/上架等）仍要求登录。
 */
public final class PublicApi {

    private static final Pattern POST_DETAIL = Pattern.compile("^/posts/\\d+$");
    private static final Pattern MATERIAL_DETAIL = Pattern.compile("^/materials/\\d+$");
    private static final Pattern PRODUCT_VIEW = Pattern.compile("^/products/\\d+/view$");

    private PublicApi() {
    }

    /** @param path 不含 /api 前缀的路径 */
    public static boolean matches(String method, String path) {
        boolean isGet = "GET".equals(method) || "HEAD".equals(method);
        // 根自述 GET /：公开（不在 /api/** 之下，这里显式登记以防拦截器路径规则变化）
        if (isGet && (path.isEmpty() || path.equals("/"))) return true;
        if (isGet) {
            if (path.equals("/feed") || path.startsWith("/feed/")) return true;
            if (POST_DETAIL.matcher(path).matches()) return true;
            if (path.equals("/mall/products") || path.startsWith("/products/")) return true;
            if (path.equals("/mall/resale")) return true;
            if (path.equals("/materials/import-help") || path.startsWith("/materials/sample-content")) return true;
            if (MATERIAL_DETAIL.matcher(path).matches()) return true;
            if (path.equals("/pool/meta") || path.equals("/feed/recommend/seed")) return true;
            if (path.equals("/health")) return true;
            // 只读诊断：暴露实体计数供 API 网关做聚合健康（无敏感数据）
            if (path.equals("/dev/info")) return true;
        }
        // 浏览量计数对游客也允许（幂等演示用途）
        if ("POST".equals(method) && PRODUCT_VIEW.matcher(path).matches()) return true;
        return false;
    }

    /** 从请求中取出去掉上下文后的业务路径 */
    public static String pathOf(HttpServletRequest req) {
        String uri = req.getRequestURI();
        String ctx = req.getContextPath();
        if (ctx != null && !ctx.isEmpty() && uri.startsWith(ctx)) uri = uri.substring(ctx.length());
        if (uri.startsWith("/api")) uri = uri.substring(4);
        if (uri.isEmpty()) uri = "/";
        return uri;
    }
}
