package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderKind;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.OrderTimelineItem;
import dreamweaver.entity.Product;
import dreamweaver.entity.ResaleListing;
import dreamweaver.entity.ReturnReq;
import dreamweaver.entity.Role;
import dreamweaver.entity.User;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.service.AftercareService;
import dreamweaver.service.NotifyService;
import dreamweaver.service.OrderService;
import dreamweaver.service.RealtimeService;
import dreamweaver.service.ResaleService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 售后业务（SPEC §3.6）：
 *
 * <ul>
 *   <li>定制退货：退款 = amounts.price（原价全额退，基础费用不退）→ 自动创建二手挂单 listPrice=price×0.75</li>
 *   <li>换货重做：旧单 exchanged + 新建 custom 单（再收一次基础费用）</li>
 *   <li>direct：未发货可取消（全额退）；收货后质量问题退货可退原价（demo 简化）</li>
 * </ul>
 *
 * <p>本类取代原售后引擎：持久化走 repository，实时推送走 {@link RealtimeService}，
 * 记账/通知走 {@link NotifyService}；换货新单由 {@link OrderService#createExchangeOrder} 负责。
 * 所有中文文案与金额计算（{@link MiscUtil#r2}）与原实现逐字一致。
 */
@Service
public class AftercareServiceImpl implements AftercareService {

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final DtoMapper dto;
    private final NotifyService notifyService;
    private final RealtimeService realtimeService;
    private final ResaleService resaleService;
    /** 订单域（换货新单创建）；原售后引擎 → 订单引擎的依赖改为订单域 service */
    private final OrderService orderService;

    public AftercareServiceImpl(OrderRepository orderRepository,
                                ProductRepository productRepository,
                                UserRepository userRepository,
                                DtoMapper dto,
                                NotifyService notifyService,
                                RealtimeService realtimeService,
                                ResaleService resaleService,
                                OrderService orderService) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.dto = dto;
        this.notifyService = notifyService;
        this.realtimeService = realtimeService;
        this.resaleService = resaleService;
        this.orderService = orderService;
    }

    /* ------------------------------- 出参类型 ------------------------------- */

    /** 退货/取消结果（对应 TS {@code { order, resaleId?, msg }}）。 */
    private static final class ReturnResult {
        String msg;
        Integer resaleId;
        Order order;
    }

    /** 换货结果（对应 TS {@code { oldOrder, newOrder, msg }}）。 */
    private static final class ExchangeResult {
        String msg;
        Order oldOrder;
        Order newOrder;
    }

    /* -------------------------------- 退货 -------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> returnOrder(int buyerId, int orderId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Order order = findOrder(orderId);
        if (order.buyerId != buyerId) throw Errors.deny("只有买家可发起售后");
        String reason = jsOr(b.get("reason"), "不想要了");
        Role role = roleOf(userRepository.findById(buyerId).orElse(null));

        Map<String, Object> out = new LinkedHashMap<>();
        if (order.kind == OrderKind.CUSTOM) {
            ReturnResult r = returnCustomOrder(order, reason);
            out.put("msg", r.msg);
            out.put("resaleId", r.resaleId);
            if (r.order.returnReq != null) out.put("refundAmount", r.order.returnReq.refundAmount);
            out.putAll(dto.orderDTO(r.order, buyerId, role));
        } else {
            ReturnResult r = returnDirectOrder(order, reason);
            out.put("msg", r.msg);
            out.putAll(dto.orderDTO(r.order, buyerId, role));
        }
        return out;
    }

    /** 定制退货 */
    private ReturnResult returnCustomOrder(Order order, String reason) {
        if (order.kind != OrderKind.CUSTOM) throw Errors.bad("ORDER_KIND", "仅私人定制订单支持该退货规则");
        if (order.status != OrderStatus.RECEIVED && order.status != OrderStatus.COMPLETED) {
            throw Errors.bad("ORDER_STATE", "确认收货后才能发起退货");
        }
        if (order.returnReq != null && !"none".equals(order.returnReq.state)) {
            throw Errors.bad("ORDER_STATE", "该订单已有售后记录");
        }

        double price = order.amounts.price;
        double baseFee = order.amounts.baseFee;
        String at = TimeUtil.nowIso();
        // 原价退给消费者，基础费用不退（加工/材料/人工）
        ResaleListing resale = resaleService.createResaleFromReturn(order, price);

        ReturnReq req = new ReturnReq();
        req.state = "done";
        req.refundAmount = price;
        req.baseFeeKept = baseFee;
        req.reason = reason;
        req.at = at;
        req.resaleListingId = resale.id;
        order.returnReq = req;

        addTimeline(order, at, "退货退款 ¥" + MiscUtil.jsNum(MiscUtil.r2(price)) + "（原价全额退；基础费用 ¥"
                + MiscUtil.jsNum(MiscUtil.r2(baseFee)) + " 不退）");
        notifyService.ledger(order.buyerId, "refund", price, "R-" + order.no);
        notifyService.notify(order.buyerId, "refund", "💸 退货退款已到账",
                "「" + order.productTitle + "」退货成功：退还商品原价 ¥" + MiscUtil.jsNum(MiscUtil.r2(price))
                        + "，基础费用 ¥" + MiscUtil.jsNum(MiscUtil.r2(baseFee))
                        + " 不退（加工/材料/人工）。二手集市已自动挂出该件商品（标价 原价×75%）。",
                "/mall/resale");
        notifyService.notify(order.creatorId, "refund", "↩️ 收到定制退货",
                "「" + order.productTitle + "」被退货：您保留基础费用 ¥" + MiscUtil.jsNum(MiscUtil.r2(baseFee))
                        + "（定制损耗补偿），商品已自动进入二手集市。",
                "/creator/dashboard");

        ReturnResult out = new ReturnResult();
        out.order = order;
        out.resaleId = resale.id;
        out.msg = "退货成功：退还 ¥" + MiscUtil.jsNum(MiscUtil.r2(price)) + "（基础费用不退），已自动创建二手挂单 ¥"
                + MiscUtil.jsNum(MiscUtil.r2(resale.listPrice));
        realtimeService.publishOrderStatus(order);   // 实时推送：定制退货（returnReq 已更新）
        return out;
    }

    /* ------------------------------ 换货重做 ------------------------------ */

    @Override
    @Transactional
    public Map<String, Object> exchange(int buyerId, int orderId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Order order = findOrder(orderId);
        if (order.buyerId != buyerId) throw Errors.deny("只有买家可发起换货");
        String reason = jsOr(b.get("reason"), "尺码/版型不合适");

        ExchangeResult r = exchangeCustomOrder(order, reason);
        Role role = roleOf(userRepository.findById(buyerId).orElse(null));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("msg", r.msg);
        out.put("newOrderId", r.newOrder.id);
        out.put("newOrderAmount", r.newOrder.amounts.total);
        out.put("order", dto.orderDTO(r.oldOrder, buyerId, role));
        out.put("newOrder", dto.orderDTO(r.newOrder, buyerId, role));
        return out;
    }

    /** 换货重做（再付一次基础费用） */
    private ExchangeResult exchangeCustomOrder(Order order, String reason) {
        if (order.kind != OrderKind.CUSTOM) throw Errors.bad("ORDER_KIND", "仅私人定制订单支持换货重做");
        if (order.status != OrderStatus.RECEIVED && order.status != OrderStatus.COMPLETED) {
            throw Errors.bad("ORDER_STATE", "确认收货后才能换货");
        }
        if (order.returnReq != null && !"none".equals(order.returnReq.state)) {
            throw Errors.bad("ORDER_STATE", "该订单已有售后记录");
        }
        Product product = productRepository.findById(order.productId).orElse(null);
        if (product == null) throw Errors.notFound("商品不存在");

        String at = TimeUtil.nowIso();
        Order newOrder = orderService.createExchangeOrder(order, product);

        ReturnReq req = new ReturnReq();
        req.state = "exchanged";
        req.refundAmount = 0;
        req.baseFeeKept = 0;
        req.reason = reason;
        req.at = at;
        req.newOrderId = newOrder.id;
        order.returnReq = req;

        addTimeline(order, at, "换货重做：原价已含在第一单，新单 #" + newOrder.no
                + " 仅需再付基础费用 ¥" + MiscUtil.jsNum(product.baseFee));
        notifyService.notify(order.buyerId, "refund", "🔄 换货重做已受理",
                "「" + order.productTitle + "」换货重做：旧单标记 exchanged，新定制订单已创建（再付一次基础费用 ¥"
                        + MiscUtil.jsNum(product.baseFee) + "），请前往支付。",
                "/mall/orders/" + newOrder.id);

        ExchangeResult out = new ExchangeResult();
        out.oldOrder = order;
        out.newOrder = newOrder;
        out.msg = "换货重做订单已创建：仅需再付基础费用 ¥" + MiscUtil.jsNum(MiscUtil.r2(product.baseFee));
        realtimeService.publishOrderStatus(order);   // 实时推送：换货（旧单 exchanged；新单创建时已推送）
        return out;
    }

    /* -------------------------------- 取消 -------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> cancel(int buyerId, int orderId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;
        Order order = findOrder(orderId);
        if (order.buyerId != buyerId) throw Errors.deny("只有买家可取消");
        String reason = jsOr(b.get("reason"), "用户取消");

        ReturnResult r = cancelOrder(order, reason);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("msg", r.msg);
        out.putAll(dto.orderDTO(r.order, buyerId, roleOf(userRepository.findById(buyerId).orElse(null))));
        return out;
    }

    /** direct 取消（未发货全额退）；custom 仅支付前取消（无退款） */
    private ReturnResult cancelOrder(Order order, String reason) {
        if (order.status == OrderStatus.CANCELLED) throw Errors.bad("ORDER_STATE", "订单已取消");
        boolean wasPaid = truthy(order.paidAt);
        if (order.kind == OrderKind.CUSTOM && order.status != OrderStatus.CREATED) {
            throw Errors.bad("ORDER_STATE", "定制订单生产后不支持取消，可收货后走退/换货流程");
        }
        if (order.kind == OrderKind.DIRECT && truthy(order.shippedAt)) {
            throw Errors.bad("ORDER_STATE", "订单已发货，取消需联系客服或收货后走售后");
        }

        String at = TimeUtil.nowIso();
        order.status = OrderStatus.CANCELLED;
        addTimeline(order, at, "订单已取消（" + (reason == null || reason.isEmpty() ? "用户取消" : reason) + "）");
        if (wasPaid && order.amounts.total > 0) {
            notifyService.ledger(order.buyerId, "refund", order.amounts.total, "C-" + order.no);
            addTimeline(order, at, "全额退款 ¥" + MiscUtil.jsNum(MiscUtil.r2(order.amounts.total)) + " 已原路退回");
            notifyService.notify(order.buyerId, "refund", "💸 取消订单退款到账",
                    "「" + order.productTitle + "」已取消并全额退款 ¥" + MiscUtil.jsNum(MiscUtil.r2(order.amounts.total)) + "。",
                    "/mall/orders/" + order.id);
        }

        ReturnResult out = new ReturnResult();
        out.order = order;
        out.msg = "订单已取消";
        realtimeService.publishOrderStatus(order);   // 实时推送：→ cancelled
        return out;
    }

    /* ---------------------------- 直接购买退货 ---------------------------- */

    /** 直接购买收货后质量问题退货（demo 简化可退原价） */
    private ReturnResult returnDirectOrder(Order order, String reason) {
        if (order.kind != OrderKind.DIRECT) throw Errors.bad("ORDER_KIND", "定制订单请走定制退货流程");
        if (order.status != OrderStatus.RECEIVED && order.status != OrderStatus.COMPLETED) {
            throw Errors.bad("ORDER_STATE", "确认收货后才能发起退货");
        }
        if (order.returnReq != null && !"none".equals(order.returnReq.state)) {
            throw Errors.bad("ORDER_STATE", "该订单已有售后记录");
        }

        String at = TimeUtil.nowIso();
        double amount = order.amounts.total;
        ReturnReq req = new ReturnReq();
        req.state = "done";
        req.refundAmount = amount;
        req.baseFeeKept = 0;
        req.reason = reason;
        req.at = at;
        order.returnReq = req;

        addTimeline(order, at, "质量问题退货：全额退款 ¥" + MiscUtil.jsNum(MiscUtil.r2(amount)) + "（质检判定演示通过）");
        notifyService.ledger(order.buyerId, "refund", amount, "R-" + order.no);
        notifyService.notify(order.buyerId, "refund", "💸 退货退款到账",
                "「" + order.productTitle + "」质量问题退货通过质检判定，全额退款 ¥" + MiscUtil.jsNum(MiscUtil.r2(amount)) + "。",
                "/mall/orders/" + order.id);

        ReturnResult out = new ReturnResult();
        out.order = order;
        out.msg = "质量问题退货成功，全额退款";
        realtimeService.publishOrderStatus(order);   // 实时推送：直接购买退货（returnReq 已更新）
        return out;
    }

    /* ------------------------------ 内部工具 ------------------------------ */

    private Order findOrder(int orderId) {
        return orderRepository.findById(orderId).orElseThrow(() -> Errors.notFound("订单不存在"));
    }

    /** 时间线追加：用「新列表替换」保证 JSON 列变更被 Hibernate 追踪（内容与原地追加一致）。 */
    private static void addTimeline(Order order, String t, String text) {
        OrderTimelineItem item = new OrderTimelineItem();
        item.t = t;
        item.text = text;
        List<OrderTimelineItem> timeline = order.timeline == null
                ? new ArrayList<>() : new ArrayList<>(order.timeline);
        timeline.add(item);
        order.timeline = timeline;
    }

    private static Role roleOf(User user) {
        return user == null || user.role == null ? Role.CONSUMER : user.role;
    }

    private static boolean truthy(String s) {
        return s != null && !s.isEmpty();
    }

    /** JS {@code v || dft} 再 {@code String()} */
    private static String jsOr(Object v, String dft) {
        return jsTruthy(v) ? jsStr(v) : dft;
    }

    /** JS {@code String(v)} */
    private static String jsStr(Object v) {
        if (v == null) return "null";
        if (v instanceof Integer || v instanceof Long || v instanceof Short || v instanceof Byte) {
            return String.valueOf(v);
        }
        if (v instanceof Number n) return MiscUtil.jsNum(n.doubleValue());
        return String.valueOf(v);
    }

    /** JS 真值语义（null/undefined/false/0/NaN/'' 为假，其余为真，含空对象/空数组）。 */
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
