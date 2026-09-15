package dreamweaver.service;

import dreamweaver.entity.Order;
import dreamweaver.entity.ResaleListing;
import java.util.Map;

/**
 * 二手集市业务（SPEC §3.6/§3.7）：
 *
 * <ul>
 *   <li>退货自动挂单：listPrice = 原价×0.75，platformFeeRate=8%（仓储/物流佣金）</li>
 *   <li>成交：买家付 listPrice → feeCharged 归平台，netToSeller 给原买家（写流水+通知）</li>
 *   <li>卖家可降价（只降不升）/取消上架</li>
 * </ul>
 *
 * <p>实现类 {@code ResaleServiceImpl}，取代原二手集市引擎。返回普通对象（Map / 实体），
 * 响应包装由控制层负责。
 */
public interface ResaleService {

    /** 集市列表（仅上架中，分页，默认每页 12）。 */
    Map<String, Object> mall(String page, String pageSize);

    /** 我的挂单（可按状态过滤，分页，默认每页 12）。 */
    Map<String, Object> mine(int sellerId, String status, String page, String pageSize);

    /** 购买二手挂单。 */
    Map<String, Object> buy(int buyerId, int listingId);

    /** 卖家改价（只降不升）；body 需含 listPrice。 */
    Map<String, Object> changePrice(int sellerId, int listingId, Map<String, Object> body);

    /** 卖家取消上架；body 可含 reason。 */
    Map<String, Object> cancel(int sellerId, int listingId, Map<String, Object> body);

    /** 定制退货自动创建二手挂单（售后域调用）。 */
    ResaleListing createResaleFromReturn(Order order, double originalPrice);
}
