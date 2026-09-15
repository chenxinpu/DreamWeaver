package dreamweaver.service;

import dreamweaver.entity.Product;
import dreamweaver.entity.WindowMaterial;
import java.util.List;
import java.util.Map;

/** 橱窗材料业务：完整性审核 → 通过即生成商品并上架。 */
public interface WindowService {

    /** 完整性检查结果。 */
    class Completeness {
        public boolean pass;
        public List<String> missing;
    }

    /** 审核结果。 */
    class AuditResult {
        public boolean pass;
        public List<String> missing;
        public Product product;
        public String note;
    }

    Completeness checkCompleteness(WindowMaterial window);

    AuditResult auditWindow(WindowMaterial window);

    AuditResult submitAndAudit(WindowMaterial window);

    /** 我的橱窗材料列表（可按状态过滤，按 updatedAt 倒序）。 */
    Map<String, Object> list(int uid, String status);

    /** 橱窗材料详情（创作者本人 / 审核员 / 管理员）。 */
    Map<String, Object> detail(int uid, int id);

    /** 新建橱窗材料（action=submit 时当场审核）。 */
    Map<String, Object> create(int uid, Map<String, Object> body);

    /** 草稿更新 / 被拒后修改重提。 */
    Map<String, Object> update(int uid, int id, Map<String, Object> body);

    /** 提交审核。 */
    Map<String, Object> submit(int uid, int id);

    /** 删除橱窗材料（仅草稿 / 被拒状态可删；审核中、已通过需先处理关联商品）。 */
    Map<String, Object> remove(int uid, int id);
}
