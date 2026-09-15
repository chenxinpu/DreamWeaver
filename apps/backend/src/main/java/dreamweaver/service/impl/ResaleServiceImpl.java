package dreamweaver.service.impl;

import dreamweaver.common.Errors;
import dreamweaver.common.MiscUtil;
import dreamweaver.common.TimeUtil;
import dreamweaver.dto.DtoMapper;
import dreamweaver.entity.Order;
import dreamweaver.entity.OrderKind;
import dreamweaver.entity.ResaleListing;
import dreamweaver.entity.ResaleStatus;
import dreamweaver.repository.ResaleListingRepository;
import dreamweaver.service.NotifyService;
import dreamweaver.service.ResaleService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 二手集市业务（SPEC §3.6/§3.7）：退货自动挂单（原价 75%）/ 降价 / 成交结算（8% 仓储物流佣金）。
 *
 * <p>本类取代原二手集市引擎：持久化走 {@link ResaleListingRepository}，通知走
 * {@link NotifyService}；原 {@code ResaleController} 的 {@code toDTO}（原价反推 + netEstimate）
 * 也下沉到本类。所有中文文案与金额计算（{@link MiscUtil#r2}）与原实现逐字一致。
 */
@Service
public class ResaleServiceImpl implements ResaleService {

    public static final double DEFAULT_PLATFORM_FEE_RATE = 0.08;

    private static final Comparator<ResaleListing> CREATED_DESC =
            (a, b) -> str(b.createdAt).compareTo(str(a.createdAt));

    private final ResaleListingRepository resaleRepository;
    private final DtoMapper dto;
    private final NotifyService notifyService;

    public ResaleServiceImpl(ResaleListingRepository resaleRepository, DtoMapper dto,
                             NotifyService notifyService) {
        this.resaleRepository = resaleRepository;
        this.dto = dto;
        this.notifyService = notifyService;
    }

    /* ------------------------------- 出参类型 ------------------------------- */

    /** 成交结果（对应 TS {@code { listing, msg }}）。 */
    private static final class BuyResult {
        ResaleListing listing;
        String msg;
    }

    /* ------------------------------ 集市列表 ------------------------------ */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> mall(String page, String pageSize) {
        List<ResaleListing> list = new ArrayList<>(
                resaleRepository.findByStatusOrderByCreatedAtDesc(ResaleStatus.ACTIVE));
        list.sort(CREATED_DESC);
        return pagedDTOs(list, MiscUtil.toInt(page, 1), MiscUtil.toInt(pageSize, 12));
    }

    /* ------------------------------ 我的挂单 ------------------------------ */

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> mine(int sellerId, String status, String page, String pageSize) {
        String st = status == null || status.isEmpty() ? null : status;

        List<ResaleListing> list;
        if (st == null) {
            list = new ArrayList<>(resaleRepository.findBySellerIdOrderByCreatedAtDesc(sellerId));
        } else {
            ResaleStatus target = parseStatus(st);
            list = target == null ? new ArrayList<>()
                    : new ArrayList<>(
                            resaleRepository.findBySellerIdAndStatusOrderByCreatedAtDesc(sellerId, target));
        }
        list.sort(CREATED_DESC);
        return pagedDTOs(list, MiscUtil.toInt(page, 1), MiscUtil.toInt(pageSize, 12));
    }

    /* ------------------------------ 自动挂单 ------------------------------ */

    /** 定制退货自动创建二手挂单 */
    @Override
    @Transactional
    public ResaleListing createResaleFromReturn(Order order, double originalPrice) {
        String size = order.specUsed == null || order.specUsed.size == null || order.specUsed.size.isEmpty()
                ? "-"
                : order.specUsed.size;
        boolean hasBody = order.specUsed != null && order.specUsed.body != null;

        ResaleListing listing = new ResaleListing();
        listing.orderId = order.id;
        listing.productId = order.productId;
        listing.originalTitle = order.productTitle;
        listing.sellerId = order.buyerId;
        listing.photo = order.cover;
        listing.sizeLabel = (order.kind == OrderKind.CUSTOM ? "私人定制" : "现货") + " · 基码 " + size
                + (hasBody ? "（含体型定制）" : "");
        listing.listPrice = MiscUtil.r2(originalPrice * 0.75); // 默认原价×75%
        listing.originalPrice = MiscUtil.r2(originalPrice);    // 保留原价，供降价后仍展示划线价
        listing.platformFeeRate = DEFAULT_PLATFORM_FEE_RATE;
        listing.status = ResaleStatus.ACTIVE;
        listing.createdAt = TimeUtil.nowIso();
        resaleRepository.save(listing);
        notifyService.notify(order.buyerId, "resale", "🏷️ 二手挂单已自动生成",
                "「" + order.productTitle + "」已按原价 75% 标价 ¥" + MiscUtil.jsNum(MiscUtil.r2(listing.listPrice))
                        + " 挂上二手集市；成交流程自动扣 8% 平台费（仓储物流），余款退还给您。可自行降价提高成交率。",
                "/mall/resale/mine");
        return listing;
    }

    /* -------------------------------- 成交 -------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> buy(int buyerId, int listingId) {
        ResaleListing listing = findListing(listingId);
        // 买家钱包扣款（模拟）
        notifyService.ledger(buyerId, "resale_pay", -listing.listPrice, "RS-" + listing.id);
        BuyResult r = buyResale(listing, buyerId);
        Map<String, Object> out = listingDTO(r.listing);
        out.put("msg", r.msg);
        return out;
    }

    /** 购买二手挂单 */
    private BuyResult buyResale(ResaleListing listing, int buyerId) {
        if (listing.status != ResaleStatus.ACTIVE) throw Errors.bad("RESALE_STATE", "该挂单已下架/成交");
        if (listing.sellerId == buyerId) throw Errors.bad("RESALE_SELF", "不能购买自己挂出的商品");
        String at = TimeUtil.nowIso();
        double listPrice = listing.listPrice;
        double feeCharged = MiscUtil.r2(listPrice * listing.platformFeeRate);
        double netToSeller = MiscUtil.r2(listPrice - feeCharged);
        listing.status = ResaleStatus.SOLD;
        listing.soldTo = buyerId;
        listing.soldAt = at;
        listing.feeCharged = feeCharged;
        listing.netToSeller = netToSeller;
        // 资金：平台收 fee；卖家（原退货人）收 net
        notifyService.ledger(listing.sellerId, "resale_income", netToSeller, "RS-" + listing.id);
        // 平台费率（负向：平台收入使用 admin 用户 99 记账做展示）
        notifyService.ledger(99, "resale_fee", feeCharged, "RSF-" + listing.id);
        notifyService.notify(listing.sellerId, "resale", "🎉 二手商品已成交",
                "「" + listing.originalTitle + "」成交价 ¥" + MiscUtil.jsNum(MiscUtil.r2(listPrice))
                        + "：平台佣金 ¥" + MiscUtil.jsNum(MiscUtil.r2(feeCharged))
                        + "（仓储物流），净得 ¥" + MiscUtil.jsNum(MiscUtil.r2(netToSeller)) + " 已入账。",
                "/mall/resale/mine");
        notifyService.notify(buyerId, "resale", "🛍️ 二手商品购买成功",
                "你以 ¥" + MiscUtil.jsNum(MiscUtil.r2(listPrice)) + " 购买了「" + listing.originalTitle
                        + "」（原价约 ¥" + MiscUtil.jsNum(MiscUtil.r2(listPrice / 0.75))
                        + "，立省 ¥" + MiscUtil.jsNum(MiscUtil.r2(listPrice / 3)) + "）。",
                "/mall/resale");

        BuyResult out = new BuyResult();
        out.listing = listing;
        out.msg = "成交成功：净得 ¥" + MiscUtil.jsNum(MiscUtil.r2(netToSeller)) + "（费率 "
                + Math.round(listing.platformFeeRate * 100) + "%）";
        return out;
    }

    /* -------------------------------- 改价 -------------------------------- */

    @Override
    @Transactional
    public Map<String, Object> changePrice(int sellerId, int listingId, Map<String, Object> body) {
        ResaleListing listing = findListing(listingId);
        if (listing.sellerId != sellerId) throw Errors.deny("只有卖家可改价");
        Map<String, Object> b = body == null ? Map.of() : body;
        double p = jsNumber(b.get("listPrice"));
        if (!Double.isFinite(p) || p <= 0) throw Errors.bad("BAD_PRICE", "请提供有效 listPrice");
        changePrice(listing, p);
        return listingDTO(listing);
    }

    /** 卖家改价：只降不升 */
    private ResaleListing changePrice(ResaleListing listing, double newPrice) {
        if (listing.status != ResaleStatus.ACTIVE) throw Errors.bad("RESALE_STATE", "仅上架中的挂单可改价");
        if (newPrice <= 0) throw Errors.bad("BAD_PRICE", "标价需大于 0");
        if (newPrice > listing.listPrice) throw Errors.bad("RESALE_NO_UP", "二手集市只支持降价（促销吸单）");
        listing.listPrice = MiscUtil.r2(newPrice);
        return listing;
    }

    /* ------------------------------ 取消上架 ------------------------------ */

    @Override
    @Transactional
    public Map<String, Object> cancel(int sellerId, int listingId, Map<String, Object> body) {
        ResaleListing listing = findListing(listingId);
        if (listing.sellerId != sellerId) throw Errors.deny("只有卖家可取消上架");
        Map<String, Object> b = body == null ? Map.of() : body;
        cancelResale(listing, jsOr(b.get("reason"), ""));
        return listingDTO(listing);
    }

    /** 取消上架 */
    private ResaleListing cancelResale(ResaleListing listing, String reason) {
        if (listing.status != ResaleStatus.ACTIVE) throw Errors.bad("RESALE_STATE", "仅上架中的挂单可取消");
        listing.status = ResaleStatus.CANCELLED;
        notifyService.notify(listing.sellerId, "resale", "🗑️ 二手挂单已下架",
                "「" + listing.originalTitle + "」已取消上架"
                        + (reason != null && !reason.isEmpty() ? "：" + reason : "") + "。",
                "/mall/resale/mine");
        return listing;
    }

    /* ------------------------------ 内部工具 ------------------------------ */

    private ResaleListing findListing(int listingId) {
        return resaleRepository.findById(listingId).orElseThrow(() -> Errors.notFound("挂单不存在"));
    }

    private Map<String, Object> pagedDTOs(List<ResaleListing> list, int page, int pageSize) {
        Map<String, Object> paged = MiscUtil.paginate(list, page, pageSize);
        List<?> slice = (List<?>) paged.get("list");
        List<Map<String, Object>> dtos = new ArrayList<>();
        for (Object o : slice) dtos.add(listingDTO((ResaleListing) o));
        paged.put("list", dtos);
        return paged;
    }

    /** 对应原 routes/resale.ts 的 toDTO（原价划线 + 净得估算）。 */
    private Map<String, Object> listingDTO(ResaleListing l) {
        Map<String, Object> m = dto.toMap(l);
        // 原价划线：优先用挂单时记录的原价（降价不改变划线价），旧数据按 75% 反推
        if (m.get("originalPrice") == null) {
            m.put("originalPrice", MiscUtil.r2(l.listPrice / 0.75));
        }
        m.put("netEstimate", MiscUtil.r2(l.listPrice * (1 - l.platformFeeRate)));
        return m;
    }

    /** 严格解析挂单状态；未知值返回 null（等价原实现的 {@code st.equals(r.status.value())}）。 */
    private static ResaleStatus parseStatus(String v) {
        for (ResaleStatus s : ResaleStatus.values()) {
            if (s.value().equals(v)) return s;
        }
        return null;
    }

    private static String str(String s) {
        return s == null ? "" : s;
    }

    /** JS {@code v || dft} 再 {@code String()} */
    private static String jsOr(Object v, String dft) {
        return jsTruthy(v) ? jsStr(v) : dft;
    }

    /** JS {@code Number(v)} */
    private static double jsNumber(Object v) {
        if (v == null) return 0; // Number(null) === 0
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof Boolean b) return b ? 1 : 0;
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) return 0; // Number('') === 0
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return Double.NaN;
        }
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
