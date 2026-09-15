package dreamweaver.service;

import dreamweaver.entity.Order;
import dreamweaver.entity.OrderStage;
import dreamweaver.entity.Product;
import java.util.Map;

/** 订单业务（SPEC §3.5）：创建 → 支付 → 生产履约状态机 + 演示推进。 */
public interface OrderService {

    /** 每日任务：把已收货订单自动置为已完成，返回处理条数。 */
    int autoCompleteReceived();

    /** 下单（direct/custom）。 */
    Map<String, Object> create(int buyerId, Map<String, Object> body);

    /** 直接购买：下单。 */
    Order createDirectOrder(Product product, int buyerId, String size);

    /** 换货重做订单：旧单 exchanged，新单再收 baseFee（金额 = 0×price + baseFee）。 */
    Order createExchangeOrder(Order oldOrder, Product product);

    /** 支付（模拟，直接成功）。 */
    Map<String, Object> pay(int buyerId, int orderId);

    /** 买家视角订单列表（状态过滤 + 分页）。 */
    Map<String, Object> mine(int userId, String status, String page, String pageSize);

    /** 创作者视角订单列表（状态/商品过滤 + 分页 + stats）。 */
    Map<String, Object> sellerMine(int userId, String status, String productId,
                                   String page, String pageSize);

    /** 订单详情（买家/卖家/审核/管理员可见）。 */
    Map<String, Object> detail(int userId, int orderId);

    /** 演示推进（AUDITOR/ADMIN/买家/卖家可操作）。 */
    Map<String, Object> devAdvance(int userId, int orderId);

    /** 买家确认收货（等价于推进到 received）。 */
    Map<String, Object> confirmReceived(int userId, int orderId);

    /** 由时间推导 stage（读取时兜底，可被 dev-advance 覆盖）。 */
    OrderStage estimateStage(Order order);
}
