# 实体层（JPA）映射规范

> 本文件是 `dreamweaver.entity` 的映射契约。所有实体必须严格按此实现，否则 service/controller 层与前端契约都会破。

## 0. 目标分层（全工程）

```
dreamweaver/
├── DreamWeaverApplication.java
├── common/       公共层：ApiResponse / ApiException / Errors / GlobalExceptionHandler / TimeUtil / MiscUtil / PublicApi / RequestContext
├── config/       配置层：WebConfig / AuthInterceptor / WebSocketConfig
├── controller/   控制层：只做「参数解析 + 调 Service + 包 ApiResponse」，禁止出现业务规则与持久化调用
│   └── bff/      BFF 聚合控制器
├── service/      业务层：接口（XxxService）
│   └── impl/     业务层实现（XxxServiceImpl，@Service + @Transactional）
├── repository/   持久层：Spring Data JPA 接口
├── entity/       实体层：@Entity（本文件规范对象）
├── dto/          数据传输对象层：DtoMapper + 请求/响应 DTO
├── parser/       文件解析组件（DXF/OBJ/SVG/图片），无状态工具
├── realtime/     WebSocket 基础设施（Handler / RoomRegistry）
└── ai/           Python AI 服务客户端
```

**调用方向严格单向**：`controller → service → repository → MySQL`。controller 不得注入 repository；repository 不得依赖 service。

## 1. 表命名与基础约定

- 所有表名加前缀 **`dw_`**（避开 MySQL 保留字，例如 `user`/`order`/`status`）：
  `dw_user`、`dw_material`、`dw_work`、`dw_post`、`dw_comment`、`dw_pool_entry`、`dw_window_material`、
  `dw_product`、`dw_order`、`dw_resale_listing`、`dw_notification`、`dw_commission_rule`、`dw_ledger_event`、
  `dw_view_seed`、`dw_app_settings`。
- 每个实体：
  ```java
  @Entity
  @Table(name = "dw_xxx")
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public class Xxx { ... }
  ```
- 字段保持 **public**（Jackson 直接序列化，字段名即 JSON 契约），**不要加 getter/setter**。
- 主键：
  ```java
  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  @Column(name = "id")
  public Integer id;
  ```
  注意：所有实体主键类型必须是 **`Integer`**（不是 `int`），否则 `save()` 无法区分新增/更新。
- 所有标量字段显式写 `@Column(name = "snake_case", ...)`；字符串按需给长度（默认 255，长文本用
  `@Lob` 或 `columnDefinition = "TEXT"`/`"LONGTEXT"`）。
  例外：字段名本身是 MySQL 保留字时，列名必须避开（Hibernate 不会自动加反引号），已确定三处：
  `Work.desc`→列 `description`、`CommissionRule.desc`→列 `description`、`CommissionRule.when`→列 `when_expr`、
  `Notification.read`→列 `is_read`；**JSON 字段名（Java 字段名）不变**。
- 时间字段全部是**字符串**（ISO `+08:00`），`@Column(length = 32)`，不要用 `LocalDateTime`（契约是字符串）。
- 枚举：`@Enumerated(EnumType.STRING)`。注意：`@JsonValue` 只影响 JSON（输出小写值），
  `@Enumerated(STRING)` 在 DB 里存的是**枚举常量名（大写，如 `CREATOR`）**；MySQL 会把该列建成
  `enum('ADMIN','AUDITOR',...)`。若要求 DB 也存小写，必须改用 `AttributeConverter`，本工程不采用。

## 2. 三种映射策略

### A. 标量 → 普通列
`int/long/double/boolean/String/枚举` 直接映射列。可空的包装类型（`Integer`/`Double`/`Boolean`）保持包装类型。

### B. 有序标量集合 → `@ElementCollection` + `@OrderColumn`
`List<String>` / `List<Integer>`（例如 `photos`、`images`、`tags`、`patternMatIds`、`likedBy`）：

```java
@ElementCollection(fetch = FetchType.EAGER)
@CollectionTable(name = "dw_user_follows", joinColumns = @JoinColumn(name = "user_id"))
@OrderColumn(name = "idx")
@Column(name = "follow_user_id")
public List<Integer> follows;
```

- **必须加 `@OrderColumn`**：`photos[0]` 是封面、`patternMatIds` 顺序参与业务，无序会出错。
- **必须 `fetch = FetchType.EAGER`**：controller 层在事务外序列化实体，LAZY 会抛 `LazyInitializationException`。
- **集合字段默认值保持 `null`**（不要 `new ArrayList<>()`）：原契约里「可选字段缺席」靠 `null` + `@JsonInclude(NON_NULL)` 实现；
  反序列化/序列化前由 service 层负责判空。
- 列名与 `@CollectionTable` 名必须显式写出，命名规则：`dw_<实体>_<字段>`。

### C. 嵌套值对象 → MySQL JSON 列
无法自然展平的值对象（`BodyMeasurement`、`ObjMesh`/`ObjPreview`、`WindowSpec`、`AiDetail`、
`DetailEdits`、`OrderSpecUsed`、`OrderStage`、`QcReport`、`LogisticsInfo`、`ReturnReq`、`OrderTimelineItem` 列表等）：

```java
@JdbcTypeCode(SqlTypes.JSON)
@Column(name = "ai_detail", columnDefinition = "json")
public AiDetail aiDetail;
```
- 需要导入 `org.hibernate.annotations.JdbcTypeCode` 与 `org.hibernate.type.SqlTypes`。
- 列表型 JSON：`List<OrderTimelineItem> timeline` 同样用 `@JdbcTypeCode(SqlTypes.JSON)`。
- 这些值对象**不加 `@Entity`、不加 `@Embeddable`**，保持普通 POJO + `@JsonInclude(NON_NULL)`。

### 唯一的真父子关系
`dw_post 1 — N dw_comment`：
```java
// Post
@OneToMany(mappedBy = "post", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
public List<CommentItem> comments;

// CommentItem
@ManyToOne(fetch = FetchType.LAZY)
@JoinColumn(name = "post_id")
@JsonIgnore          // 防止 JSON 循环
public Post post;
```
`commentCount` 仍是**独立列**（原契约就这么存），不要改成派生值。

## 3. 实体清单（15 张表）

| 实体类 | 表名 | 标注为 JSON 的字段 | 标注为 @ElementCollection 的字段 |
|---|---|---|---|
| `User` | `dw_user` | `body` | `follows`、`collectProductIds`、`collectPostIds` |
| `Material` | `dw_material` | `objPreview` | `layerNames`、`tags` |
| `Work` | `dw_work` | — | `styleTags`、`patternMatIds`、`modelMatIds`、`mediaImages` |
| `Post` | `dw_post` | — | `images`、`tags`、`likedBy`、`patternMatIds`、`modelMatIds`（`comments` 用 `@OneToMany`） |
| `CommentItem` | `dw_comment` | — | — |
| `PoolEntry` | `dw_pool_entry` | — | — |
| `WindowMaterial` | `dw_window_material` | `spec`、`partsFabric`（`List<FabricPart>`）、`auditLog`（`List<AuditLogItem>`） | `photos`、`styleTags`、`patternMatIds`、`modelMatIds`、`auditMissing` |
| `Product` | `dw_product` | `aiDetail`、`detailEdits` | `styleTags`、`images`、`patternMatIds`、`modelMatIds`、`likedBy` |
| `Order` | `dw_order` | `specUsed`、`timeline`、`stage`、`qcReport`、`logistics`、`returnReq` | — |
| `ResaleListing` | `dw_resale_listing` | — | — |
| `Notification` | `dw_notification` | — | — |
| `CommissionRule` | `dw_commission_rule` | — | — |
| `LedgerEvent` | `dw_ledger_event` | — | — |
| `ViewSeed` | `dw_view_seed` | — | — |
| `AppSettings` | `dw_app_settings` | — | — |

> `AppSettings` 是**由 `Settings` 改名而来**的新实体：单行记录（`id` 固定为 1），
> 字段 `lastPoolEval`、`lastWindowAudit`、`seedVersion`，外加一个 `@JdbcTypeCode(SqlTypes.JSON)
> Map<String,Object> extra` 承接原 `@JsonAnySetter` 的开放键值。

**枚举**（`Role`/`MaterialKind`/`WindowStatus`/`OrderKind`/`OrderStatus`/`ResaleStatus`）与
**纯值对象**（`BodyMeasurement`/`ObjMesh`/`ObjPreview`/`FabricPart`/`SizeChartRow`/`WindowSpec`/`AuditLogItem`/
`AiDetail`/`AiSection`/`DetailEdits`/`SpecLine`/`OrderTimelineItem`/`OrderStage`/`QcReport`/`QcItem`/
`LogisticsInfo`/`LogisticsTrace`/`ReturnReq`/`OrderSpecUsed`/`OrderAmounts`）**不加 JPA 注解**（`OrderAmounts`
可作为 `@Embedded` 嵌入 `dw_order` 的三个金额列，或保持 JSON；统一用 `@JdbcTypeCode(SqlTypes.JSON)` 更省事）。

**`Db.java` 删除**（原内存库聚合根，被 MySQL 取代）。

## 4. JSON 与 MySQL 兼容注意

- MySQL 8.4：`columnDefinition = "json"` 即可；`ddl-auto=update` 会自动建表。
- Hibernate 需要 Jackson 作为 JSON 格式映射器，已在 `application.yml` 配好（`hibernate.type.json_format_mapper` 默认 Jackson）。
- 大 double（例如原 DXF 退化尺寸 `19942501948`）以 JSON 列存储时无精度问题。

## 5. 自检清单

- [ ] 每个实体有 `@Entity` + `@Table(name="dw_…")` + `@JsonInclude(NON_NULL)`
- [ ] 主键 `Integer id` + `@GeneratedValue(IDENTITY)`
- [ ] 集合字段：`@ElementCollection(EAGER)` + `@CollectionTable` + `@OrderColumn` + 默认 `null`
- [ ] 嵌套对象：`@JdbcTypeCode(SqlTypes.JSON)` + `columnDefinition="json"`
- [ ] 枚举 `@Enumerated(EnumType.STRING)`
- [ ] 没有 getter/setter；字段仍为 public；中文 javadoc 保留
- [ ] 编译通过：`cd apps/backend && ./mvnw -q -DskipTests compile`
