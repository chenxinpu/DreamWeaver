package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.MaterialService;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * materials 路由：导入/列表/详情/删除/帮助（对应 apps/server/src/routes/materials.ts）。
 *
 * <p>本控制器只做「取当前用户 → 调 {@link MaterialService} → 包 {@code ApiResponse}」，
 * 过滤/分页/分组/删除校验/解析异常转换等业务规则全部在 service 层。
 */
@RestController
@RequestMapping("/api")
public class MaterialsController {

    private final MaterialService materialService;

    public MaterialsController(MaterialService materialService) {
        this.materialService = materialService;
    }

    /* ------------------------------- 路由 ------------------------------- */

    @GetMapping("/materials/import-help")
    public ApiResponse importHelp() {
        return ApiResponse.ok(materialService.importHelp());
    }

    /** 读取 sample 原文（导入演示/自检用） */
    @GetMapping("/materials/sample-content")
    public ApiResponse sampleContent(@RequestParam(required = false) String file) {
        return ApiResponse.ok(materialService.sampleContent(file));
    }

    @PostMapping("/materials/import")
    public ApiResponse importMaterial(@RequestBody(required = false) Map<String, Object> body) {
        Integer current = RequestContext.currentUserId();
        return ApiResponse.ok(materialService.importMaterial(current, body));
    }

    @GetMapping("/materials")
    public ApiResponse list(@RequestParam(required = false) String mine,
                            @RequestParam(required = false) String kind,
                            @RequestParam(required = false) String kw,
                            @RequestParam(required = false) String userId,
                            @RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(materialService.list(RequestContext.requireUserId(),
                mine, kind, kw, userId, page, pageSize));
    }

    @GetMapping("/materials/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        return ApiResponse.ok(materialService.detail(id));
    }

    @DeleteMapping("/materials/{id}")
    public ApiResponse remove(@PathVariable("id") long id) {
        return ApiResponse.ok(materialService.remove(RequestContext.currentUserId(), id));
    }
}
