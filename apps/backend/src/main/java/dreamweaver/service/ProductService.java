package dreamweaver.service;

import dreamweaver.entity.AiDetail;
import dreamweaver.entity.Product;
import dreamweaver.entity.WindowMaterial;
import dreamweaver.entity.Work;
import java.util.Map;

/** 商品业务：由橱窗材料 + 作品组装商品与 AI 详情页。 */
public interface ProductService {

    String defaultManufacturer();

    int defaultProdDays(String category);

    /** 生成商品详情页内容（AI 文案由 Python 服务生成）。 */
    AiDetail buildAiDetail(WindowMaterial window, Work work);

    /** 组装商品实体（**未持久化**，id 由调用方 save 后获得）。 */
    Product buildProduct(WindowMaterial window, Work work);

    /** {@code GET /api/mall/products}：在售商品 + 品类/关键词筛选 + 排序 + 分页。 */
    Map<String, Object> mallProducts(Integer uid, String category, String kw,
                                     String sort, String page, String pageSize);

    /** {@code GET /api/creator/products}：创作者我的全部商品（含未上架 / 下架）。 */
    Map<String, Object> myProducts(int uid, String status, String kw, String page, String pageSize);

    /** {@code GET /api/products/{id}}：商品详情。 */
    Map<String, Object> detail(Integer uid, int id);

    /** 创作者编辑非材料内容 detailEdits。 */
    Map<String, Object> editDetail(int uid, int id, Map<String, Object> body);

    /** 上/下架。 */
    Map<String, Object> shelf(int uid, int id, Map<String, Object> body);

    /** 浏览计数（游客亦可，幂等演示用途）。 */
    Map<String, Object> view(int id);

    /** 收藏 / 取消收藏（原 toggleCollect：重复点赞不重复计数、不重复写收藏；取消幂等）。 */
    Map<String, Object> toggleLike(int uid, int id, boolean like);
}
