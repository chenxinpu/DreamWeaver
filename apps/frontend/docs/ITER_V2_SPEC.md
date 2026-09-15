# 织梦 DreamWeaver V2 迭代规格（全栈实现契约）

> 依据 `apps/v2_0.md`。本文档是 v2 全栈实现的**唯一契约**：后端（`apps/backend`，Java / Spring Boot）与前端（`apps/frontend` V2 重写）都严格按其实现。
> 术语：**作品(work)**=创作者在素材库基础上组织的设计对象；**推文(post)**=发布到广场的内容；**资源池(pool)**=系统按规则自动筛选出的市场认可作品；**橱窗(showcase)**=创作者上架材料供平台审核；**商品(product)**=审核通过后 AI 生成详情页上架商城。

## 0. 版本目标（来自 iter_v2.md，全部实现）

1. **暂停自研设计 App 的创作链路**（V1 自研设计器已移除，不再接入 V2 官方端）。官方端改为**导入主流软件结果文件**并在官方端呈现「3D 图 + 打版图」；导入入口在**创作者平台侧边栏「素材库」**。
2. **创作变现全流程**：素材库导入 → 发推文（3D图/打版图来自素材库 + 标签）→ 点赞>当日推文点赞 P60 或 评论≥10 → **系统自动纳入资源池** → 通知提醒上橱窗 → 提交材料（真人穿搭图/规格表/3D与打版文件/基础费用/原价）→ 系统审核 → **AI 生成商品详情页上商城** → 变现数据看板（BI 规范）+ 佣金 2%~10%（KPI 浮动：退货率、资源池样式重复度）。
3. **私人定制全流程**：商品详情页可「直接购买」或「私人定制」→ 按体型数据自动调整规格（系统主动提示哪个规格不合适）→ AI 交互改部件/元素/面料并出图 → 确认后**付全款（原价+基础费用）** → 退货只扣基础费用（原价退还）/ 换货重新定制再收一次基础费用 → 退货自动进**二手集市**（默认原价×75% 标价，成交抽成用于仓储物流，余款退原买家，可自行降价）。
4. **信息架构**：商城**不占底部 Tab**、入口放**侧边栏**（参考抖音，从首页左上/头像处滑出）；底部 Tab = 首页 / 消息 / 我的；「我的」参考抖音个人主页但不照搬；**创作者平台与商城都是独立网页形态**（各自独立路由族 + 独立外壳布局，桌面/全屏，参考抖音商城与创作者中心）；删除品牌孵化、删除投票打榜。

## 1. 关键决策

| 项 | 决策 |
|---|---|
| 后端 | `apps/backend`：Java 21 + Spring Boot 3；持久化 = JSON 文件库（`data/db.json`）；启动时自动 seed 演示数据；提供 `reset` 与手动触发评估的辅助接口；同端口提供 BFF 聚合与 WebSocket 实时通道 |
| 前端 | `apps/frontend` V2 单仓库多路由族：consumer(手机壳 `#/`)、mall(手机壳独立页 `#/mall*`)、creator(桌面宽壳 `#/creator*`)；同一 Vite dev server，`/api` 代理到后端 |
| 身份 | Bearer token（mock）：登录页/角色切换选择演示账号；角色 consumer/creator/auditor/admin |
| 格式解析 | 服务端纯 TS 解析器：DXF(R12 子集: LINE/LWPOLYLINE含bulge/CIRCLE/ARC/POINT/TEXT/LAYER)、OBJ(顶点/面)、SVG(直接内嵌)、图片(png/jpg base64)、glb/zprj/ai(仅元数据+封面) |
| 3D 预览 | 前端 canvas 手写 OBJ 线框/着色旋转查看器（无 three 依赖）；GLB 显示元数据+占位 |
| 打版预览 | DXF→SVG 由后端生成 patternSvg；前端 PatternSvg 组件展示（可拖拽/缩放基本交互） |
| 数据流 | 全部核心数据走后端 API；前端纯展示 + 本地只存 token/身份/草稿 |
| 端口 | 后端 8787；前端 dev 5173（代理 /api→8787）；生产：后端可托管 official dist |

## 2. 数据模型（服务端 JSON store，单文件内存库 + 磁盘持久化）

以下为实体关键字段（TS 形状即 API DTO 形状，前后端共用语义；日期统一 `YYYY-MM-DDTHH:mm:ss+08:00`，另有 `dateKey=YYYY-MM-DD` 便于按日聚合）。

```ts
type Role = 'consumer' | 'creator' | 'auditor' | 'admin';
interface User {
  id: number; nickname: string; avatar: string; bio: string;
  role: Role; level: 0|1|2|3;             // 能力认证等级(学习模块沿用)
  followers: number; following: number;
  body?: BodyMeasurement;                  // 体型（消费者用）
  createdAt: string;
}
interface BodyMeasurement {
  height:number; weight:number; bust:number; underBust:number; waist:number; hip:number;
  shoulderWidth:number; armLength:number; thigh:number; calf:number; neck:number; backLength:number;
  source:'manual'|'ai'; updatedAt:string;
}
type MaterialKind = 'dxf'|'svg'|'obj'|'glb'|'png'|'jpg'|'zprj'|'ai'|'pdf';
interface Material {
  id:number; creatorId:number; title:string; kind:MaterialKind;
  ext:string; size:number;                     // 原始字节
  fileName:string;
  layerNames?:string[]; entityCount?:number;   // dxf/svg 统计
  patternSvg?:string;                          // dxf/svg → 打版图 svg 字符串
  objPreview?: { vertices:number; faces:number; mesh?: {positions:number[]; faces:number[]; normals?:number[]} } | null; // obj→ 前端旋转查看
  cover?:string;                               // image / obj截图占位 / svg缩略 用 /images/…
  width?:number; height?:number;               // 图片或解析画布尺寸
  note?:string; parseWarn?:string;
  tags:string[]; createdAt:string;
}
interface Work {                               // 创作者组织设计对象
  id:number; creatorId:number; title:string; category:string; // 连衣裙/衬衫/半裙/外套/裤装/套装
  styleTags:string[]; fabric:string; desc:string;
  cover:string;
  patternMatIds:number[]; modelMatIds:number[]; // 3D 素材 + 打版素材（素材库引用）
  mediaImages:string[];                        // 展示图
  createdAt:string;
}
interface Post {
  id:number; authorId:number; workId?:number;
  content:string; images:string[];             // 内容图（可含素材快照）
  tags:string[]; createdAt:string; dateKey:string;
  likes:number; likedBy:number[];
  comments:Comment[];                          // {id,userId,content,createdAt,likes}
  commentCount:number; shareCount:number;
}
interface PoolEntry {                          // 资源池
  id:number; postId:number; workId?:number; creatorId:number;
  qualifiedAt:string; dateKey:string;
  reason:string;                               // '点赞超过当日P60' | '评论数≥10' | '同时满足'
  likeP60:number; likeAtQualify:number; commentAtQualify:number;
  notifiedAt?:string;
}
interface WindowMaterial {                     // 橱窗材料单（每次提交一条）
  id:number; creatorId:number; workId:number; postId?:number;
  status:'draft'|'submitted'|'approved'|'rejected'; // draft 创作者编辑中; submitted 待系统审核
  photos:string[];                             // 真人模特穿搭实景图（素材或图片 url 列表）
  partsFabric:{part:string;fabric:string;note?:string}[];   // 各部件面料
  spec:{ label:string; sizeChart:{size:string; bust?:number; waist?:number; hip?:number; shoulder?:number; sleeve?:number; length?:number}[]; note?:string };
  productName:string; category:string; styleTags:string[];
  price:number;                                // 原价
  baseFee:number;                              // 基础费用（加工/材料/人工，定制专用）
  patternMatIds:number[]; modelMatIds:number[];
  auditLog?: { passed:boolean; note:string; at:string }[];
  createdAt:string; updatedAt:string;
}
interface Product {
  id:number; creatorId:number; workId:number; windowId:number;
  title:string; category:string; styleTags:string[];
  price:number; baseFee:number;                // 原价 / 基础费用
  cover:string; images:string[];
  patternMatIds:number[]; modelMatIds:number[];
  aiDetail: {                                  // AI 生成的详情页内容（可被创作者编辑非材料部分）
    intro:string; story:string;                // 从设计到生产的故事
    sections:{icon?:string; title:string; body:string}[]; // 面料/工艺/规格说明
    sizeChart:{size:string; bust?:number; waist?:number; hip?:number; shoulder?:number; sleeve?:number; length?:number}[];
    partsFabric:string[];                      // 部件面料渲染文本
    manufacturer:string; prodDays:number;      // 生产商 / 生产周期
    baseFeeNote:string;
  };
  detailEdits?: {                              // 创作者可改的非材料内容
    intro?:string; story?:string; sections?: {title:string;body:string}[]; manufacturer?:string;
  };
  views:number;                                // 详情页访问
  sales:number;                                // 成交件数(有效订单)
  status:'draft'|'onSale'|'offShelf';
  createdAt:string;
}
type OrderKind='direct'|'custom';
type OrderStatus='created'|'paid'|'producing'|'qc'|'shipping'|'received'|'completed'|'cancelled';
interface Order {
  id:number; no:string;
  productId:number; productTitle:string; cover:string; creatorId:number;
  kind:OrderKind;
  buyerId:number;
  specUsed:{ size?:string; adjusted?:SpecLine[]; body?:BodyMeasurement };  // custom 必填调整结果
  amounts:{ price:number; baseFee:number; total:number };                  // direct: baseFee=0
  status:OrderStatus;
  timeline:{t:string;text:string}[];            // 关键节点（支付/生产/质检/发货/收货）
  stage?:{ name:string; percent:number; eta:string; doneAt?:string };
  qcReport?:{ pass:boolean; items:{k:string;v:string}[]; at:string };
  logistics?:{ company:string; trackingNo:string; traces:{time:string;text:string}[] };
  returnReq?:{ state:'none'|'returning'|'done'|'exchanged'; refundAmount:number; baseFeeKept:number; reason:string; at:string; resaleListingId?:number; newOrderId?:number };
  paidAt?:string; shippedAt?:string; receivedAt?:string;
  createdAt:string;
}
interface ResaleListing {                       // 二手集市
  id:number; orderId:number; productId:number; originalTitle:string;
  sellerId:number;                              // 原买家（退货人）
  photo:string; sizeLabel:string;               // 尺码/定制说明
  listPrice:number;                             // 当前标价（默认 原价×0.75）
  platformFeeRate:number;                       // 佣金（仓储物流）默认 8%
  status:'active'|'sold'|'cancelled'; soldTo?:number; soldAt?:string;
  netToSeller?:number; feeCharged?:number;
  createdAt:string;
}
interface Notification {
  id:number; userId:number; type:string;        // pool_remind|audit|product|order|refund|resale|commission|system|like|comment
  title:string; body:string; link?:string; read:boolean; createdAt:string;
}
interface CommissionRule { id:number; name:string; desc:string; active:boolean; kind:'level'|'penalty'; when:string; } // 展示用
interface LedgerEvent {                          // 资金流水（佣金/退款/转售结算）
  id:number; userId:number; kind:string; amount:number; balance:number; refNo:string; createdAt:string;
}
interface Settings { lastPoolEval?: string; }     // 资源池引擎状态
```

附加模型：`InteractionSeed`（过去 30 天各商品浏览/下单/退款种子，用于 BI 图表演示）、`RecommendSeed`、`CommentLike`。后端提供 `GET /api/health`、`POST /api/dev/eval-pool`、`POST /api/dev/reset`（重置数据）等演示辅助接口。

## 3. 业务规则（引擎，后端实现；必须精确）

### 3.1 资源池自动筛选（核心）
- 每天（dateKey = 本地时区东八区）00:05 自动跑一次，且每次点赞/评论变更、每次发布推文后**增量评估**（作者所有推文）；并提供手动 `POST /api/dev/eval-pool`。
- 统计口径：当日**全平台**推文的点赞集合 → `P60 = 升序排列第 ceil(n*0.6) 个值`（n≥3 才有意义；n<3 时取当日均值，仍按规则）。
- 合格条件（任一命中即入池，同一推文只入池一次）：
  - `likes > P60`，或
  - `commentCount >= 10`。
- 入池后：创建 PoolEntry → 生成通知给该作者（`pool_remind`，body 引导准备橱窗材料，link=`/creator/window?workId=`）→ 该作品（work）在创作者平台资源池可见、并标记池中样式供重复度统计。
- 若入池前作品已无 workId（推文未关联作品），只记录 post；创作者可从资源池进入「去上橱窗」（需先有 work，可在素材库→作品组织）。

### 3.2 橱窗审核（系统审核）
- 创作者在 `/creator/window` 提交 `WindowMaterial`（status=submitted）。
- 系统自动审核（模拟 1 次请求内完成，日志记录 24h 内完成）：
  - 完整性检查：photos≥1、partsFabric 每部件有面料、spec.sizeChart≥2 档、patternMatIds≥1、modelMatIds≥1、price>0、baseFee>0。
  - 全通过 → approved：**自动生成 AI 商品详情页**（见 3.3）→ 创建 Product(onSale) → 通知 creator（audit/product 类型，含链接）。
  - 任一缺失 → rejected + auditLog 注明缺失项 → 通知 creator 补材料重提（status 回 draft，可再提交）。
- auditor/admin 角色可 `POST /api/admin/window/:id/force`（pass/reject）覆盖演示审核结论。

### 3.3 AI 商品详情页生成（规则模板）
由 WindowMaterial+Work+关联素材生成 `Product.aiDetail`：
- intro = 设计叙事（模板拼接标题/风格标签/品类，语气带货但克制）
- story = 「从设计到生产」段落：设计(素材工具+版本)→打版(DXF R12 校对)→3D 试穿(CLO 导出 obj 质检)→柔性工厂 C2M 排产→质检→发货；引用素材 fileNames 增加可信度
- sections：面料（partsFabric 逐部件渲染 + 克重/垂坠/光泽等模板措辞）、工艺（刀口/对位/放码/缝份等 CAD 语义话术）、规格（sizeChart 完整渲染 + 国际尺码换算提示）、生产（manufacturer 模板「织梦柔性智造工厂 · 华东1号」prodDays）
- baseFeeNote = 基础费用说明（含加工/材料/人工等条目文案）
- 生成后允许创作者在商品管理修改 detailEdits（intro/story/sections/manufacturer，非材料）；**材料变更（换图/换版/规格/价格）必须改 WindowMaterial 重新走审核**。

### 3.4 私人定制规格调整与不适配提醒
- 每件商品附带基础规格表（sizeChart：成衣松量后的成品尺寸）。
- 品类松量默认：连衣裙/套装 bust+8 waist+6 hip+8；衬衫/外套 bust+12 shoulder+1.5；半裙 waist+4 hip+6；裤装 waist+4 hip+8(坐围)；数值可按商品微调（前端表单来自 spec）。
- 输入体型 body → 后端 `POST /api/custom/adapt`：
  - 对胸/腰/臀/肩/袖长/衣长等维度算出「需要成品尺寸 = 体型 + 品类松量」；
  - 选基码：使各关键维度均 ≤ 该码成品尺寸且差距最小；
  - 输出 adjustedSpec：`{part, body, ease, base, target, flag: 'ok'|'tight'|'loose', advise}`（tight=成品容纳不下→提示改大/该处不合适；loose 容差外→提示改小或接受）；baseSize 为推荐基码；
  - `fitAlerts`: 存在 tight 或超出码表上下限时给出「系统提示：该规格可能不合适」并列出具体规格（这是迭代文档要求的产品能力）。
- AI 交互 `POST /api/custom/chat`：接收用户诉求（部件/设计元素/面料等），后端返回 `{reply, options:[{key,title,desc}], imageUrl?}`；`POST /api/custom/variant`：对选定 option 生成参变化样式预览图（**生成图**：后端生成 SVG 款式草图字符串 base64 或前端渲染参数），直接返回变体信息供确认。
- 确认定制 → 下单 kind=custom（支付 = price+baseFee，amounts.total 一并记录）。

### 3.5 付款/生产/履约状态机
- 支付为模拟（余额充足直接成功）：created→paid，生成 timeline。
- 履约进度按生产周期动态推进（后端按 createdAt 与 prodDays 推导 stage；演示按钮 `POST /api/order/:id/dev-advance` 可直接推到下一节点并写 timeline/qcReport/logistics），状态机：paid→producing→qc→shipping→received（received 后消费可申请售后：退货/换货）。

### 3.6 退货 / 换货（私人定制）
- 定制订单确认收货后可发起：
  - **退货**：退款金额 = amounts.price（原价全额退，基础费用不退）→ 订单 returnReq.state=done, refundAmount=price → 系统**自动创建 ResaleListing**：listPrice = price×0.75（可改低），platformFeeRate=8% → 通知消费者。
  - **换货重新定制**：订单进入 exchanged，创建**新订单**（kind=custom，金额 = 0×price + baseFee —— 即再收一次基础费用；原价部分因第一单已付，若用户要求退款原价+重定制可走「退货+重购」）。UI 提供清晰文案两种路径。
  - 直接购买(direct)订单：支持未发货前取消（全额退）；收货后质量问题退货走 qcReport 判定（demo 简化为可退原价）。
- 资金流水：退款/佣金/转售净得均写 LedgerEvent。

### 3.7 二手集市成交
- ResaleListing 被购买：status=sold，buyer 付 listPrice → feeCharged=listPrice×platformFeeRate（仓储物流），netToSeller=listPrice−feeCharged 记入 seller（原买家）钱包流水与通知；列表标记 sold。
- 卖家可改价（只降）`PATCH /api/resale/:id/price`；可取消上架。
- 商城「二手集市」频道展示 active 列表（含全新成衣照/定制说明/原价划线价/当前标价/净得提示）。

### 3.8 佣金 KPI（2%–10%）
- 基础 6%；kpi 上浮：单品近30天转化率≥8% 且 销量≥10 → +2（封顶 10）；kpi 下浮：近30天退货率>6% → −1.5/档（>10% 再 −1.5）、资源池样式重复度（与其同 styleTags 重叠度≥60% 的池内其他作品数 ≥3 → −1；≥5 → −2）。
- `GET /api/creator/commission/rate?productId=` 返回 {rate, base, breaks:[{name,delta}], reasons[]}。
- 佣金按已支付订单（不含退单）在收货 T+7 结算演示：直接展示「预估/已结算/可提现」，提现写 LedgerEvent。

### 3.9 变现数据看板（BI 规范，桌面）
- creator 专属数据接口聚合：KPI 卡（橱窗商品数/近30日成交额/转化率/退货率/预估佣金）、折线（7/30 日 成交额&订单量）、柱状（商品销量对比）、退货趋势、来源渠道饼图（seed）、明细表（商品×转化率/销量/退货率/佣金率）。默认 30 天，可切 7/30/90 与单品筛选。

## 4. API 契约（REST，前缀 `/api`；鉴权 Bearer；错误 `{ok:false,code,msg}`）

响应统一 `{ok:true,data}`。分页 `?page=&pageSize=`。演示账号见第 6 节 seed。

```
# auth
POST /auth/login            {userId} → {token,user}
GET  /me                    当前用户（含 body, notifications unread 数等聚合）
POST /auth/switch           切演示账号 {userId}

# users
GET  /users/:id             用户公开信息（含创作者聚合：橱窗商品数、粉丝等）

# materials（创作者）
POST /materials/import       multipart 或 {fileName, kind, content(base64|text), note} → 解析入库 Material
GET  /materials?mine=1&kind=dxf   列表（默认当前用户素材库）
GET  /materials/:id         详情（含 patternSvg/objPreview 完整）
DELETE /materials/:id
GET  /materials/import-help 支持格式说明 + 示例文件元数据

# works / posts（广场 & 创作者）
POST /works                 创建/编辑作品 {title,category,styleTags,fabric,desc,cover,patternMatIds,modelMatIds,mediaImages}
GET  /works/mine            我的作品
GET  /works/:id
POST /posts                 {workId?,content,images(material id 解析后的快照/url),tags,patternMatIds?,modelMatIds?}
                              → 若关联了素材，images 自动补素材预览；返回 post（含推荐互动）
GET  /feed?tab=rec|follow|hot&page=
GET  /posts/:id             详情
POST /posts/:id/like  /unlike
POST /posts/:id/comment     {content}   // 评论数≥10 引擎触发
POST /posts/:id/share

# pool（资源池引擎）
GET  /creator/pool          当前创作者池（含 each entry 的作品/推文/达标明细）
POST /dev/eval-pool         立即按规则评估 → {evaluated, added:[...]}
GET  /pool/meta             引擎说明 + 上次执行时间

# window showcase（橱窗）
GET  /creator/window        我的橱窗材料列表（draft/submitted/approved/rejected）
POST /creator/window        draft 或 submit {workId,postId?,photos,partsFabric,spec,productName,category,styleTags,price,baseFee,patternMatIds,modelMatIds, action:'draft'|'submit'}
POST /creator/window/:id/submit   提交审核
PATCH /creator/window/:id   草稿更新（材料变更会触发 status=draft, 原 product 下架提示）
POST /admin/window/:id/force      {pass:boolean, note} 审核员演示操作
GET  /creator/window/:id

# products（商城 & AI 详情）
GET  /mall/products?category=&kw=&sort=&page=      上架商品
GET  /products/:id           详情（aiDetail + creator + 素材引用 + 状态）
POST /creator/products/:id/edit-detail   更新 detailEdits（非材料内容）
PATCH /creator/products/:id/shelf         上/下架
POST /products/:id/view                  浏览计数（幂等/降频由前端控制，简单累加即可）
POST /products/:id/like  /unlike          (收藏预留给 我的) → 可选

# custom（私人定制）
GET  /custom/product/:id/context          {product, sizeChart, easeTemplate, baseFeeNote}
POST /custom/adapt       {productId, body} → {baseSize, chart rows, adjustedSpec, fitAlerts, totalEstimate:{price,baseFee,total}}
POST /custom/chat        {productId, history:[{role,content}], body?} → {reply, options}
POST /custom/variant     {productId, optionKey} → {image(svg data url / url), title, desc, applied}   // 生成图
POST /custom/preview     {productId, body, options[]} → 汇总调整后规格图预览（前端渲染合成）

# orders（下单/支付/履约/售后）
POST /orders              {productId, kind:'direct', size} | {productId, kind:'custom', body, adaptId?} → 创建(created)
POST /orders/:id/pay      模拟支付 → paid
GET  /orders/mine?status= 买家订单
GET  /orders/:id          详情（timeline/stage/qcReport/logistics/returnReq）
POST /orders/:id/dev-advance            演示推进：producing→qc→shipping→received（自动写 timeline/质检/物流）
POST /orders/:id/return    {reason}   定制退货（退 price 原价，留 baseFee）→ 自动建 ResaleListing + 通知
POST /orders/:id/exchange {reason}    定制换货重做：旧单 exchanged → 新建 custom 订单（baseFee 再付）待支付
POST /orders/:id/cancel   direct 未发货可取消全额退；custom 仅支付前可取消
GET  /orders/seller/mine              创作者维度：订单(为统计/佣金)
POST /orders/:id/confirm-received

# resale 二手集市
GET  /mall/resale?page=      active 列表（含原价划线）
GET  /resale/mine           我的挂单（原买家视角）
POST /resale/:id/buy        购买 → sold/结算/通知
PATCH /resale/:id/price     {listPrice} 只许 ≤
POST /resale/:id/cancel

# notifications
GET  /notifications?unread=1
POST /notifications/read    {ids?:number[]|'all'}

# creator dashboard / commission / BI
GET  /creator/overview                    {poolCount, windowDraft..., stats}  创作者工作台总览
GET  /creator/dashboard?days=30&productId=   BI 看板聚合（见 3.9）
GET  /creator/commission?days=            {withdrawable,pending,settled,ledger[],rules}
GET  /creator/commission/rate?productId=
POST /creator/commission/withdraw         {amount}
GET  /creator/bi/series?days=&metric=order|amount|returnRate   （图序列）
GET  /feed/recommend/seed?                消费者首页补充：达人/官方精选（可选）

# admin/dev
GET  /admin/users?role=           演示账号与角色说明
POST /dev/reset {seed?:boolean}   重置/重播种
POST /dev/eval-pool               资源池立即评估
```

**字段补充说明（前端必须展示）**：feed 推文 item 需带 author{id,nickname,avatar,level}、linkedWork(若 workId)、素材预览徽标（patternMatIds/modelMatIds 数量）、liked(当前用户是否点过) 由后端算好返回 `viewer:{liked,collected}`；comment item 带 author。orders seller 需要 order.creatorId。

## 5. 前端页面与路由（apps/frontend V2）

壳层判定：路径前缀 `/mall`(全屏手机壳+自己的底部导航)/ `/creator`(桌面宽壳+左侧导航)/ 其余 = consumer(手机壳，底部 Tab=首页/消息/我的)。

### 5.1 消费者手机壳（参考抖音，但为织梦定制）
```
/                       → 重定向 /home
/home                   首页信息流：顶部=头像入口(打开侧边抽屉)+搜索; tab 推荐/关注/热门(复用 V1 视觉，数据来自 /api/feed)
/post/:id               推文详情（内容/关联素材 3D与打版入口/评论/互动）
/search                 搜索页（作品/达人占位实现：调用 /api/mall/products kw + 用户）
/learn, /learn/*        学习中心（保留 V1 页面组件与 mock 课程；入口在抽屉与我的）
/messages               消息/通知列表（/api/notifications + 互动消息占位，带未读角标）
/me                     我的·个人主页（抖音风：封面卡 头像/昵称/认证/关注粉丝获赞；作品/喜欢/收藏三栏格子；创作者入口卡片；功能宫格：体型数据/偏好/收藏夹/订单/地址/设置/帮助）
/me/body                体型数据（手动 12 项表单 → /api 存 body；AI 拍照量体=模拟演示沿用 V1 UI 文字流程）
/me/preferences         设计偏好标签（本地）
/me/collections         收藏夹
/me/settings  /me/help  设置/帮助
/me/orders → /mall/orders  订单入口跳商城
登录/角色切换 /login     演示身份选择卡片（consumer 演示=14「我的小号」、creator=1「小织」、auditor=99）
```
**侧边抽屉**（home 头像/左上角 icon 打开，参考抖音从左侧滑出面板）：头部当前账号 + 宫格：商城 / 创作者平台 / 二手集市 / 学习中心 / 收藏夹 / 订单 / 设置；可切账号；底部协议。商城与创作者平台视为「独立网页」打开。

### 5.2 商城独立页（手机壳、自带底部导航：推荐 / 分类 / 购物车 / 我的；入口只来自侧边栏/消息/推文商品卡）
```
/mall/home              商城首页：搜索、金刚区(二手集市/私人定制/新品)、分类瀑布流商品卡(价格/销量/已售)
/mall/category?cat=     分类商品
/mall/product/:id       商品详情：轮播(images+3D/打版素材入口) → AI 详情(设计到生产故事/sections 折叠/规格表含国际尺码换算/部件面料/生产商) → 创作者信息+橱窗商品 → 「私人定制」说明卡(baseFee) → 评价占位 → 底部操作栏[加入购物车(direct)] [立即购买] [私人定制]
/mall/custom/:id        私人定制向导：Step1 体型(读 /me body/手动填写) → 调 /custom/adapt 显示调整表+fitAlerts(红色提示哪个规格不合适) → Step2 AI 交互(chat 面板: 想改部件/元素/面料 → options 选择 → 生成图预览/应用) → Step3 确认单(价格明细 price+baseFee=total, 定制条款=退货规则) → 支付成功 → 跳订单
/mall/cart /mall/checkout       购物车/结算（结算含地址占位、体型确认、条款）
/mall/orders            我的订单（状态筛选；条目卡：商品/状态/进度）
/mall/orders/:id        订单详情：状态时间轴/生产阶段进度/质检报告/物流/操作（收货/退货/换货定制）
/mall/orders/:id/return 退货单（展示退款=原价、扣基础费用说明）→ 完成 → 跳我的转售
/mall/orders/:id/exchange 换货重做确认 → 新定制单支付
/mall/resale            二手集市：active 列表（原价划线+标价+净得提示）购买流程(确认扣费清单 fee/net)
/mall/resale/mine       我的转售（原买家：改价/取消/已售记录/入账流水）
/mall/mine              商城个人页：订单入口/我的转售/收货地址/客服
```

### 5.3 创作者平台独立桌面网页（左侧深色/浅色导航 + 内容区，参考抖音创作者中心 + 桌面 BI）
```
/creator                总览：欢迎卡、快捷入口(发推文/导入素材/上橱窗/看数据)、待办(池提醒/审核中/被拒)、KPI 四卡
/creator/library        素材库：左侧文件树/筛选 kind；导入向导（拖拽/选择文件→真实解析 DXF/OBJ/SVG；上传 png/jpg；元数据卡片：图层/实体/预览）；PatternSvg 打版预览、OBJ 3D 查看器；删除/重命名/打标
/creator/works          作品组织：由素材组装 Work（选封面/打版素材/3D素材/标签/品类/面料/描述）
/creator/publish        发推文：内容、关联作品、图片（从素材库取 3D 快照与打版图）、标签；发布后展示「市场认可进度」= 当前赞/P60、评论/10 实时状态条
/creator/pool           资源池：入池作品卡（达标原因、时间、likeP60 与自身值），去上橱窗 CTA
/creator/window         橱窗材料：作品下拉 + 材料表单（真人穿搭图上传/选择、各部件面料、规格尺码表动态行、价格/基础费用、选择 3D 与打版素材）+ 提交审核；列表显示状态与审核意见；被拒可改再提交
/creator/products       商品管理：上架商品（AI 生成的详情可编辑非材料部分 detailEdits；材料变更=重新提交橱窗）下架/恢复；访问量/销量/佣金率
/creator/dashboard      数据看板(BI 桌面规范)：顶部日期范围(7/30/90)+单品筛选；KPI 卡行；左折线(成交额)右柱(销量)；退货趋势线；渠道饼图；明细表格(可排序)；「资源池重复度」提示条
/creator/commission     佣金：当前规则卡片(基础6%、上浮/下浮原因逐条列出、区间2%-10%)、可提现/待结算/流水表、提现弹窗
/creator/notifications  平台通知（含池提醒/审核结果/成交/售后）
/creator/settings       账号与工作室资料
```
桌面 BI 图表组件（无依赖 SVG）：LineChart、BarChart、DonutChart、SparkLine、KpiCard、DataTable——放 `src/components/shared/charts.tsx` 供 creator 使用。

### 5.4 共享组件
`src/components/shared/`：
- `ObjViewer.tsx`：输入 {positions,faces} 纯 canvas 旋转渲染（轨道旋转、自动旋转、缩放、双面着色、线框模式切换）。
- `PatternSvg.tsx`：SVG 打版图展示（平移/缩放/图例按图层色、尺寸标注开关）。
- `charts.tsx`（见上）。
- `MaterialBadge.tsx`：素材种类徽标(dxf/obj/svg/glb…)。
- `UploadBox.tsx`：文件选择/拖拽/类型校验（复用导入向导）。
- `assetUtils.ts`：图片 fallback、`img()`、`fmtCount` 等。
- `api/client.ts + api/types.ts`：类型+请求封装（fetch，token 注入，错误 toast 钩子）。
- mobile `SideDrawer.tsx`、`NavBar.tsx`、`TabBar(consumer/mall).tsx`、`ui.tsx/Sheet.tsx/Icon.tsx` 沿用 V1（保持品牌粉设计 token，全局 CSS 扩展 desktop/creator 断点样式）。

## 6. Seed 演示数据（后端启动/重置自动生成，贴近 iter_v2 示例）

- users：1 小织(creator, level3,头像 avatar-01) 2 鹿屿Lu(creator) 3 云端裁缝铺(creator level2) 4-13 达人/消费者（沿用 V1 昵称头像）14 我的小号(consumer——前端默认消费者身份，预置体型) 99 平台审核专员(auditor)。演示 creator 主账号=1。
- materials：为 creator1/2/3 预置 DXF 打版（连衣裙前片/后片/袖，衬衫、半裙等多品类）、OBJ（连衣裙/大衣 2 个网格，由程序生成简单参数化 mesh）、SVG 印花/logo、png/jpg 素材（引 /images 下服装图）。示例文件写入 `apps/backend/samples/*.dxf|*.obj|*.svg`，导入 demo 可直接使用。
- works/posts：creator1 有若干已入池作品与进行中作品（今日 2 篇推文点赞距 P60 一步之遥、1 篇高赞已入池制造演示差异）；其他创作者今日推文 8~12 篇形成 P60 分布。
- window/products：creator1 至少 2 件已上架商品（含 aiDetail 完整）、1 件审核中、1 件被拒；creator2/3 各有 1-2 件。
- orders/ledger/resale：过去 30 天订单与浏览事件种子（BI 图）；1 笔已收货定制订单（可演示退货→二手集市）；1 个 active 二手挂单。
- notifications：各演示账号数条未读。

> 生成的 sample OBJ/DXF 由后端程序在 seed 时构造并写入 `apps/backend/samples/`（保证可导入演示）。

## 7. 工程要求

- 代码可运行：`apps/backend` `./mvnw spring-boot:run`(8787)；`apps/frontend` `npm i && npm run dev`(5173, proxy /api 与 /ws)。`npm run build` 通过 tsc -b。
- 命名/视觉延续 V1 设计 token（rose 渐变 #F27BA0→#E85C87→#D44771、底 #F6F4F1、卡片白、标签色板）；creator 桌面另建浅灰工作台样式但同品牌色。
- 前端不直接写业务数据假数据（学习中心课程 mock 例外）；所有 v2 业务页面数据走 API。
- 移除：V1 的 /ranking、投票、品牌孵化相关页面与 mock；`App.tsx` 按 5.x 路由重建。
- 提交前删除无用旧文件；保留 public/images。
- 校验：后端 parse 失败要友好报错并写入 parseWarn；前端所有加载态/空态/错误 toast 齐备。
