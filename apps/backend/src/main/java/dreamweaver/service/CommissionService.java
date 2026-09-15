package dreamweaver.service;

import dreamweaver.entity.CommissionRule;
import dreamweaver.entity.LedgerEvent;
import dreamweaver.entity.Order;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** 佣金业务。 */
public interface CommissionService {

    /** 结算到期佣金（T+7，幂等），返回结算笔数。 */
    int settleDueCommissions();

    /** 佣金汇总（等价 TS 的 CommissionSummary）。 */
    final class Summary {
        public double withdrawable;
        public double pending;
        public double settled;
        public double estimatedTotal;
        public List<LedgerEvent> ledger = new ArrayList<>();
        public List<CommissionRule> rules = new ArrayList<>();
    }

    /** 佣金汇总。 */
    Summary summary(int creatorId);

    /** 单品佣金率（含逐条 breaks/reasons）。 */
    Map<String, Object> commissionRateForProduct(int productId);

    /** 单品佣金率数值（%）。 */
    double commissionRateValue(int productId, int days);

    /** 订单对创作者的有效收入（退货/取消后剩余）。 */
    double orderRevenue(Order o);

    /** 资源池样式重复度：与其同 styleTags 重叠度≥60% 的池内其他作品数。 */
    int poolStyleDuplication(List<String> styleTags, Integer selfWorkId);

    /** 提现。 */
    Map<String, Object> withdraw(int creatorId, double amount);
}
