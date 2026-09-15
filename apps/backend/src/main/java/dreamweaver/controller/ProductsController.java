package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.ProductService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * products 商城路由：列表/详情/详情编辑/上下架/浏览/收藏
 * —— 对应原 {@code apps/server/src/routes/products.ts}。
 *
 * <p>只做参数解析 + 调 service + 包 {@link ApiResponse}；排序/筛选/分页/收藏 toggle/上下架判断
 * 全部在 {@code service.impl.ProductServiceImpl}。
 */
@RestController
@RequestMapping("/api")
public class ProductsController {

    private final ProductService productService;

    public ProductsController(ProductService productService) {
        this.productService = productService;
    }

    /* --------------------------------- 商城 --------------------------------- */

    @GetMapping("/mall/products")
    public ApiResponse mallProducts(@RequestParam(required = false) String category,
                                    @RequestParam(required = false) String kw,
                                    @RequestParam(required = false) String sort,
                                    @RequestParam(required = false) String page,
                                    @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(productService.mallProducts(
                RequestContext.currentUserId(), category, kw, sort, page, pageSize));
    }

    /** 创作者：我的全部商品（含未上架 / 下架），供商品管理/BI 使用。 */
    @GetMapping("/creator/products")
    public ApiResponse myProducts(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String kw,
                                  @RequestParam(required = false) String page,
                                  @RequestParam(required = false) String pageSize) {
        return ApiResponse.ok(productService.myProducts(
                RequestContext.requireUserId(), status, kw, page, pageSize));
    }

    @GetMapping("/products/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        return ApiResponse.ok(productService.detail(RequestContext.currentUserId(), (int) id));
    }

    /* ------------------------------- 商品管理 ------------------------------- */

    /** 创作者编辑非材料内容 detailEdits。 */
    @PostMapping("/creator/products/{id}/edit-detail")
    public ApiResponse editDetail(@PathVariable("id") long id,
                                 @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(productService.editDetail(RequestContext.requireUserId(), (int) id, body));
    }

    /** 上/下架。 */
    @PatchMapping("/creator/products/{id}/shelf")
    public ApiResponse shelf(@PathVariable("id") long id,
                             @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.ok(productService.shelf(RequestContext.requireUserId(), (int) id, body));
    }

    /* ------------------------------- 浏览/收藏 ------------------------------- */

    /** 浏览计数（游客亦可，幂等演示用途）。 */
    @PostMapping("/products/{id}/view")
    public ApiResponse view(@PathVariable("id") long id) {
        return ApiResponse.ok(productService.view((int) id));
    }

    /** 收藏（预留给「我的·收藏」）。 */
    @PostMapping("/products/{id}/like")
    public ApiResponse like(@PathVariable("id") long id) {
        return ApiResponse.ok(productService.toggleLike(RequestContext.requireUserId(), (int) id, true));
    }

    @PostMapping("/products/{id}/unlike")
    public ApiResponse unlike(@PathVariable("id") long id) {
        return ApiResponse.ok(productService.toggleLike(RequestContext.requireUserId(), (int) id, false));
    }
}
