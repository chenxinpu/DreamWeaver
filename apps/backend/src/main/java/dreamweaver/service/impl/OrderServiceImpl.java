package dreamweaver.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.BodyMeasurement;
import dreamweaver.entity.LogisticsInfo;
import dreamweaver.entity.LogisticsTrace;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderAmounts;
import dreamweaver.entity.OrderKind;
import dreamweaver.entity.OrderSpecUsed;
import dreamweaver.entity.OrderStage;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.OrderTimelineItem;
import dreamweaver.entity.Product;
import dreamweaver.entity.QcItem;
import dreamweaver.entity.QcReport;
import dreamweaver.entity.Role;
import dreamweaver.entity.SpecLine;
import dreamweaver.entity.User;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.UserRepository;
import dreamweaver.service.CustomService;
import dreamweaver.service.NotifyService;
import dreamweaver.service.OrderService;
import dreamweaver.service.RealtimeService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 订单业务（SPEC §3.5）：创建 → 支付 → 生产履约状态机 + 演示推进。
 *
 * <p>状态机：created→paid→producing→qc→shipping→received→(completed)
 *
 * <p>本类取代原订单引擎：持久化走 {@link OrderRepository}，实时推送走
 * {@link RealtimeService}，记账/通知走 {@link NotifyService}。所有中文文案、金额计算
 * （{@link MiscUtil#r2}）、订单号（{@link TimeUtil#genOrderNo}）与时间线内容与原实现逐字一致。
 *
 * <p>对外契约见 {@link OrderService}：控制器与其它 service 一律经该接口注入，
 * 本类不再向内暴露实现类型。
 */
@Service
public class OrderServiceImpl implements OrderService {

    private static final Comparator<Order> CREATED_DESC =
            (a, b) -> str(b.createdAt).compareTo(str(a.createdAt));

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final DtoMapper dto;
    private final NotifyService notifyService;
    private final RealtimeService realtimeService;
    private final CustomService customService;
    private final ObjectMapper json;

    public OrderServiceImpl(OrderRepository orderRepository,
                            ProductRepository productRepository,
                            UserRepository userRepository,
                            DtoMapper dto,
                            NotifyService notifyService,
                            RealtimeService realtimeService,
                            CustomService customService,
                            ObjectMapper json) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.userRepository = userRepository;
        this.dto = dto;
        this.notifyService = notifyService;
        this.realtimeService = realtimeService;
        this.customService = customService;
        this.json = json;
    }

    /* ------------------------------- 出参类型 ------------------------------- */

    /** 下单内部结果：订单 + 定制适配结果（对应 TS {@code { order, adapt }}）。 */
    private static final class CustomCreate {
        Order order;
        CustomService.AdaptResult adapt;
    }

    /* ------------------------------- 创建订单 ------------------------------- */

    /** 下单（direct/custom）。 */
    @Override
    @Transactional
    public Map<String, Object> create(int buyerId, Map<String, Object> body) {
        Map<String, Object> b = body == null ? Map.of() : body;

        Product product = productRepository.findById(MiscUtil.toInt(b.get("productId"), -1)).orElse(null);
        if (product == null) throw Errors.notFound("商品不存在");
        if (!"onSale".equals(product.status)) throw Errors.bad("PRODUCT_OFF", "商品已下架");

        String kind = jsOr(b.get("kind"), "direct");
        Order order;
        CustomService.AdaptResult adapt = null;
        if ("custom".equals(kind)) {
            Object raw = b.get("body");
            if (!(raw instanceof Map<?, ?> rawMap)) {
                throw Errors.bad("BAD_REQUEST", "私人定制需要提供 body（体型数据）");
            }
            BodyMeasurement measurement = json.convertValue(rawMap, BodyMeasurement.class);
            // TS 直接透传客户端对象：未提供 source 时该键缺席（而非 "manual"）
            if (!rawMap.containsKey("source")) measurement.source = null;
            CustomCreate created = createCustomOrder(product, buyerId, measurement);
            order = created.order;
            adapt = created.adapt;
        } else if ("direct".equals(kind)) {
            order = createDirectOrder(product, buyerId, jsTruthy(b.get("size")) ? jsStr(b.get("size")) : null);
        } else {
            throw Errors.bad("BAD_REQUEST", "kind 需为 direct/custom");
        }

        Role role = roleOf(userRepository.findById(buyerId).orElse(null));
        Map<String, Object> out = dto.orderDTO(order, buyerId, role);
        if (adapt != null) {
            Map<String, Object> extra = new LinkedHashMap<>();
            extra.put("baseSize", adapt.baseSize);
            extra.put("adjustedSpec", adapt.adjustedSpec);
            extra.put("fitAlerts", adapt.fitAlerts);
            extra.put("totalEstimate", adapt.totalEstimate);
            out.put("adapt", extra);
        }
        return out;
    }

    /** 直接购买：下单。 */
    @Override
    @Transactional
    public Order createDirectOrder(Product product, int buyerId, String size) {
        Order order = new Order();
        order.no = TimeUtil.genOrderNo();
        order.productId = product.id;
        order.productTitle = product.title;
        order.cover = product.cover;
        order.creatorId = product.creatorId;
        order.kind = OrderKind.DIRECT;
        order.buyerId = buyerId;
        OrderSpecUsed spec = new OrderSpecUsed();
        spec.size = size == null || size.isEmpty() ? "M" : size;
        order.specUsed = spec;
        OrderAmounts amounts = new OrderAmounts();
        amounts.price = product.price;
        amounts.baseFee = 0;
        amounts.total = MiscUtil.r2(product.price);
        order.amounts = amounts;
        order.status = OrderStatus.CREATED;
        addTimeline(order, TimeUtil.nowIso(), "订单已创建（直接购买）");
        order.prodDays = prodDaysOf(product);
        order.createdAt = TimeUtil.nowIso();
        orderRepository.save(order);
        realtimeService.publishOrderStatus(order);   // 实时推送：order:<id> 的 status 帧
        return order;
    }

    /** 私人定制：下单。 */
    private CustomCreate createCustomOrder(Product product, int buyerId, BodyMeasurement body) {
        CustomService.AdaptResult adapt = customService.adaptToProduct(product, body);

        Order order = new Order();
        order.no = TimeUtil.genOrderNo();
        order.productId = product.id;
        order.productTitle = product.title;
        order.cover = product.cover;
        order.creatorId = product.creatorId;
        order.kind = OrderKind.CUSTOM;
        order.buyerId = buyerId;
        OrderSpecUsed spec = new OrderSpecUsed();
        spec.size = adapt.baseSize;
        spec.adjusted = cloneSpec(adapt.adjustedSpec);
        spec.body = body;
        order.specUsed = spec;
        OrderAmounts amounts = new OrderAmounts();
        amounts.price = product.price;
        amounts.baseFee = product.baseFee;
        amounts.total = MiscUtil.r2(product.price + product.baseFee);
        order.amounts = amounts;
        order.status = OrderStatus.CREATED;
        addTimeline(order, TimeUtil.nowIso(),
                "定制订单已创建（基码 " + adapt.baseSize + "，含基础费用）");
        order.prodDays = prodDaysOf(product);
        order.createdAt = TimeUtil.nowIso();
        orderRepository.save(order);
        realtimeService.publishOrderStatus(order);   // 实时推送：order:<id> 的 status 帧

        CustomCreate out = new CustomCreate();
        out.order = order;
        out.adapt = adapt;
        return out;
    }

    /** 换货重做订单：旧单 exchanged，新单再收 baseFee（金额 = 0×price + baseFee） */
    @Override
    @Transactional
    public Order createExchangeOrder(Order oldOrder, Product product) {
        Order order = new Order();
        order.no = TimeUtil.genOrderNo();
        order.productId = product.id;
        order.productTitle = product.title;
        order.cover = product.cover;
        order.creatorId = product.creatorId;
        order.kind = OrderKind.CUSTOM;
        order.buyerId = oldOrder.buyerId;
        order.specUsed = oldOrder.specUsed;
        OrderAmounts amounts = new OrderAmounts();
        amounts.price = 0;
        amounts.baseFee = product.baseFee;
        amounts.total = MiscUtil.r2(product.baseFee);
        order.amounts = amounts;
        order.status = OrderStatus.CREATED;
        addTimeline(order, TimeUtil.nowIso(),
                "换货重新定制订单已创建（原价已付第一单，本次仅再付基础费用 ¥" + MiscUtil.jsNum(product.baseFee) + "）");
        order.prodDays = prodDaysOf(product);
        order.simulate = Boolean.TRUE;
        order.createdAt = TimeUtil.nowIso();
        orderRepository.save(order);
        realtimeService.publishOrderStatus(order);   // 实时推送：order:<id> 的 status 帧
        return order;
    }

    /* -------------------------------- 支付 -------------------------------- */

    /** 支付（模拟，直接成功）。 */
    @Override
    @Transactional
    public Map<String, Object> pay(int buyerId, int orderId) {
        Order order = findOrder(orderId);
        if (order.buyerId != buyerId) throw Errors.deny("只有买家可支付");
        if (order.status != OrderStatus.CREATED) throw Errors.bad("ORDER_STATE", "仅待支付订单可支付");
        if (order.amounts.total > 0) {
            notifyService.ledger(buyerId, "order_pay", -order.amounts.total, order.no); // 模拟钱包扣款
        }
        payOrder(order);
        return dto.orderDTO(order, buyerId, roleOf(userRepository.findById(buyerId).orElse(null)));
    }

    private Order payOrder(Order order) {
        if (order.status != OrderStatus.CREATED) throw Errors.bad("ORDER_STATE", "仅待支付订单可支付");
        order.status = OrderStatus.PAID;
        order.paidAt = TimeUtil.nowIso();
        addTimeline(order, TimeUtil.nowIso(), "支付成功 ¥" + MiscUtil.jsNum(order.amounts.total) + "（模拟）");
        // 通知创作者
        notifyService.notify(order.creatorId, "order", "💰 收到新订单",
                (order.buyerId == 14 ? "「我的小号」" : "买家#" + order.buyerId)
                        + " 支付了「" + order.productTitle + "」"
                        + (order.kind == OrderKind.CUSTOM ? "（私人定制）" : "")
                        + " ¥" + MiscUtil.jsNum(order.amounts.total),
                "/creator/dashboard");
        realtimeService.publishOrderStatus(order);   // 实时推送：created → paid
        return order;
    }

    /* ------------------------------ 我的订单 ------------------------------ */

    /** 买家视角订单列表（状态过滤 + 分页）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> mine(int userId, String status, String page, String pageSize) {
        String st = blankToNull(status);

        List<Order> list;
        if (st == null) {
            list = new ArrayList<>(orderRepository.findByBuyerIdOrderByCreatedAtDesc(userId));
        } else if ("aftersale".equals(st)) {
            list = new ArrayList<>();
            for (Order o : orderRepository.findByBuyerIdOrderByCreatedAtDesc(userId)) {
                if (o.returnReq != null && !"none".equals(o.returnReq.state)) list.add(o);
            }
        } else {
            OrderStatus target = parseStatus(st);
            list = target == null ? new ArrayList<>()
                    : new ArrayList<>(orderRepository.findByBuyerIdAndStatusOrderByCreatedAtDesc(userId, target));
        }
        list.sort(CREATED_DESC);
        for (Order o : list) o.stage = estimateStage(o);

        Map<String, Object> paged = MiscUtil.paginate(list, MiscUtil.toInt(page, 1), MiscUtil.toInt(pageSize, 10));
        List<?> slice = (List<?>) paged.get("list");
        List<Map<String, Object>> dtos = new ArrayList<>();
        for (Object o : slice) dtos.add(dto.orderDTO((Order) o, userId, Role.CONSUMER));
        paged.put("list", dtos);
        return paged;
    }

    /** 创作者视角订单列表（状态/商品过滤 + 分页 + stats）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> sellerMine(int userId, String status, String productId,
                                          String page, String pageSize) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null || (user.role != Role.CREATOR && user.role != Role.AUDITOR && user.role != Role.ADMIN)) {
            throw Errors.deny("仅创作者可查看");
        }
        String st = blankToNull(status);
        Integer pid = blankToNull(productId) == null ? null : MiscUtil.toIntOrNull(productId);
        // TS: (!productId || o.productId === productId) —— NaN 与 0 均视为“不过滤”
        boolean filterByProduct = pid != null && pid != 0;

        List<Order> list;
        if (filterByProduct) {
            list = new ArrayList<>(
                    orderRepository.findByCreatorIdAndProductIdOrderByCreatedAtDesc(userId, pid));
        } else {
            list = new ArrayList<>(orderRepository.findByCreatorIdOrderByCreatedAtDesc(userId));
        }
        if (st != null) {
            OrderStatus target = parseStatus(st);
            List<Order> filtered = new ArrayList<>();
            if (target != null) {
                for (Order o : list) {
                    if (o.status == target) filtered.add(o);
                }
            }
            list = filtered;
        }
        list.sort(CREATED_DESC);
        for (Order o : list) o.stage = estimateStage(o);

        int total = list.size();
        double paidTotal = 0;
        int pendingShip = 0;
        for (Order o : list) {
            if (o.status != OrderStatus.CREATED && o.status != OrderStatus.CANCELLED) paidTotal += o.amounts.total;
            if (o.status == OrderStatus.PAID || o.status == OrderStatus.PRODUCING || o.status == OrderStatus.QC) {
                pendingShip++;
            }
        }

        Map<String, Object> paged = MiscUtil.paginate(list, MiscUtil.toInt(page, 1), MiscUtil.toInt(pageSize, 10));
        List<?> slice = (List<?>) paged.get("list");
        List<Map<String, Object>> dtos = new ArrayList<>();
        for (Object o : slice) dtos.add(dto.orderDTO((Order) o, userId, user.role));

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("total", total);
        stats.put("paidTotal", MiscUtil.r2(paidTotal));
        stats.put("pendingShip", pendingShip);

        paged.put("list", dtos);
        paged.put("stats", stats);
        return paged;
    }

    /* ------------------------------ 订单详情 ------------------------------ */

    /** 订单详情（买家/卖家/审核/管理员可见）。 */
    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> detail(int userId, int orderId) {
        User user = userRepository.findById(userId).orElse(null);
        Order order = findMyOrder(orderId, userId);
        order.stage = estimateStage(order);
        return dto.orderDTO(order, userId, roleOf(user));
    }

    /* ------------------------------ 演示推进 ------------------------------ */

    /** 演示推进（AUDITOR/ADMIN/买家/卖家可操作）。 */
    @Override
    @Transactional
    public Map<String, Object> devAdvance(int userId, int orderId) {
        User user = userRepository.findById(userId).orElse(null);
        Order order = findMyOrder(orderId, userId);
        if (user == null || (user.role != Role.AUDITOR && user.role != Role.ADMIN
                && order.buyerId != userId && order.creatorId != userId)) {
            throw Errors.deny();
        }
        String msg = advanceStatus(order);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("msg", msg);
        out.putAll(dto.orderDTO(order, userId, roleOf(user)));
        return out;
    }

    /* ------------------------------ 确认收货 ------------------------------ */

    /** 买家确认收货（等价于推进到 received）。 */
    @Override
    @Transactional
    public Map<String, Object> confirmReceived(int userId, int orderId) {
        User user = userRepository.findById(userId).orElse(null);
        Order order = findOrder(orderId);
        if (order.buyerId != userId) throw Errors.deny("只有买家可确认收货");
        if (order.status != OrderStatus.SHIPPING) throw Errors.bad("ORDER_STATE", "当前状态不可确认收货");

        String msg = advanceStatus(order);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("msg", msg);
        out.putAll(dto.orderDTO(order, userId, roleOf(user)));
        return out;
    }

    /* ------------------------------- 状态推导 ------------------------------- */

    /** 由时间推导 stage（读取时兜底，可被 dev-advance 覆盖）。 */
    @Override
    public OrderStage estimateStage(Order order) {
        OrderStage st = new OrderStage();
        String name = null;
        int basePercent = 0;
        String eta = "";

        switch (order.status) {
            case PAID:
                name = "待排产";
                basePercent = 8;
                eta = "已支付，等待排产";
                break;
            case PRODUCING:
                name = "生产制作";
                basePercent = 30;
                eta = "已进入柔性工厂排产（C2M 小单快反）";
                break;
            case QC:
                name = "出厂质检";
                basePercent = 82;
                eta = "完成面料/车缝/尺寸出厂质检";
                break;
            case SHIPPING:
                name = "已发货";
                basePercent = 94;
                eta = "包裹已交物流";
                break;
            case RECEIVED:
                name = "已收货";
                basePercent = 100;
                eta = "买家确认收货";
                break;
            default:
                break;
        }

        if (name == null) {
            switch (order.status) {
                case COMPLETED:
                    st.name = "已完成";
                    st.percent = 100;
                    st.eta = "";
                    st.doneAt = order.receivedAt;
                    return st;
                case CANCELLED:
                    st.name = "已取消";
                    st.percent = 0;
                    st.eta = "";
                    st.doneAt = order.createdAt;
                    return st;
                case CREATED:
                    st.name = "待支付";
                    st.percent = 4;
                    st.eta = "";
                    return st;
                default:
                    st.name = order.status.value();
                    st.percent = 0;
                    st.eta = "";
                    return st;
            }
        }

        // producing 期间按已过天数推进 percent
        int percent = basePercent;
        if (order.status == OrderStatus.PRODUCING && truthy(order.paidAt) && order.prodDays != null && order.prodDays != 0) {
            Long paidTsBox = MiscUtil.parseTs(order.paidAt);
            long paidTs = paidTsBox == null ? 0L : paidTsBox;
            double elapsed = (System.currentTimeMillis() - paidTs) / 86400000.0;
            long rounded = Math.round((elapsed / order.prodDays) * 80);
            percent = (int) Math.min(80L, Math.max(15L, rounded));
            long etaTs = paidTs + (long) order.prodDays * 86400000L;
            String fmt = TimeUtil.fmtTs(etaTs);
            eta = "预计 " + fmt.substring(5, 10).replace('-', '/') + " 完成生产";
        }
        if (order.status == OrderStatus.QC) {
            int days = order.prodDays == null || order.prodDays == 0 ? 9 : order.prodDays;
            eta = "质检中，" + MiscUtil.jsNum(days / 2.0) + " 天内交付物流";
        }
        if (order.status == OrderStatus.SHIPPING) eta = "运输中，约 2-3 天送达";

        st.name = name;
        st.percent = percent;
        st.eta = eta;
        if (truthy(order.receivedAt)) st.doneAt = order.receivedAt;
        return st;
    }

    /* ------------------------------ 演示推进 ------------------------------ */

    /** 演示推进：paid→producing→qc→shipping→received，自动写 timeline/质检/物流；返回提示语。 */
    private String advanceStatus(Order order) {
        OrderStatus next = nextStatusOf(order.status);
        if (next == null) {
            if (order.status == OrderStatus.RECEIVED || order.status == OrderStatus.COMPLETED) {
                throw Errors.bad("ORDER_DONE", "订单已收货/完成，无下一步");
            }
            if (order.status == OrderStatus.CANCELLED) throw Errors.bad("ORDER_STATE", "订单已取消");
            if (order.status == OrderStatus.CREATED) throw Errors.bad("ORDER_STATE", "请先支付");
            throw Errors.bad("ORDER_STATE", "当前状态不可推进");
        }

        String t = TimeUtil.nowIso();
        if (next == OrderStatus.PRODUCING) {
            order.status = OrderStatus.PRODUCING;
            addTimeline(order, t, "开始生产：版片排料 → 裁剪 → 车缝（含您的基础费用项下的个性化加工）");
        } else if (next == OrderStatus.QC) {
            order.status = OrderStatus.QC;
            QcReport report = new QcReport();
            report.pass = true;
            report.items.add(qcItem("面料成分", "与详情页声明一致 ✓"));
            report.items.add(qcItem("车缝线距", "3cm/12-14针，无跳线漏线 ✓"));
            report.items.add(qcItem("尺寸偏差",
                    "与定版偏差 " + String.format(Locale.ROOT, "%.1f", Math.random() * 0.6 + 0.1) + "mm（≤5mm）✓"));
            report.at = t;
            order.qcReport = report;
            addTimeline(order, t, "通过出厂质检（qcReport 已生成）");
        } else if (next == OrderStatus.SHIPPING) {
            order.status = OrderStatus.SHIPPING;
            String company = Math.random() > 0.5 ? "顺丰速运" : "京东物流";
            String digits = String.valueOf((long) Math.floor(Math.random() * 1e12));
            StringBuilder padded = new StringBuilder(digits);
            while (padded.length() < 12) padded.insert(0, '0');
            String trackingNo = (company.startsWith("顺丰") ? "SF" : "JD") + padded;
            LogisticsInfo logistics = new LogisticsInfo();
            logistics.company = company;
            logistics.trackingNo = trackingNo;
            LogisticsTrace tr1 = new LogisticsTrace();
            tr1.time = t;
            tr1.text = "已揽收，包裹从织梦柔性工厂发出";
            LogisticsTrace tr2 = new LogisticsTrace();
            tr2.time = TimeUtil.fmtTs(System.currentTimeMillis() + 3600000L);
            tr2.text = "到达华东转运中心（" + company + "）";
            logistics.traces.add(tr1);
            logistics.traces.add(tr2);
            order.logistics = logistics;
            order.shippedAt = t;
            addTimeline(order, t, "已发货：" + company + " " + trackingNo);
        } else if (next == OrderStatus.RECEIVED) {
            order.status = OrderStatus.RECEIVED;
            order.receivedAt = t;
            addTimeline(order, t, "买家确认收货，交易完成（T+7 后佣金自动结算）");
            notifyService.notify(order.buyerId, "order", "📦 订单已收货",
                    "「" + order.productTitle + "」确认收货成功。定制商品可在订单详情发起退/换货。",
                    "/mall/orders/" + order.id);
        }
        order.stage = estimateStage(order);
        // 实时推送：paid→producing→qc→shipping→received 任一步状态变更都会走到这里
        realtimeService.publishOrderStatus(order);
        return "订单推进至「" + stageName(next, order.status) + "」";
    }

    /** 到期(收货T+7)订单自动转 completed（供调度器调用）。 */
    @Override
    @Transactional
    public int autoCompleteReceived() {
        int n = 0;
        long now = System.currentTimeMillis();
        for (Order o : orderRepository.findByStatus(OrderStatus.RECEIVED)) {
            if (o.status == OrderStatus.RECEIVED && truthy(o.receivedAt)) {
                Long receivedTsBox = MiscUtil.parseTs(o.receivedAt);
                long receivedTs = receivedTsBox == null ? 0L : receivedTsBox;
                if (receivedTs + 7L * 86400000L <= now) {
                    o.status = OrderStatus.COMPLETED;
                    addTimeline(o, TimeUtil.nowIso(), "收货满 7 天，订单完成（可评价）");
                    realtimeService.publishOrderStatus(o);   // 实时推送：received → completed
                    n++;
                }
            }
        }
        return n;
    }

    /* ------------------------------ 内部工具 ------------------------------ */

    private Order findOrder(int orderId) {
        return orderRepository.findById(orderId).orElseThrow(() -> Errors.notFound("订单不存在"));
    }

    /** 等价于原控制器的 findMyOrder：买家/卖家/审核/管理员可见。 */
    private Order findMyOrder(int orderId, int userId) {
        Order order = findOrder(orderId);
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) throw Errors.deny();
        if (order.buyerId != userId && order.creatorId != userId
                && user.role != Role.AUDITOR && user.role != Role.ADMIN) {
            throw Errors.deny("无权查看该订单");
        }
        return order;
    }

    /**
     * 时间线追加：用「新列表替换」而非原地 {@code add}。
     *
     * <p>{@code timeline} 是 JSON 列，Hibernate 对可变 JSON 值不做原地变更追踪，
     * 换新实例可确保事务提交时真正 UPDATE；输出内容与原地追加完全一致。
     */
    private static void addTimeline(Order order, String t, String text) {
        OrderTimelineItem item = new OrderTimelineItem();
        item.t = t;
        item.text = text;
        List<OrderTimelineItem> timeline = order.timeline == null
                ? new ArrayList<>() : new ArrayList<>(order.timeline);
        timeline.add(item);
        order.timeline = timeline;
    }

    private static Integer prodDaysOf(Product product) {
        return product.prodDays == null || product.prodDays == 0 ? Integer.valueOf(9) : product.prodDays;
    }

    private static QcItem qcItem(String k, String v) {
        QcItem item = new QcItem();
        item.k = k;
        item.v = v;
        return item;
    }

    private static OrderStatus nextStatusOf(OrderStatus s) {
        switch (s) {
            case PAID: return OrderStatus.PRODUCING;
            case PRODUCING: return OrderStatus.QC;
            case QC: return OrderStatus.SHIPPING;
            case SHIPPING: return OrderStatus.RECEIVED;
            default: return null;
        }
    }

    /** STAGE_INFO[next]?.name || next */
    private static String stageName(OrderStatus next, OrderStatus actual) {
        switch (next) {
            case PRODUCING: return "生产制作";
            case QC: return "出厂质检";
            case SHIPPING: return "已发货";
            case RECEIVED: return "已收货";
            default: return actual.value();
        }
    }

    private static List<SpecLine> cloneSpec(List<SpecLine> src) {
        List<SpecLine> out = new ArrayList<>();
        if (src == null) return out;
        for (SpecLine s : src) {
            SpecLine c = new SpecLine();
            c.part = s.part;
            c.label = s.label;
            c.body = s.body;
            c.ease = s.ease;
            c.base = s.base;
            c.target = s.target;
            c.flag = s.flag;
            c.advise = s.advise;
            out.add(c);
        }
        return out;
    }

    /** 严格解析订单状态；未知值返回 null（等价原实现的 {@code st.equals(o.status.value())}）。 */
    private static OrderStatus parseStatus(String v) {
        for (OrderStatus s : OrderStatus.values()) {
            if (s.value().equals(v)) return s;
        }
        return null;
    }

    private static Role roleOf(User user) {
        return user == null || user.role == null ? Role.CONSUMER : user.role;
    }

    private static String blankToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }

    private static String str(String s) {
        return s == null ? "" : s;
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

    /** JS {@code v || dft} 再 {@code String()} */
    private static String jsOr(Object v, String dft) {
        return jsTruthy(v) ? jsStr(v) : dft;
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

    private static boolean truthy(String s) {
        return s != null && !s.isEmpty();
    }
}
