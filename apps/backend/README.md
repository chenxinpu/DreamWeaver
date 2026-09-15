# apps/backend —— 织梦后端服务（Java / Spring Boot 3 / MySQL）

> **定位**：织梦 DreamWeaver 的唯一后端。一个进程同时承担 ①全部业务逻辑 ②BFF 聚合层 ③WebSocket 实时通信；
> 数据落 **MySQL**，持久化统一走 **Spring Data JPA**。唯一外部依赖是 Python AI 服务（`apps/ai`）。

## 1. 整体架构

```
前端 React SPA (5173)
      │  /api/*      /ws            （Vite dev 代理到 8787）
      ▼
apps/backend   Java 21 · Spring Boot 3 · 8787
      │  Spring Data JPA / Hibernate
      ▼
MySQL 8.4  :3306  (库 dreamweaver，39 张表：15 主表 + 24 张 @ElementCollection 表)
      │
      └── HTTP（仅 AI 生成类能力）──►  apps/ai  Python · FastAPI · 8789
```

## 2. 分层结构（严格教科书分层）

```
controller  →  service  →  repository  →  entity  →  MySQL
（参数解析）   （业务逻辑）  （数据访问）    （ORM 实体）
```

```
apps/backend/src/main/java/dreamweaver/
├── DreamWeaverApplication.java     启动类
├── controller/   控制层：只做「取登录态 → 调 service → 包 ApiResponse」，方法体 ≤10 行，**不注入 repository**
│   └── bff/        BFF 聚合控制器（逻辑在 service 层）
├── service/      业务层接口（XxxService）
│   └── impl/      业务层实现（XxxServiceImpl，@Service + @Transactional + 构造器注入）
├── repository/   持久层：Spring Data JPA 接口（15 个）
├── entity/       实体层：@Entity 映射（15 张表 + 枚举/值对象）
├── dto/          DTO 组装：DtoMapper（实体 → 展示用 DTO）
├── config/       配置：Web / WebSocket / 鉴权拦截器 / 启动播种
├── common/       公共：统一响应 · 业务异常 · 全局异常处理 · 时间与数值工具 · 登录上下文 · 公开接口白名单
├── parser/       文件解析组件（DXF R12+bulge / OBJ / SVG / 图片 / 元数据）—— 无状态工具，无持久层依赖
├── realtime/     WebSocket 基础设施（Handler / RoomRegistry / 弹幕 / IM）
└── ai/           Python AI 服务客户端（唯一出入口）
```

**依赖方向铁律**：`controller → service → repository → entity`。
- controller 不注入 repository，不出现排序/筛选/分页/金额计算/状态判断等业务规则；
- service 返回普通对象（Map / 实体 / DTO），不返回 `ApiResponse`；
- repository 只放 Spring Data JPA 接口与查询方法，不写业务逻辑。

## 3. 数据模型

| 项 | 说明 |
|---|---|
| 数据库 | MySQL 8.4，库 `dreamweaver`，字符集 utf8mb4 |
| 表名 | 统一 `dw_` 前缀（避开 MySQL 保留字） |
| 主键 | 业务实体 `Integer` + `@GeneratedValue(IDENTITY)`；`User` 与 `AppSettings` 为**指派式主键**（演示账号需固定 1/14/99，单行设置固定 id=1） |
| 标量集合 | `@ElementCollection(EAGER)` + `@CollectionTable` + `@OrderColumn`（保证 `photos[0]` 等顺序语义） |
| 嵌套值对象 | MySQL `JSON` 列（`@JdbcTypeCode(SqlTypes.JSON)`）：`body`/`aiDetail`/`spec`/`timeline`/`qcReport`/`logistics`/`returnReq` 等 |
| 真父子关系 | 仅 `dw_post 1—N dw_comment`（`@OneToMany(cascade=ALL, orphanRemoval)`） |
| 枚举 | `@Enumerated(EnumType.STRING)` |
| 表结构维护 | `spring.jpa.hibernate.ddl-auto=update`（开发期自动建表）；生产建议改 `validate` + 迁移工具 |

详见 [`ENTITY_MAPPING.md`](./ENTITY_MAPPING.md)。

## 4. 运行

```bash
# 推荐：在仓库根目录一键启停（含 MySQL）
./tools/dev/services.sh start|stop|restart|status

# 单独运行
. tools/dev/java-env.sh
cd apps/backend && ./mvnw spring-boot:run      # 127.0.0.1:8787
./mvnw -DskipTests package                     # → target/dreamweaver-backend.jar
```

首启且库为空时自动灌入演示数据（19 用户 / 16 素材 / 7 作品 / 19 推文 / 126 评论 / 6 橱窗 / 4 商品 / 135 订单 / 2 二手挂单）。
健康检查（含 Python AI 状态）：`curl http://127.0.0.1:8787/api/health`

### 配置（环境变量覆盖）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `8787` | 监听端口（前端 Vite 代理目标） |
| `DW_BIND` | `127.0.0.1` | 绑定地址 |
| `DW_DB_HOST` / `DW_DB_PORT` / `DW_DB_NAME` | `127.0.0.1` / `3306` / `dreamweaver` | MySQL 连接 |
| `DW_DB_USER` / `DW_DB_PASSWORD` | `dw` / `dw123456` | MySQL 账号 |
| `DW_DDL_AUTO` | `update` | Hibernate 建表策略 |
| `DW_SHOW_SQL` | `false` | 打印 SQL |
| `DW_SEED` | `true` | 首启是否灌入演示数据 |
| `DW_AI_BASE_URL` | `http://127.0.0.1:8789` | Python AI 服务地址 |
| `DW_INTERNAL_TOKEN` | `dw-internal-dev-token` | 服务间内部令牌 |

## 5. 接口契约

- **统一响应**：成功 `{"ok":true,"data":…}`；失败 `{"ok":false,"code":"…","msg":"…"}`
- **鉴权**：`Authorization: Bearer <token>`；公开只读接口白名单见 `common/PublicApi.java`
- **业务接口** `/api/**`：路径、方法、字段、中文文案与既有契约一一对应，前端无需改动
- **BFF 接口** `/api/bff/**`：为前端页面聚合，响应 `{ok:true, data:{…}, bff:{computedAt, upstreams, degraded}}`
- **实时接口** `/ws`：房间 `order:<id>` / `post:<id>` / `user:<id>` / `live:<room>` / `im:<min>-<max>`，广播帧 `{"topic","event","data","ts"}`
- **内部接口** `/internal/publish`、`/internal/stats`（`X-Internal-Token` 校验）
- **运维接口** `POST /api/dev/reset`：TRUNCATE 全部业务表（自增计数复位）并按需重新播种，可重复执行

## 6. 依赖边界

- **允许**：Spring Boot Web / WebSocket / Validation / Data JPA / Actuator、MySQL Connector/J、JDK 标准库。
- **禁止**：在本服务内实现 AI 生成逻辑（必须走 `apps/ai` 的 `ai.AiServiceClient`）。
