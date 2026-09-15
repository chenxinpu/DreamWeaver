package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.entity.CommissionRule;
import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderKind;
import dreamweaver.entity.OrderStatus;
import dreamweaver.entity.PoolEntry;
import dreamweaver.entity.Product;
import dreamweaver.entity.ViewSeed;
import dreamweaver.entity.Work;
import dreamweaver.repository.CommissionRuleRepository;
import dreamweaver.repository.LedgerEventRepository;
import dreamweaver.repository.OrderRepository;
import dreamweaver.repository.PoolEntryRepository;
import dreamweaver.repository.ProductRepository;
import dreamweaver.repository.ViewSeedRepository;
import dreamweaver.repository.WorkRepository;
import dreamweaver.service.CommissionService;
import dreamweaver.service.NotifyService;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 佣金 KPI 引擎（SPEC §3.8），逐行等价于 {@code apps/server/src/engine/commission.ts}：
 *
 * <ul>
 *   <li>基础 6%；上浮：单品近30天转化率≥8% 且 销量≥10 → +2（封顶 10）</li>
 *   <li>下浮：近30天退货率&gt;6% → −1.5/档（&gt;10% 再 −1.5）；资源池样式重复度(≥60%重叠) ≥3 → −1，≥5 → −2</li>
 *   <li>结算：已支付有效订单在收货 T+7 自动写 LedgerEvent（幂等）；结算演示即展示预估/已结算/可提现</li>
 * </ul>
 *
 * <p>改造说明：原内存库版佣金引擎改为本实现，全部数据经 repository 读写；
 * 手工 id 计数器与脏标记保存全部删除，主键由数据库生成。
 */
@Service
public class CommissionServiceImpl implements CommissionService {

    /** 基础佣金（%） */
    public static final double BASE_RATE = 6;

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final ViewSeedRepository viewSeedRepository;
    private final PoolEntryRepository poolEntryRepository;
    private final WorkRepository workRepository;
    private final LedgerEventRepository ledgerEventRepository;
    private final CommissionRuleRepository commissionRuleRepository;
    private final NotifyService notify;

    public CommissionServiceImpl(OrderRepository orderRepository,
                                 ProductRepository productRepository,
                                 ViewSeedRepository viewSeedRepository,
                                 PoolEntryRepository poolEntryRepository,
                                 WorkRepository workRepository,
                                 LedgerEventRepository ledgerEventRepository,
                                 CommissionRuleRepository commissionRuleRepository,
                                 NotifyService notify) {
        this.orderRepository = orderRepository;
        this.productRepository = productRepository;
        this.viewSeedRepository = viewSeedRepository;
        this.poolEntryRepository = poolEntryRepository;
        this.workRepository = workRepository;
        this.ledgerEventRepository = ledgerEventRepository;
        this.commissionRuleRepository = commissionRuleRepository;
        this.notify = notify;
    }

    /* ------------------------------ KPI ------------------------------ */

    /** 某个商品近 N 天 KPI（views/paid/sales/returns/退货率/转化率） */
    public static final class ProductKpi {
        public int productId;
        public int views;
        /** 近N天下单且已支付（未取消） */
        public int paid;
        /** 有效成交（收货/已完成）——转化口径用 paid */
        public int sales;
        public int returns;
        public double conversionRate;
        public double returnRate;
    }

    /** 某个商品近 N 天 KPI */
    @Transactional(readOnly = true)
    public ProductKpi productKpi(int productId, int days) {
        long now = System.currentTimeMillis();
        long fromTs = TimeUtil.startOfDayKey(TimeUtil.dateKeyNow()) - (long) days * TimeUtil.DAY_MS;
        String fromKey = TimeUtil.dateKeyOf(fromTs);

        ProductKpi k = new ProductKpi();
        k.productId = productId;

        // 商品缺失时退化为全表扫描（防御分支，正常调用不会走到：佣金率入口已先校验商品存在）
        Product product = productRepository.findById(productId).orElse(null);
        List<ViewSeed> views = product == null
                ? viewSeedRepository.findAll()
                : viewSeedRepository.findByCreatorId(product.creatorId);
        List<Order> orders = product == null
                ? orderRepository.findAllByOrderByCreatedAtDesc()
                : orderRepository.findByCreatorIdAndProductIdOrderByCreatedAtDesc(product.creatorId, productId);

        for (ViewSeed v : views) {
            if (v.productId != productId) continue;
            if (v.dayKey == null || v.dayKey.compareTo(fromKey) < 0) continue;
            k.views += v.count;
        }

        for (Order o : orders) {
            if (o.productId != productId) continue;
            Long createdTs = MiscUtil.parseTs(o.createdAt);
            if (createdTs != null && (createdTs < fromTs || createdTs > now)) continue;
            if (o.status == OrderStatus.CANCELLED) continue;
            if (o.status != OrderStatus.CREATED) k.paid++;
            if (o.returnReq != null && "done".equals(o.returnReq.state)) k.returns++;
        }

        k.sales = k.paid;
        k.conversionRate = MiscUtil.pct(k.paid, k.views);
        k.returnRate = MiscUtil.pct(k.returns, k.paid);
        return k;
    }

    public ProductKpi productKpi(int productId) {
        return productKpi(productId, 30);
    }

    /** 与 TS {@code productKpis()} 的返回对象同形（供外部/调试使用） */
    @Transactional(readOnly = true)
    public Map<String, Object> productKpis(int productId, int days) {
        ProductKpi k = productKpi(productId, days);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("productId", k.productId);
        m.put("views", k.views);
        m.put("paid", k.paid);
        m.put("sales", k.sales);
        m.put("returns", k.returns);
        m.put("conversionRate", k.conversionRate);
        m.put("returnRate", k.returnRate);
        return m;
    }

    public Map<String, Object> productKpis(int productId) {
        return productKpis(productId, 30);
    }

    /* --------------------------- 资源池重复度 --------------------------- */

    /** 资源池样式重复度：与其同 styleTags 重叠度≥60% 的池内其他作品数 */
    @Override
    @Transactional(readOnly = true)
    public int poolStyleDuplication(List<String> styleTags, Integer selfWorkId) {
        Set<String> tagSet = new HashSet<>();
        if (styleTags != null) tagSet.addAll(styleTags);
        if (tagSet.isEmpty()) return 0;
        int cnt = 0;
        Set<Integer> seen = new HashSet<>();
        for (PoolEntry e : poolEntryRepository.findAll()) {
            Integer workId = e.workId;
            if (workId == null || workId == 0) continue;
            if (selfWorkId != null && workId.intValue() == selfWorkId.intValue()) continue;
            if (seen.contains(workId)) continue;
            Work w = workRepository.findById(workId).orElse(null);
            if (w == null) continue;
            List<String> tags = new ArrayList<>();
            if (w.styleTags != null) tags.addAll(w.styleTags);
            int overlap = 0;
            for (String t : tags) {
                if (tagSet.contains(t)) overlap++;
            }
            double ratio = overlap / (double) Math.max(1, tagSet.size());
            if (ratio >= 0.6) {
                cnt++;
                seen.add(workId);
            }
        }
        return cnt;
    }

    /* ---------------------------- 佣金率 ---------------------------- */

    /** 单品佣金率（含逐条 breaks/reasons） */
    @Transactional(readOnly = true)
    public Map<String, Object> commissionRateForProduct(int productId, int days) {
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null) throw Errors.notFound("商品不存在");

        ProductKpi kpi = productKpi(productId, days);
        int dup = poolStyleDuplication(product.styleTags, product.workId);

        List<Map<String, Object>> breaks = new ArrayList<>();
        List<String> reasons = new ArrayList<>();
        double rate = BASE_RATE;
        breaks.add(rateBreak("基础佣金", BASE_RATE));
        reasons.add("所有已支付有效订单均按基础 6% 起步");

        if (kpi.conversionRate >= 8 && kpi.sales >= 10) {
            breaks.add(rateBreak("近30天转化率 " + MiscUtil.jsNum(kpi.conversionRate) + "% ≥8% 且销量 " + kpi.sales + " ≥10", 2));
            rate += 2;
            reasons.add("单品近30天转化率 " + MiscUtil.jsNum(kpi.conversionRate) + "%（≥8%）且销量 " + kpi.sales + "（≥10）→ +2 上浮");
        } else {
            reasons.add("转化率 " + MiscUtil.jsNum(kpi.conversionRate) + "% 或销量 " + kpi.sales + " 未达上浮线（需 ≥8% 且 ≥10）");
        }
        if (kpi.returnRate > 6) {
            double step = kpi.returnRate > 10 ? 2 : 1;
            breaks.add(rateBreak("近30天退货率 " + MiscUtil.jsNum(kpi.returnRate) + "% >6%"
                    + (step > 1 ? "（且>10%再降一档）" : ""), -1.5 * step));
            rate -= 1.5 * step;
            reasons.add("退货率 " + MiscUtil.jsNum(kpi.returnRate) + "% > 6% → -" + MiscUtil.jsNum(1.5 * step) + " 下浮"
                    + (step > 1 ? "（超过 10% 触发两档）" : ""));
        }
        if (dup >= 5) {
            breaks.add(rateBreak("资源池同款风格 ≥5 件（重叠度≥60% 共 " + dup + " 件）", -2));
            rate -= 2;
            reasons.add("资源池样式重复度：重叠度≥60% 的其他作品 " + dup + " 件（≥5）→ -2 下浮，激励差异化原创");
        } else if (dup >= 3) {
            breaks.add(rateBreak("资源池同款风格 ≥3 件（重叠度≥60% 共 " + dup + " 件）", -1));
            rate -= 1;
            reasons.add("资源池样式重复度：重叠度≥60% 的其他作品 " + dup + " 件（≥3）→ -1 下浮");
        } else if (dup > 0) {
            reasons.add("资源池重复度 " + dup + " 件 <3，未触发下浮");
        } else {
            reasons.add("资源池样式重复度为 0，差异化优秀");
        }
        rate = Math.max(2, Math.min(10, rate));

        StringBuilder deltas = new StringBuilder();
        for (int i = 0; i < breaks.size(); i++) {
            if (i > 0) deltas.append(' ');
            double delta = ((Number) breaks.get(i).get("delta")).doubleValue();
            deltas.append(delta > 0 ? "+" + MiscUtil.jsNum(delta) : MiscUtil.jsNum(delta));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("productId", productId);
        out.put("rate", rate);
        out.put("base", BASE_RATE);
        out.put("breaks", breaks);
        out.put("reasons", reasons);
        out.put("explain", "佣金 = max(2%, min(10%, 6% " + deltas + ")) = " + MiscUtil.jsNum(rate) + "%（基础 6%，KPI 浮动区间 2%-10%）");
        return out;
    }

    @Override
    public Map<String, Object> commissionRateForProduct(int productId) {
        return commissionRateForProduct(productId, 30);
    }

    /** 冻结签名别名：单品佣金率（等价 commissionRateForProduct） */
    public Map<String, Object> commissionRate(int productId) {
        return commissionRateForProduct(productId, 30);
    }

    /** 单品佣金率数值（%） */
    @Override
    @Transactional(readOnly = true)
    public double commissionRateValue(int productId, int days) {
        Object r = commissionRateForProduct(productId, days).get("rate");
        return r instanceof Number n ? n.doubleValue() : 0;
    }

    public double commissionRateValue(int productId) {
        return commissionRateValue(productId, 30);
    }

    /* --------------------------- 订单收入口径 --------------------------- */

    /** 订单对创作者的有效收入（退货/取消后剩余） */
    @Override
    public double orderRevenue(Order o) {
        if (o.status == OrderStatus.CANCELLED) return 0;
        if (o.returnReq != null && "done".equals(o.returnReq.state)) {
            // 定制退货留 baseFee；direct 质量退货全退
            return o.kind == OrderKind.CUSTOM ? o.amounts.baseFee : 0;
        }
        return o.amounts.total;
    }

    @Transactional(readOnly = true)
    public boolean orderSettled(Order o) {
        return ledgerEventRepository.findByUserIdOrderByIdAsc(o.creatorId).stream()
                .anyMatch(l -> "commission_settle".equals(l.kind) && Objects.equals(l.refNo, o.no));
    }

    @Transactional(readOnly = true)
    public boolean orderSettleDue(Order o) {
        if (o.status == OrderStatus.CANCELLED || o.status == OrderStatus.CREATED) return false;
        double rev = orderRevenue(o);
        if (rev <= 0) return false;
        if (o.status == OrderStatus.RECEIVED || o.status == OrderStatus.COMPLETED) {
            String baseIso = (o.receivedAt == null || o.receivedAt.isEmpty()) ? o.createdAt : o.receivedAt;
            Long baseTs = MiscUtil.parseTs(baseIso);
            if (baseTs == null) return false;
            return baseTs + 7 * TimeUtil.DAY_MS <= System.currentTimeMillis();
        }
        // 生产/质检/运输中的订单：按已支付且在途估算（演示：收货满 T+7 才真正结算）
        return false;
    }

    /** 结算所有到期订单（幂等；调度器/接口触发） */
    @Override
    @Transactional
    public int settleDueCommissions() {
        int n = 0;
        for (Order o : orderRepository.findAllByOrderByCreatedAtDesc()) {
            if (orderSettled(o)) continue;
            if (!orderSettleDue(o)) continue;
            double rate = commissionRateValue(o.productId) / 100;
            double gross = MiscUtil.r2(orderRevenue(o) * rate);
            if (gross <= 0) continue;
            notify.ledger(o.creatorId, "commission_settle", gross, o.no);
            n++;
        }
        return n;
    }

    /* ---------------------------- 佣金汇总 ---------------------------- */

    @Override
    @Transactional(readOnly = true)
    public Summary summary(int creatorId) {
        double settled = 0;
        double withdrawn = 0;
        Summary s = new Summary();
        List<LedgerEvent> mine = ledgerEventRepository.findByUserIdOrderByIdAsc(creatorId);
        for (LedgerEvent l : mine) {
            s.ledger.add(l);
        }
        Collections.reverse(s.ledger);
        for (LedgerEvent l : mine) {
            if ("commission_settle".equals(l.kind)) settled += l.amount;
            if ("withdraw".equals(l.kind)) withdrawn += Math.abs(l.amount);
        }
        // 预估：已支付未到期订单（收货未满 T+7 / 在途）
        double pending = 0;
        for (Order o : orderRepository.findByCreatorIdOrderByCreatedAtDesc(creatorId)) {
            if (o.status == OrderStatus.CANCELLED || o.status == OrderStatus.CREATED) continue;
            if (orderSettled(o)) continue;
            double rev = orderRevenue(o);
            if (rev <= 0) continue;
            double rate = commissionRateValue(o.productId) / 100;
            pending += rev * rate;
        }
        pending = MiscUtil.r2(pending);
        s.pending = pending;
        s.withdrawable = MiscUtil.r2(settled - withdrawn);
        s.settled = MiscUtil.r2(settled);
        s.estimatedTotal = MiscUtil.r2(settled + pending);
        for (CommissionRule r : commissionRuleRepository.findByActiveTrueOrderByIdAsc()) {
            s.rules.add(r);
        }
        return s;
    }

    /** 与 TS {@code commissionSummary()} 的返回对象同形 */
    @Transactional(readOnly = true)
    public Map<String, Object> commissionSummary(int creatorId) {
        Summary s = summary(creatorId);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("withdrawable", s.withdrawable);
        m.put("pending", s.pending);
        m.put("settled", s.settled);
        m.put("estimatedTotal", s.estimatedTotal);
        m.put("ledger", s.ledger);
        m.put("rules", s.rules);
        return m;
    }

    /** 冻结签名别名：创作者佣金数据（等价 commissionSummary） */
    public Map<String, Object> commissionData(int uid) {
        return commissionSummary(uid);
    }

    /* ----------------------------- 提现 ----------------------------- */

    /** 提现 */
    @Override
    @Transactional
    public Map<String, Object> withdraw(int creatorId, double amount) {
        Summary sum = summary(creatorId);
        if (amount <= 0) throw Errors.bad("BAD_AMOUNT", "提现金额需大于 0");
        if (amount > sum.withdrawable) {
            throw Errors.bad("NO_BALANCE", "可提现余额不足（可提现 ¥" + MiscUtil.jsNum(sum.withdrawable) + "）");
        }
        String raw = TimeUtil.nowIso().replace("-", "").replace(":", "").replace("T", "");
        String refNo = "WD-" + raw.substring(2, Math.min(14, raw.length()));
        LedgerEvent ev = notify.ledger(creatorId, "withdraw", -amount, refNo);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("amount", amount);
        out.put("balance", ev.balance);
        return out;
    }

    /* ----------------------------- 内部工具 ----------------------------- */

    private static Map<String, Object> rateBreak(String name, double delta) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("delta", delta);
        return m;
    }
}
