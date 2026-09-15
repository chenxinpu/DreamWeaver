package dreamweaver.controller.bff;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.BffQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * BFF 聚合层入口：{@code /api/bff/*}（<b>薄控制层</b>）。
 *
 * <p>聚合逻辑全部在 service 层 {@link BffQueryService}：本类只做「解析入参 + 取当前登录用户 + 调 service」，
 * 不注入任何 repository、不调用任何其它 controller、不做字段裁剪或业务判断。
 *
 * <p>统一响应形状（{@code bff} 在<b>顶层</b>）：
 * {@code {ok:true, data:{…}, bff:{computedAt, upstreams:[{name,ok,latencyMs}], degraded:[]}}}；
 * 自述端点 {@code GET /api/bff} 例外（{@code {ok:true,data:{…}}}）。
 *
 * <p>鉴权：{@link RequestContext#currentUserId()} 为 null 表示游客；需要登录的块在游客时置 null
 * 且不计入 {@code degraded}（「未登录」不是故障），并通过 {@code data.viewer.loggedIn} 表达。
 */
@RestController
@RequestMapping("/api/bff")
public class BffController {

    private final BffQueryService bffQueryService;

    public BffController(BffQueryService bffQueryService) {
        this.bffQueryService = bffQueryService;
    }

    /** 端点清单（自述）。 */
    @GetMapping({"", "/"})
    public ApiResponse index() {
        return ApiResponse.ok(bffQueryService.index());
    }

    /** 消费者首页：feed + 达人/精选 + poolMeta + 未读通知 + me。 */
    @GetMapping("/home")
    public BffQueryService.Envelope home(@RequestParam(required = false) String tab,
                                         @RequestParam(required = false) String page,
                                         @RequestParam(required = false) String pageSize) {
        return bffQueryService.home(RequestContext.currentUserId(), tab, page, pageSize);
    }

    /** 商城首页：商品第一页 + 分类聚合 + 二手精选。 */
    @GetMapping("/mall/home")
    public BffQueryService.Envelope mallHome(@RequestParam(required = false) String page,
                                             @RequestParam(required = false) String pageSize,
                                             @RequestParam(required = false) String category,
                                             @RequestParam(required = false) String sort,
                                             @RequestParam(required = false) String resalePageSize) {
        return bffQueryService.mallHome(RequestContext.currentUserId(), page, pageSize, resalePageSize, category, sort);
    }

    /** 商品详情：商品 + 创作者 + 定制上下文 + 收藏态。 */
    @GetMapping("/product/{id}")
    public BffQueryService.Envelope product(@PathVariable("id") String id) {
        return bffQueryService.product(RequestContext.currentUserId(), id);
    }

    /** 创作者工作台：overview + 待办池 + 草稿橱窗 + 未读通知。 */
    @GetMapping("/creator/workbench")
    public BffQueryService.Envelope creatorWorkbench(@RequestParam(required = false) String poolLimit) {
        return bffQueryService.creatorWorkbench(RequestContext.currentUserId(), poolLimit);
    }

    /** 订单详情：订单 + 关联商品 + 阶段/物流标准化 + can。 */
    @GetMapping("/order/{id}")
    public BffQueryService.Envelope order(@PathVariable("id") String id) {
        return bffQueryService.order(RequestContext.currentUserId(), id);
    }

    /** 我的页：me + 最近订单 + 通知/作品数 + stats。 */
    @GetMapping("/me")
    public BffQueryService.Envelope me(@RequestParam(required = false) String orderLimit,
                                       @RequestParam(required = false) String notificationLimit) {
        return bffQueryService.me(RequestContext.currentUserId(), orderLimit, notificationLimit);
    }
}
