package dreamweaver.controller;

import dreamweaver.common.ApiResponse;
import dreamweaver.common.RequestContext;
import dreamweaver.service.AftercareService;
import dreamweaver.service.OrderService;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * orders 路由：创建/支付/我的订单/详情/推进/售后
 * （对应 {@code apps/server/src/routes/orders.ts}）。
 *
 * <p>控制层只做「取当前用户 → 调 service → 包 {@code ApiResponse}」；权限判断、状态过滤、分页、
 * 统计（seller/mine 的 stats）、adapt 透传等全部在 service 层。
 *
 * <p>注入 {@link OrderService} 契约（下单/支付/列表/详情/推进/收货 + 调度器的 autoCompleteReceived）。
 */
@RestController
@RequestMapping("/api")
public class OrdersController {

    private final OrderService orderService;
    private final AftercareService aftercareService;

    public OrdersController(OrderService orderService, AftercareService aftercareService) {
        this.orderService = orderService;
        this.aftercareService = aftercareService;
    }

    /* ------------------------------ 创建订单 ------------------------------ */

    @PostMapping("/orders")
    public ApiResponse create(@RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.create(uid, body));
    }

    /* -------------------------------- 支付 -------------------------------- */

    @PostMapping("/orders/{id}/pay")
    public ApiResponse pay(@PathVariable("id") long id) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.pay(uid, (int) id));
    }

    /* ------------------------------ 我的订单 ------------------------------ */

    @GetMapping("/orders/mine")
    public ApiResponse mine(@RequestParam(required = false) String status,
                            @RequestParam(required = false) String page,
                            @RequestParam(required = false) String pageSize) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.mine(uid, status, page, pageSize));
    }

    /* ---------------------------- 创作者视角订单 ---------------------------- */

    @GetMapping("/orders/seller/mine")
    public ApiResponse sellerMine(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String productId,
                                  @RequestParam(required = false) String page,
                                  @RequestParam(required = false) String pageSize) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.sellerMine(uid, status, productId, page, pageSize));
    }

    /* ------------------------------ 订单详情 ------------------------------ */

    @GetMapping("/orders/{id}")
    public ApiResponse detail(@PathVariable("id") long id) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.detail(uid, (int) id));
    }

    /* ------------------------------ 演示推进 ------------------------------ */

    @PostMapping("/orders/{id}/dev-advance")
    public ApiResponse devAdvance(@PathVariable("id") long id) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.devAdvance(uid, (int) id));
    }

    /* -------------------------------- 退货 -------------------------------- */

    @PostMapping("/orders/{id}/return")
    public ApiResponse returnOrder(@PathVariable("id") long id,
                                   @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(aftercareService.returnOrder(uid, (int) id, body));
    }

    /* ------------------------------ 换货重做 ------------------------------ */

    @PostMapping("/orders/{id}/exchange")
    public ApiResponse exchange(@PathVariable("id") long id,
                                @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(aftercareService.exchange(uid, (int) id, body));
    }

    /* -------------------------------- 取消 -------------------------------- */

    @PostMapping("/orders/{id}/cancel")
    public ApiResponse cancel(@PathVariable("id") long id,
                              @RequestBody(required = false) Map<String, Object> body) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(aftercareService.cancel(uid, (int) id, body));
    }

    /* ------------------------------ 确认收货 ------------------------------ */

    @PostMapping("/orders/{id}/confirm-received")
    public ApiResponse confirmReceived(@PathVariable("id") long id) {
        int uid = RequestContext.requireUserId();
        return ApiResponse.ok(orderService.confirmReceived(uid, (int) id));
    }
}
