package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.Notification;
import dreamweaver.repository.LedgerEventRepository;
import dreamweaver.repository.NotificationRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.RealtimeService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 通知 / 资金流水写入辅助（持久化走 repository，实时推送走 {@link RealtimeService}）。 */
@Service
public class NotifyServiceImpl implements NotifyService {

    private final NotificationRepository notificationRepository;
    private final LedgerEventRepository ledgerEventRepository;
    private final RealtimeService realtime;

    public NotifyServiceImpl(NotificationRepository notificationRepository,
                             LedgerEventRepository ledgerEventRepository,
                             RealtimeService realtime) {
        this.notificationRepository = notificationRepository;
        this.ledgerEventRepository = ledgerEventRepository;
        this.realtime = realtime;
    }

    @Override
    @Transactional
    public Notification notify(int userId, String type, String title, String body, String link) {
        Notification n = new Notification();
        n.userId = userId;
        n.type = type;
        n.title = title;
        n.body = body;
        n.link = link;
        n.read = false;
        n.createdAt = TimeUtil.nowIso();
        notificationRepository.save(n);
        // 站内通知同时投递到实时通道（user:<id>），由 WebSocket 网关推送在线前端
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", n.id);
        payload.put("type", n.type);
        payload.put("title", n.title);
        payload.put("body", n.body);
        payload.put("link", n.link);
        payload.put("createdAt", n.createdAt);
        realtime.publishUserNotification(userId, payload);
        return n;
    }

    @Override
    @Transactional
    public Notification notify(int userId, String type, String title, String body) {
        return notify(userId, type, title, body, null);
    }

    /** 记账：balance 按该用户上一笔流水累加 */
    @Override
    @Transactional
    public LedgerEvent ledger(int userId, String kind, double amount, String refNo) {
        LedgerEvent prev = ledgerEventRepository.findFirstByUserIdOrderByIdDesc(userId);
        double prevBalance = prev == null ? 0 : prev.balance;
        LedgerEvent ev = new LedgerEvent();
        ev.userId = userId;
        ev.kind = kind;
        ev.amount = MiscUtil.r2(amount);
        ev.balance = MiscUtil.r2(prevBalance + amount);
        ev.refNo = refNo;
        ev.createdAt = TimeUtil.nowIso();
        return ledgerEventRepository.save(ev);
    }

    /** 用户余额（按流水推演） */
    @Override
    @Transactional(readOnly = true)
    public double userBalance(int userId) {
        double bal = 0;
        for (LedgerEvent l : ledgerEventRepository.findByUserIdOrderByIdAsc(userId)) {
            bal = l.balance;
        }
        return bal;
    }

    /** 未读通知数。 */
    @Override
    @Transactional(readOnly = true)
    public long unreadCount(int userId) {
        return notificationRepository.countByUserIdAndReadFalse(userId);
    }
}
