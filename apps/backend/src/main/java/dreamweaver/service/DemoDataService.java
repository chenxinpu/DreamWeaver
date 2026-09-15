package dreamweaver.service;

/**
 * 演示数据播种服务：由原 JSON 文件库版 {@code store.SeedData}（+ {@code DbStore.loadOrSeed/replaceDb}）
 * 移植而来，现走 JPA repository 落 MySQL。
 *
 * <p>对应原 {@code GET} 启动播种语义与 {@code POST /api/dev/reset} 重置语义：
 * 不再维护 {@code data/db.json}，也不再手工维护 id 自增计数器（{@code store.nextId}）。
 */
public interface DemoDataService {

    /**
     * 库为空时播种演示数据；已有数据则跳过。返回是否真正执行了播种。
     *
     * <p>等价于原 {@code DbStore.loadOrSeed()}：{@code data/db.json} 不存在才跑
     * {@code SeedData.build()}；这里改为「业务表无数据才播种」。
     */
    boolean ensureSeeded();

    /**
     * 清空所有业务表并重新播种（对应原 {@code POST /api/dev/reset}）。返回是否播种。
     *
     * @param seed {@code true} 清空后重新播种；{@code false} 仅清空
     */
    boolean reset(boolean seed);
}
