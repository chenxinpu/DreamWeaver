package dreamweaver.config;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.PublicApi;
import dreamweaver.common.RequestContext;
import dreamweaver.entity.User;
import dreamweaver.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** 与既有实现一致的鉴权入口：公开接口直接放行，其余要求 Bearer token。 */
@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService auth;
    private final ObjectMapper json;

    public AuthInterceptor(AuthService auth, ObjectMapper json) {
        this.auth = auth;
        this.json = json;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) throws Exception {
        String path = PublicApi.pathOf(req);
        String method = req.getMethod();

        // 预检请求直接放行
        if ("OPTIONS".equals(method)) return true;

        // 登录/切换 与 公开只读接口 不做鉴权
        if (path.equals("/auth/login") || path.equals("/auth/switch") || PublicApi.matches(method, path)) {
            RequestContext.set(null);
            return true;
        }

        String token = bearerToken(req);
        Integer uid = auth.userIdOf(token);
        if (uid == null) {
            write(res, 401, ApiResponse.fail("UNAUTHORIZED", "请先登录（POST /api/auth/login {userId} 获取 token）"));
            return false;
        }
        User user = auth.userOf(uid);
        if (user == null) {
            write(res, 401, ApiResponse.fail("UNAUTHORIZED", "用户不存在，请重新登录"));
            return false;
        }
        RequestContext.set(uid);
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest req, HttpServletResponse res, Object handler, Exception ex) {
        RequestContext.clear();
    }

    public static String bearerToken(HttpServletRequest req) {
        String h = req.getHeader("Authorization");
        if (h == null) return null;
        if (h.startsWith("Bearer ")) return h.substring(7).trim();
        return null;
    }

    private void write(HttpServletResponse res, int status, ApiResponse body) throws Exception {
        res.setStatus(status);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        res.setContentType("application/json;charset=UTF-8");
        res.getWriter().write(json.writeValueAsString(body));
    }
}
