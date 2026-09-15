package dreamweaver.service;

import java.util.Map;

/**
 * BFF 聚合业务：为前端页面量身定制地把多个业务域聚合成一个响应。
 *
 * <p><b>分层定位</b>：BFF 聚合逻辑属于 <b>service 层</b>。改造前它散落在
 * {@code controller.bff.*}（{@code BffSupport}/{@code HomeBff}/…）并存在 controller→controller 调用；
 * 现在统一收敛到本接口的实现类，由 {@code controller.bff.BffController} 变薄后调用。
 * 本层可以注入 repository、{@code DtoMapper}、其它业务 service，但<b>绝不调用任何 controller</b>。
 *
 * <p>统一响应形状（与 apps/gateway/README.md §4.1 一致，<b>一字不变</b>）：
 * {@code {ok:true, data:{…}, bff:{computedAt, upstreams:[{name,ok,latencyMs}], degraded:[]}}}，
 * {@code bff} 在<b>顶层</b>。
 *
 * <p>鉴权：{@code viewerId} 为 null 表示游客；需要登录的块在游客时值为 null 且
 * <b>不计入 {@code degraded}</b>（「未登录」不是故障），并通过 {@code data.viewer.loggedIn} 表达。
 */
public interface BffQueryService {

    /**
     * BFF 统一信封：{@code {ok:true, data:{…}, bff:{…}}}，{@code bff} 放在<b>顶层</b>。
     *
     * <p>注：{@code common.ApiResponse} 只有 {@code ok/data/code/msg} 四个字段，无法表达顶层 {@code bff}，
     * 且该文件不在本次可改范围内，故此处单独定义信封（成功语义与 {@code ApiResponse.ok} 等价）。
     */
    record Envelope(boolean ok, Object data, Object bff) {

        public static Envelope of(Object data, Map<String, Object> bff) {
            return new Envelope(true, data, bff);
        }
    }

    /**
     * 端点清单（自述）。返回 {@code data} 本身——与改造前一致，本端点响应形状是
     * {@code {ok:true, data:{…}}}（<b>没有</b>顶层 {@code bff}）。
     */
    Map<String, Object> index();

    /** 消费者首页：feed + 达人/精选 + poolMeta + 未读通知 + me。 */
    Envelope home(Integer viewerId, String tab, String page, String pageSize);

    /** 商城首页：商品第一页 + 分类聚合 + 二手精选。 */
    Envelope mallHome(Integer viewerId, String page, String pageSize, String resalePageSize,
                      String category, String sort);

    /** 商品详情：商品 + 创作者 + 定制上下文 + 收藏态。 */
    Envelope product(Integer viewerId, String idRaw);

    /** 创作者工作台：overview + 待办池 + 草稿橱窗 + 未读通知。 */
    Envelope creatorWorkbench(Integer viewerId, String poolLimitRaw);

    /** 订单详情：订单 + 关联商品 + 阶段/物流标准化 + can。 */
    Envelope order(Integer viewerId, String idRaw);

    /** 我的页：me + 最近订单 + 通知/作品数 + stats。 */
    Envelope me(Integer viewerId, String orderLimitRaw, String notificationLimitRaw);
}
