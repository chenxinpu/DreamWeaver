package dreamweaver.service;

import java.util.List;
import java.util.Map;

/**
 * 变现数据看板业务（SPEC §3.9，桌面 BI 规范）：
 * KPI 卡 + 折线(成交额&订单量) + 柱状(商品销量) + 退货趋势 + 渠道饼图 + 明细表。
 *
 * <p>由改造前内存库版的看板聚合引擎（已删除）平移而来。
 */
public interface DashboardService {

    /** 看板聚合（{@code productId} 为空/0 表示全部商品）。 */
    Map<String, Object> dashboard(int creatorId, int days, Integer productId);

    Map<String, Object> dashboard(int creatorId, int days);

    Map<String, Object> dashboard(int creatorId);

    /** 图序列接口（等价 {@code seriesData}），{@code metric} ∈ amount|order|returnRate。 */
    List<Map<String, Object>> seriesData(int creatorId, int days, String metric, Integer productId);
}
