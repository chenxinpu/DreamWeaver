package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.BodyMeasurement;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.entity.WindowStatus;
import dreamweaver.repository.NotificationRepository;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.repository.WindowMaterialRepository;
import dreamweaver.service.AuthService;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 鉴权：内存 token → userId（无状态会话，不必落库）；用户数据一律走 {@link UserRepository}。
 * Bearer 读取与角色守卫同处本类。
 */
@Service
public class AuthServiceImpl implements AuthService {

    /** me/body 接受的 12 项体型数据（顺序与原实现一致） */
    private static final List<String> BODY_KEYS = List.of(
            "height", "weight", "bust", "underBust", "waist", "hip",
            "shoulderWidth", "armLength", "thigh", "calf", "neck", "backLength");

    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final WindowMaterialRepository windowMaterialRepository;
    private final DtoMapper dto;

    private final SecureRandom random = new SecureRandom();
    private final Map<String, Integer> tokens = new ConcurrentHashMap<>();

    public AuthServiceImpl(UserRepository userRepository,
                           NotificationRepository notificationRepository,
                           OrderRepository orderRepository,
                           ProductRepository productRepository,
                           PoolEntryRepository poolEntryRepository,
                           WindowMaterialRepository windowMaterialRepository,
                           DtoMapper dto) {
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.windowMaterialRepository = windowMaterialRepository;
        this.dto = dto;
    }

    /* ------------------------------- 令牌 ------------------------------- */

    @Override
    public String issueToken(int userId) {
        byte[] buf = new byte[16];
        random.nextBytes(buf);
        String t = HexFormat.of().formatHex(buf);
        tokens.put(t, userId);
        return t;
    }

    /** 网关/前端 token 内省：无效返回 null。 */
    @Override
    public Integer userIdOf(String token) {
        if (token == null || token.isBlank()) return null;
        return tokens.get(token);
    }

    @Override
    public void revoke(String token) {
        if (token != null) tokens.remove(token);
    }

    /* ------------------------------- 用户 ------------------------------- */

    @Override
    @Transactional(readOnly = true)
    public User userOf(Integer userId) {
        if (userId == null) return null;
        return userRepository.findById(userId).orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public User requireUser(Integer userId) {
        User u = userOf(userId);
        if (u == null) throw Errors.unauthorized("用户不存在，请重新登录");
        return u;
    }

    /** 角色守卫 */
    @Override
    @Transactional(readOnly = true)
    public void guard(Integer userId, Role... roles) {
        User u = requireUser(userId);
        for (Role r : roles) {
            if (u.role == r) return;
        }
        throw Errors.deny("当前账号角色无权操作该接口");
    }

    @Override
    @Transactional(readOnly = true)
    public void guardCreator(Integer userId) {
        guard(userId, Role.CREATOR, Role.AUDITOR, Role.ADMIN);
    }

    @Override
    @Transactional(readOnly = true)
    public void guardConsumer(Integer userId) {
        guard(userId, Role.CONSUMER, Role.CREATOR, Role.AUDITOR, Role.ADMIN);
    }

    @Override
    @Transactional(readOnly = true)
    public void guardStaff(Integer userId) {
        guard(userId, Role.AUDITOR, Role.ADMIN);
    }

    /* ------------------------------ 聚合接口 ------------------------------ */

    /** 等价于 TS 的 login(userId)：{token, user, unread, orderCounts, cartCount, creator?} */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> login(int userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw Errors.bad("USER_NOT_FOUND", "演示账号 id=" + userId + " 不存在");
        String token = issueToken(userId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("token", token);
        out.put("user", dto.toUserPublic(user));
        out.putAll(aggregate(user));
        return out;
    }

    /** 等价于 TS 的 meAgg(userId)：{user, unread, orderCounts, cartCount, creator?} */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> meAggregate(int userId) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw Errors.bad("USER_NOT_FOUND", "用户不存在");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", dto.toUserPublic(user));
        out.putAll(aggregate(user));
        return out;
    }

    /** 保存体型数据（手动 12 项 / AI 量体结果） */
    @Override
    @Transactional
    public User updateBody(int userId, Map<String, Object> body) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw Errors.bad("USER_NOT_FOUND", "用户不存在");

        Map<String, Object> b = body == null ? Map.of() : body;
        BodyMeasurement bm = user.body == null ? new BodyMeasurement() : user.body;
        for (String k : BODY_KEYS) {
            // 原实现用 `b[k] !== undefined` 判断：JSON null 也要参与计算（Number(null) === 0）
            if (!b.containsKey(k)) continue;
            Double v = numOf(b.get(k));
            if (v == null || v.isNaN() || v.isInfinite()) continue;   // !Number.isFinite(v)
            switch (k) {
                case "height" -> bm.height = v;
                case "weight" -> bm.weight = v;
                case "bust" -> bm.bust = v;
                case "underBust" -> bm.underBust = v;
                case "waist" -> bm.waist = v;
                case "hip" -> bm.hip = v;
                case "shoulderWidth" -> bm.shoulderWidth = v;
                case "armLength" -> bm.armLength = v;
                case "thigh" -> bm.thigh = v;
                case "calf" -> bm.calf = v;
                case "neck" -> bm.neck = v;
                case "backLength" -> bm.backLength = v;
                default -> { }
            }
        }
        Object src = b.get("source");
        if ("manual".equals(src) || "ai".equals(src)) bm.source = String.valueOf(src);
        bm.updatedAt = TimeUtil.nowIso();
        user.body = bm;
        return userRepository.save(user);
    }

    /* ------------------------------ 内部实现 ------------------------------ */

    /** 等价于 TS 的 meAgg 统计部分：{unread, orderCounts, cartCount, creator?} */
    private Map<String, Object> aggregate(User user) {
        int userId = user.id;

        Map<String, Object> orderCounts = new LinkedHashMap<>();
        orderCounts.put("created", countOrders(userId, OrderStatus.CREATED));
        orderCounts.put("paid", countOrders(userId, OrderStatus.PAID));
        orderCounts.put("shipping", countOrders(userId, OrderStatus.SHIPPING));
        orderCounts.put("received", countOrders(userId, OrderStatus.RECEIVED));
        orderCounts.put("completed", countOrders(userId, OrderStatus.COMPLETED));

        Map<String, Object> agg = new LinkedHashMap<>();
        agg.put("unread", unreadOf(userId));
        agg.put("orderCounts", orderCounts);
        agg.put("cartCount", 0);
        if (user.role == Role.CREATOR || user.role == Role.AUDITOR || user.role == Role.ADMIN) {
            int poolUnhandled = 0;
            for (PoolEntry p : poolEntryRepository.findByCreatorIdOrderByQualifiedAtDesc(userId)) {
                if (p.notifiedAt == null || p.notifiedAt.isEmpty()) continue;
                if (p.workId == null
                        || !windowMaterialRepository.existsByWorkIdAndStatus(p.workId, WindowStatus.SUBMITTED)) {
                    poolUnhandled++;
                }
            }
            int productCount = (int) productRepository.countByCreatorIdAndStatus(userId, "onSale");
            int poolCount = (int) poolEntryRepository.countByCreatorId(userId);
            Map<String, Object> creator = new LinkedHashMap<>();
            creator.put("poolUnhandled", poolUnhandled);
            creator.put("productCount", productCount);
            creator.put("poolCount", poolCount);
            creator.put("unread", unreadOf(userId));
            agg.put("creator", creator);
        }
        return agg;
    }

    private int countOrders(int userId, OrderStatus status) {
        return (int) orderRepository.countByBuyerIdAndStatus(userId, status);
    }

    private int unreadOf(int userId) {
        return (int) notificationRepository.countByUserIdAndReadFalse(userId);
    }

    /** 等价于 JS 的 Number(v)；无法转换时返回 null（等价 NaN）。 */
    private static Double numOf(Object v) {
        if (v == null) return 0.0;                       // Number(null) === 0
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1.0 : 0.0;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return 0.0;                     // Number('') === 0
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return null;                                 // NaN
        }
    }
}
