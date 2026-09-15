package dreamweaver.service;

import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.Notification;

/** 通知与资金流水业务。 */
public interface NotifyService {

    /** 写入站内通知，并投递实时通道（user:&lt;id&gt;）。 */
    Notification notify(int userId, String type, String title, String body, String link);

    Notification notify(int userId, String type, String title, String body);

    /** 记账：余额按该用户上一笔流水累加。 */
    LedgerEvent ledger(int userId, String kind, double amount, String refNo);

    /** 用户余额（按流水推演）。 */
    double userBalance(int userId);

    /** 未读通知数。 */
    long unreadCount(int userId);
}
