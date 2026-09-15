package dreamweaver.service;

import java.util.Map;

/**
 * 售后业务（SPEC §3.6）：定制退货（退原价留基础费）/ 换货重做（再收基础费 + 新单）/ 取消。
 *
 * <p>实现类 {@code AftercareServiceImpl}，取代原售后引擎。
 * 返回普通对象（Map），响应包装由控制层负责。
 */
public interface AftercareService {

    /** 发起退货（定制/直接购买分支在实现内判定），body 可含 {@code reason}。 */
    Map<String, Object> returnOrder(int buyerId, int orderId, Map<String, Object> body);

    /** 换货重做（仅私人定制），body 可含 {@code reason}。 */
    Map<String, Object> exchange(int buyerId, int orderId, Map<String, Object> body);

    /** 取消订单，body 可含 {@code reason}。 */
    Map<String, Object> cancel(int buyerId, int orderId, Map<String, Object> body);
}
