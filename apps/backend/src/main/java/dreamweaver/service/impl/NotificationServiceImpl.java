package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.entity.Notification;
import dreamweaver.repository.NotificationRepository;
import dreamweaver.service.NotificationService;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 站内通知列表 / 标记已读（逐行等价于 apps/server/src/routes/notifications.ts）。 */
@Service
public class NotificationServiceImpl implements NotificationService {

    private final NotificationRepository notificationRepository;

    public NotificationServiceImpl(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> list(int userId, String unread, String type, String page, String pageSize) {
        boolean onlyUnread = "1".equals(unread == null ? "" : unread);
        String t = (type == null || type.isEmpty()) ? null : type;

        List<Notification> list;
        if (onlyUnread && t != null) {
            list = notificationRepository.findByUserIdAndReadFalseAndTypeOrderByCreatedAtDesc(userId, t);
        } else if (onlyUnread) {
            list = notificationRepository.findByUserIdAndReadFalseOrderByCreatedAtDesc(userId);
        } else if (t != null) {
            list = notificationRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, t);
        } else {
            list = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        }

        Map<String, Object> paged = MiscUtil.paginate(list, MiscUtil.toInt(page, 1), MiscUtil.toInt(pageSize, 20));
        long unreadCount = notificationRepository.countByUserIdAndReadFalse(userId);

        Map<String, Object> out = new LinkedHashMap<>(paged);
        out.put("unreadCount", unreadCount);
        return out;
    }

    @Override
    @Transactional
    public Map<String, Object> markRead(int userId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Object ids = b.get("ids");

        if ("all".equals(ids) || jsTruthy(b.get("all"))) {
            notificationRepository.markAllRead(userId);
        } else if (ids instanceof List<?> rawIds) {
            Set<Integer> wanted = new HashSet<>();
            for (Object raw : rawIds) {
                Integer id = MiscUtil.toIntOrNull(raw);
                if (id != null) wanted.add(id);
            }
            if (!wanted.isEmpty()) notificationRepository.markReadByIds(userId, new ArrayList<>(wanted));
        } else {
            // 全部已读兜底
            notificationRepository.markAllRead(userId);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("read", true);
        out.put("unreadCount", notificationRepository.countByUserIdAndReadFalse(userId));
        return out;
    }

    /** 等价 JS 真值判断（null/undefined/false/0/""/NaN 为假，其余为真） */
    private static boolean jsTruthy(Object v) {
        if (v == null) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) {
            double d = n.doubleValue();
            return d != 0 && !Double.isNaN(d);
        }
        if (v instanceof String s) return !s.isEmpty();
        return true;
    }
}
