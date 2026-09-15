package dreamweaver.service.impl;

import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.Product;
import dreamweaver.entity.ViewSeed;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.ViewSeedRepository;
import dreamweaver.service.CommissionService;
import dreamweaver.service.DashboardService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 变现数据看板聚合（SPEC §3.9，桌面 BI 规范），逐行等价于 {@code apps/server/src/engine/dashboard.ts}：
 * KPI 卡 + 折线(成交额&订单量) + 柱状(商品销量) + 退货趋势 + 渠道饼图 + 明细表。
 *
 * <p>改造说明：原内存库版看板聚合引擎改为本实现，数据全部经
 * repository 查询；佣金口径复用 {@link CommissionService}。
 */
@Service
public class DashboardServiceImpl implements DashboardService {

    private static final List<String> CHANNEL_NAMES =
            List.of("广场推荐", "商城分类", "搜索", "分享", "创作者推荐");

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;
    private final ViewSeedRepository viewSeedRepository;
    private final CommissionService commission;

    public DashboardServiceImpl(ProductRepository productRepository,
                                OrderRepository orderRepository,
                                ViewSeedRepository viewSeedRepository,
                                CommissionService commission) {
        this.productRepository = productRepository;
        this.orderRepository = orderRepository;
        this.viewSeedRepository = viewSeedRepository;
        this.commission = commission;
    }

    private static String channelOf(Order o) {
        if (o.channel != null && CHANNEL_NAMES.contains(o.channel)) return o.channel;
        return CHANNEL_NAMES.get(0);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard(int creatorId, int days, Integer productId) {
        long now = System.currentTimeMillis();
        long fromTs = TimeUtil.startOfDayKey(TimeUtil.dateKeyNow()) - (long) days * TimeUtil.DAY_MS;
        String fromKey = TimeUtil.dateKeyOf(fromTs);
        String todayKey = TimeUtil.dateKeyNow();

        List<Product> products = new ArrayList<>();
        for (Product p : productRepository.findByCreatorIdOrderByCreatedAtDesc(creatorId)) {
            if (productId != null && productId != 0 && !Objects.equals(p.id, productId)) continue;
            products.add(p);
        }
        // 原内存库按插入顺序（id 升序）遍历；这里恢复同一顺序，保证金额并列时稳定排序与旧实现一致
        products.sort(Comparator.comparingInt(p -> p.id));
        Set<Integer> productIds = new HashSet<>();
        for (Product p : products) productIds.add(p.id);

        List<String> dayKeys = new ArrayList<>();
        for (int i = days - 1; i >= 0; i--) {
            dayKeys.add(TimeUtil.dateKeyOf(fromTs + (long) i * TimeUtil.DAY_MS));
        }
        Set<String> keySet = new HashSet<>(dayKeys);

        List<ViewSeed> creatorViews = viewSeedRepository.findByCreatorId(creatorId);

        List<Order> paidOrders = new ArrayList<>();
        for (Order o : orderRepository.findByCreatorIdOrderByCreatedAtDesc(creatorId)) {
            if (!productIds.contains(o.productId)) continue;
            Long createdTs = MiscUtil.parseTs(o.createdAt);
            if (createdTs != null && (createdTs < fromTs || createdTs > now)) continue;
            if (o.status == OrderStatus.CANCELLED || o.status == OrderStatus.CREATED) continue;
            paidOrders.add(o);
        }

        Map<String, Integer> viewsMap = new HashMap<>();
        int totalViews = 0;
        for (ViewSeed v : creatorViews) {
            if (!productIds.contains(v.productId)) continue;
            if (v.dayKey == null || !keySet.contains(v.dayKey)) continue;
            totalViews += v.count;
            viewsMap.merge(v.dayKey, v.count, Integer::sum);
        }

        // KPI
        double revenue30 = 0;
        for (Order o : paidOrders) revenue30 += commission.orderRevenue(o);
        revenue30 = MiscUtil.r2(revenue30);

        List<Order> returns30 = new ArrayList<>();
        for (Order o : paidOrders) {
            if (o.returnReq != null && "done".equals(o.returnReq.state)) returns30.add(o);
        }
        double conversion = MiscUtil.pct(paidOrders.size(), totalViews);
        double returnRate = MiscUtil.pct(returns30.size(), paidOrders.size());

        double estCommission = 0;
        for (Product p : products) {
            double rate = commission.commissionRateValue(p.id, days) / 100;
            for (Order o : paidOrders) {
                if (o.productId == p.id) estCommission += commission.orderRevenue(o) * rate;
            }
        }
        estCommission = MiscUtil.r2(estCommission);

        // 折线
        Map<String, Double> amountByDay = new HashMap<>();
        Map<String, Integer> ordersByDay = new HashMap<>();
        for (Order o : paidOrders) {
            Long createdTs = MiscUtil.parseTs(o.createdAt);
            if (createdTs == null) continue;
            String k = TimeUtil.dateKeyOf(createdTs);
            if (!keySet.contains(k)) continue;
            amountByDay.merge(k, commission.orderRevenue(o), Double::sum);
            ordersByDay.merge(k, 1, Integer::sum);
        }
        List<Map<String, Object>> trend = new ArrayList<>();
        for (String k : dayKeys) {
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("date", k.substring(5));
            t.put("amount", MiscUtil.r2(amountByDay.getOrDefault(k, 0.0)));
            t.put("orders", ordersByDay.getOrDefault(k, 0));
            trend.add(t);
        }

        // 退货趋势
        Map<String, Integer> returnByDay = new HashMap<>();
        Map<String, Integer> paidByDay = new HashMap<>();
        for (Order o : paidOrders) {
            Long createdTs = MiscUtil.parseTs(o.createdAt);
            if (createdTs == null) continue;
            String k = TimeUtil.dateKeyOf(createdTs);
            paidByDay.merge(k, 1, Integer::sum);
            if (o.returnReq != null && "done".equals(o.returnReq.state)) {
                String rk = k;
                String at = o.returnReq.at;
                if (at != null && !at.isEmpty()) {
                    Long atTs = MiscUtil.parseTs(at);
                    if (atTs == null) continue;
                    rk = TimeUtil.dateKeyOf(atTs);
                }
                returnByDay.merge(rk, 1, Integer::sum);
            }
        }
        List<Map<String, Object>> returnTrend = new ArrayList<>();
        for (String k : dayKeys) {
            double r = (returnByDay.getOrDefault(k, 0) / (double) Math.max(1, paidByDay.getOrDefault(k, 0))) * 100;
            Map<String, Object> t = new LinkedHashMap<>();
            t.put("date", k.substring(5));
            t.put("rate", MiscUtil.r2(r));
            returnTrend.add(t);
        }

        // 柱状/明细
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Product p : products) {
            List<Order> sub = new ArrayList<>();
            for (Order o : paidOrders) {
                if (o.productId == p.id) sub.add(o);
            }
            int viewsP = 0;
            for (ViewSeed v : creatorViews) {
                if (v.productId != p.id) continue;
                if (v.dayKey == null || v.dayKey.compareTo(fromKey) < 0 || v.dayKey.compareTo(todayKey) > 0) continue;
                viewsP += v.count;
            }
            int ret = 0;
            for (Order o : sub) {
                if (o.returnReq != null && "done".equals(o.returnReq.state)) ret++;
            }
            double amount = 0;
            for (Order o : sub) amount += commission.orderRevenue(o);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("productId", p.id);
            row.put("title", p.title);
            row.put("cover", p.cover);
            row.put("views", viewsP);
            row.put("orders", sub.size());
            row.put("conversion", MiscUtil.pct(sub.size(), viewsP));
            row.put("sales", sub.size());
            row.put("returnRate", MiscUtil.pct(ret, sub.size()));
            row.put("commissionRate", commission.commissionRateValue(p.id, days));
            row.put("amount", MiscUtil.r2(amount));
            rows.add(row);
        }

        // 渠道
        Map<String, Double> channelMap = new LinkedHashMap<>();
        for (Order o : paidOrders) {
            channelMap.merge(channelOf(o), commission.orderRevenue(o), Double::sum);
        }
        double chTotal = 0;
        for (double v : channelMap.values()) chTotal += v;
        if (chTotal == 0) chTotal = 1;
        List<Map<String, Object>> channel = new ArrayList<>();
        for (String name : CHANNEL_NAMES) {
            long value = Math.round((channelMap.getOrDefault(name, 0.0) / chTotal) * 100);
            if (value <= 0) continue;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("name", name);
            c.put("value", value);
            channel.add(c);
        }

        List<String> styles = new ArrayList<>();
        for (Product p : products) {
            if (p.styleTags != null) styles.addAll(p.styleTags);
        }
        Integer selfWorkId = products.isEmpty() ? null : Integer.valueOf(products.get(0).workId);
        int dup = commission.poolStyleDuplication(styles, selfWorkId);
        String dupNotice = dup >= 5
                ? "⚠️ 资源池同款风格偏多（重叠≥60% 的池内作品 " + dup + " 件）：触发 -2% 佣金下浮，建议差异化迭代。"
                : dup >= 3
                ? "⚠️ 资源池样式重复度 " + dup + " 件（≥3）：触发 -1% 佣金下浮，注意与热门款拉开差异。"
                : dup > 0
                ? "资源池样式重复度 " + dup + " 件（<3），不影响佣金。"
                : "资源池样式差异化优秀，无重复度扣减。";

        List<Map<String, Object>> productCompare = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("productId", r.get("productId"));
            c.put("title", r.get("title"));
            c.put("cover", r.get("cover"));
            c.put("sales", r.get("sales"));
            c.put("amount", r.get("amount"));
            c.put("returnRate", r.get("returnRate"));
            productCompare.add(c);
        }
        productCompare.sort((a, b) -> Double.compare(num(b.get("amount")), num(a.get("amount"))));
        rows.sort((a, b) -> Double.compare(num(b.get("amount")), num(a.get("amount"))));

        Map<String, Object> range = new LinkedHashMap<>();
        range.put("days", days);
        range.put("from", fromKey);
        range.put("to", todayKey);

        Map<String, Object> kpis = new LinkedHashMap<>();
        long windowCount = products.stream().filter(p -> "onSale".equals(p.status)).count();
        kpis.put("windowCount", windowCount);
        kpis.put("revenue30", revenue30);
        kpis.put("conversion", conversion);
        kpis.put("returnRate", returnRate);
        kpis.put("estCommission", estCommission);
        kpis.put("orders", paidOrders.size());
        kpis.put("views", totalViews);

        Map<String, Object> poolDup = new LinkedHashMap<>();
        poolDup.put("dup", dup);
        poolDup.put("notice", dupNotice);

        List<String> explain = List.of(
                "统计口径：近 " + days + " 天（" + fromKey + " ~ " + todayKey + "），已支付未取消订单；成交额按订单有效收入（退货仅计基础费用/直购不计）",
                "转化率 = 下单 " + paidOrders.size() + " / 浏览 " + totalViews + " = " + MiscUtil.jsNum(conversion)
                        + "%；退货率 = " + returns30.size() + "/" + paidOrders.size() + " = " + MiscUtil.jsNum(returnRate) + "%",
                "渠道金额占比按订单种子的渠道标记聚合（广场推荐/分类/搜索/分享/创作者推荐）");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("range", range);
        out.put("productFilter", productId == null || productId == 0 ? null : productId);
        out.put("kpis", kpis);
        out.put("trend", trend);
        out.put("returnTrend", returnTrend);
        out.put("productCompare", productCompare);
        out.put("channel", channel);
        out.put("rows", rows);
        out.put("poolDup", poolDup);
        out.put("explain", explain);
        return out;
    }

    @Override
    public Map<String, Object> dashboard(int creatorId, int days) {
        return dashboard(creatorId, days, null);
    }

    @Override
    public Map<String, Object> dashboard(int creatorId) {
        return dashboard(creatorId, 30, null);
    }

    /** 图序列接口（等价 seriesData） */
    @Override
    @Transactional(readOnly = true)
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> seriesData(int creatorId, int days, String metric, Integer productId) {
        Map<String, Object> d = dashboard(creatorId, days, productId);
        List<Map<String, Object>> out = new ArrayList<>();
        if ("returnRate".equals(metric)) {
            for (Map<String, Object> r : (List<Map<String, Object>>) d.get("returnTrend")) {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("date", r.get("date"));
                m.put("value", r.get("rate"));
                out.add(m);
            }
            return out;
        }
        for (Map<String, Object> x : (List<Map<String, Object>>) d.get("trend")) {
            Object value = "order".equals(metric) ? x.get("orders") : "amount".equals(metric) ? x.get("amount") : 0;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", x.get("date"));
            m.put("value", value);
            out.add(m);
        }
        return out;
    }

    private static double num(Object v) {
        return v instanceof Number n ? n.doubleValue() : 0;
    }
}
