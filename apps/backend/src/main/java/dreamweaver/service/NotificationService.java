package dreamweaver.service;

import java.util.Map;

/** 站内通知业务。 */
public interface NotificationService {

    /** 通知列表：unread/type 过滤 + 创建时间倒序 + 分页，返回 {list,total,page,pageSize,unreadCount}。 */
    Map<String, Object> list(int userId, String unread, String type, String page, String pageSize);

    /** 标记已读：ids='all' / ids 数组 / 兜底全部已读，返回 {read,unreadCount}。 */
    Map<String, Object> markRead(int userId, Map<String, Object> body);
}
