package dreamweaver.service;

import dreamweaver.entity.PoolEvalResult;
import java.util.Map;

/** 资源池业务：当日点赞 P60 分位筛选 + 增量/定时评估。 */
public interface PoolService {

    /** 评估指定日期（null = 今天）的全平台推文，返回新增入池明细。 */
    PoolEvalResult evalPool(String dateKey);

    /** 引擎说明（/pool/meta）。 */
    Map<String, Object> poolMeta();

    /**
     * 当前创作者池（{@code GET /api/creator/pool}）：筛选 + qualifiedAt 倒序 + 手写 slice 分页
     * （复刻原 JS 的 slice 语义）。
     */
    Map<String, Object> creatorPool(int creatorId, String page, String pageSize);

    /** 手动触发当日评估并返回 DTO 化响应（{@code POST /api/dev/eval-pool}）。 */
    Map<String, Object> evalPoolResponse(Integer viewerId);
}
