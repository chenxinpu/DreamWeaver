package dreamweaver.service;

import dreamweaver.entity.Material;
import dreamweaver.parser.SamplesProvider;
import java.util.Map;

/**
 * 素材业务域：导入帮助 / 示例原文 / 导入解析入库 / 列表 / 详情 / 删除
 * （对应原 {@code apps/server/src/routes/materials.ts} 与改造前的 {@code MaterialsController}）。
 *
 * <p>本层承载全部业务规则（过滤 / 分页 / 分组 / 删除校验 / 解析异常转换），
 * 返回普通对象，由 controller 包 {@code ApiResponse}。
 */
public interface MaterialService {

    /**
     * 导入帮助：格式清单 + samples 文件清单 + samplePath
     * （对应 {@code GET /api/materials/import-help}）。
     */
    Map<String, Object> importHelp();

    /**
     * 读取示例原文（对应 {@code GET /api/materials/sample-content?file=}）。
     * 文件不存在时抛 {@code Errors.bad("NOT_FOUND","示例文件不存在")}（400）。
     */
    SamplesProvider.SampleContent sampleContent(String file);

    /**
     * 解析并入库素材（对应 {@code POST /api/materials/import}）。
     *
     * @param currentUserId 当前登录用户（未登录为 {@code null} → {@code Errors.deny()}）
     * @param body          原始请求体（可为 {@code null}）
     */
    Material importMaterial(Integer currentUserId, Map<String, Object> body);

    /**
     * 素材列表（对应 {@code GET /api/materials}）：mine/kind/kw/userId 过滤 +
     * 创建时间倒序 + 分页（默认 20）+ 按 kind 分组计数。
     */
    Map<String, Object> list(int currentUserId, String mine, String kind, String kw,
                             String userId, String page, String pageSize);

    /** 素材详情（对应 {@code GET /api/materials/{id}}）；不存在抛 404。 */
    Material detail(long id);

    /**
     * 删除素材（对应 {@code DELETE /api/materials/{id}}）：只能删自己的，
     * 被作品/橱窗材料引用时抛 {@code MATERIAL_IN_USE}。
     */
    Map<String, Object> remove(Integer currentUserId, long id);
}
