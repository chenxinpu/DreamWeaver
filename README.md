# 织梦 DreamWeaver · 个性化服装设计 + 创作变现平台

面向女性用户的一站式个性化服装设计 / 学习 / 创作者变现平台，以「人人皆可参与设计、按需生产零库存」为核心，打通 **导入设计成果 → 发布验证 → 资源池 → 橱窗审核 → AI 商品详情 → 商城直购/私人定制 → 订单履约 → 售后与二手流转** 全链路。

本仓库主干即 **V2 全栈迭代**（依据 `v1_1.md` 实现）：官方端呈现 3D 图与打版图，创作者平台素材库支持导入主流服装 CAD（CLO 3D / Gerber / Lectra 等）导出的 **DXF / OBJ / SVG** 等成果文件；商城与创作者平台都是独立网页形态（参考抖音），商城入口在侧边栏而非底部 Tab；「我的」参考抖音个人主页；已删除品牌孵化与投票打榜。

## 架构

```
        前端 React SPA  (:5173)
              │  /api/*        /ws
              ▼                ▼
   ┌──────────────────────────────────────────────┐
   │  apps/backend   Java 21 · Spring Boot 3 · 8787 │  ← 唯一后端入口
   │   ① 业务逻辑    ② BFF 聚合层    ③ 实时通信      │
   └───────────────────────┬────────────────────────┘
                           │ Spring Data JPA / Hibernate
                           ▼
   ┌──────────────────────────────────────────────┐
   │  MySQL 8.4 · 3306 · 库 dreamweaver             │
   │  39 张 dw_* 表（15 主表 + 24 张集合表）          │
   └──────────────────────────────────────────────┘
                           ▲
                           │ HTTP（仅 AI 生成类能力）
              ┌────────────┴───────────────┐
              │  apps/ai  Python · FastAPI │  AI 商品详情页生成 /
              │  :8789                     │  量体裁衣对话 / 款式变体图
              └────────────────────────────┘
```

**后端严格按教科书分层**，依赖方向单向：

```
controller  →  service（接口 + impl）  →  repository（Spring Data JPA）  →  entity（@Entity）  →  MySQL
 参数解析        业务规则 / 事务边界          数据访问                           ORM 映射
```

- `controller/` 只做「取登录态 → 调 service → 包 `ApiResponse`」，**不注入 repository**，方法体 ≤10 行
- `service/` + `service/impl/`：全部业务规则与 `@Transactional` 事务边界
- `repository/`：15 个 JPA 接口，只放查询方法；`entity/`：15 张表映射
- 标量集合用 `@ElementCollection`+`@OrderColumn`（保证 `photos[0]` 等顺序语义），嵌套值对象落 MySQL `JSON` 列

详见 [`apps/backend/README.md`](apps/backend/README.md) 与 [`apps/backend/ENTITY_MAPPING.md`](apps/backend/ENTITY_MAPPING.md)。

## 快速开始

**环境要求**：JDK 21 · MySQL 8.x · Python 3.11+（本机 3.13）· Node ≥ 18（本机 22，仅前端需要）。
MySQL 无需自行安装配置：`tools/dev/mysql.sh` 会用本机 MySQL 程序在工作区 `.tools/mysql/` 内初始化并管理实例。
Java 工具链同样无需手工配置：`tools/dev/java-env.sh` 会自动定位 JDK 21（优先系统安装，回退到工作区内 `.tools/jdk/`），
并把 Maven 本地仓库与 wrapper 缓存都放在工作区内的 `.tools/` 下，不污染系统环境。

```bash
# 一键启动 MySQL(3306) + 后端(Java 8787) + AI(Python 8789)，日志在 .tools/logs/
./tools/dev/services.sh start

# 查看状态与聚合健康
./tools/dev/services.sh status

# 前端（Vite 把 /api 与 /ws 都代理到 8787）
cd apps/frontend && npm install && npm run dev      # http://localhost:5173
```

首次运行会自动完成：MySQL 实例初始化与建库、Python 虚拟环境依赖安装、JPA 自动建表（39 张 `dw_*`）、
演示数据播种（**19 用户 / 16 素材 / 7 作品 / 19 推文 / 126 评论 / 6 橱窗 / 4 商品 / 135 订单 / 2 二手挂单**）、
`apps/backend/samples/` 示例文件生成。数据全部落在 MySQL，可用 `./tools/dev/mysql.sh cli` 直接查看。

演示账号（登录页 / 侧边栏 / 创作者设置里可切换）：

| id | 账号 | 角色 | 用途 |
|----|------|------|------|
| 1 | 小织 | 创作者 | 素材库导入 → 发推文 → 资源池 → 橱窗 → 商品 → 数据看板/佣金 |
| 14 | 我的小号 | 消费者 | 逛商城 / 私人定制 / 订单 / 退货 → 二手集市 |
| 99 | 平台审核专员 | 审核员 | 橱窗人工复核（`/creator/audit`）、数据重置 |

## 产品流程（按 v1_1.md 实现）

**创作变现**
素材导入（素材库，支持 DXF R12 含 bulge 圆弧/图层还原、OBJ 网格、SVG、图片、glb 元数据）→ 发推文（3D 图/打版图来自素材库 + 标签）→ **点赞超过当日推文点赞 P60 或评论 ≥ 10 → 系统自动纳入资源池**（每日 00:05 + 互动/发帖增量评估）→ 通知提醒准备橱窗材料 → 材料（真人穿搭图 / 各部件面料 / 成衣规格尺码表 / 3D 与打版文件 / 原价 / 基础费用）**系统自动审核** → 通过即 **AI 生成商品详情页**（设计到生产故事/面料工艺规格/生产商/基础费用说明）上架商城 → 创作者可编辑非材料内容，材料变更需重新审核 → **变现数据看板**（7/30/90 天 BI：KPI 卡/成交额趋势/销量对比/退货趋势/渠道/明细表） + **佣金 2%–10%**（基础 6%，转化销量上浮、退货率与资源池样式重复度下浮，逐条展示原因）。

**私人定制**
商品详情页「直接购买」或「私人定制」→ 输入体型 → 系统按品类松量自动推算成品规格并**主动提示哪个规格可能不合适**（tight/loose + fitAlerts）→ AI 交互改部件/设计元素/面料并**生成款式图** → 确认后付全款 = 原价 + 基础费用 → 全流程履约（生产 → 质检 → 物流 → 收货）。**退货只退原价（基础费用不退）**；**换货重新定制再收一次基础费用**；退货成衣**自动进入二手集市**（默认标价 原价 × 75%，成交抽取 8% 仓储物流佣金，余款退原买家，可自行降价）。

**信息架构**
- 消费者手机壳：底部 Tab = 首页(广场信息流) / 消息(通知) / 我的(抖音风个人主页)；左侧滑出侧边栏 = 商城 / 创作者中心(移动版 `/c/*`) / 二手集市 / 学习中心 / 订单 / 设置… 入口。
- 商城独立页（自带底部导航：推荐 / 分类 / 购物车 / 我的）：首页/分类/搜索/商品详情（AI 详情 + 3D/打版素材查看 + 直购 + 私人定制向导）/订单（时间轴、质检、物流、售后）/二手集市（浏览、购买、我的转售改价）。
- 创作者中心桌面版（`/creator`，12 模块，BI 规范，保留用于后续打包原生桌面应用）：总览/素材库/作品/发推文/资源池/橱窗材料/商品管理/数据看板/佣金/通知/设置/审核。
- 创作者中心移动版（`/c/*`，430 手机壳，官方侧边栏「创作者中心」进入，镜像桌面功能）：总览/作品/发布/橱窗/商品 底部 5 Tab + 素材库/资源池。

## 技术栈

- 前端：React 19 + TypeScript + Vite；react-router HashRouter；纯 CSS 设计系统（品牌玫瑰粉渐变）+ 行内 SVG；无 UI 库依赖
- 素材预览：DXF → SVG 打版图、OBJ → 自研 canvas 3D 查看器（旋转/缩放/线框），解析在 Java 完成
- 图表：自研 SVG（Line/Bar/Donut/Spark/KPI/Table），桌面 BI 无第三方依赖
- 后端：Java 21 + Spring Boot 3 + Maven Wrapper；**严格教科书分层**（controller / service+impl / repository / entity / dto）；
  ORM 用 Spring Data JPA（Hibernate 6.5），数据库 MySQL 8.4；标量集合 `@ElementCollection`+`@OrderColumn`，嵌套值对象落 MySQL JSON 列；
  自研 DXF/OBJ/SVG 解析器（纯 JDK）；Spring WebSocket 实时通道
- AI 服务：FastAPI + uvicorn + Pydantic；商品详情页文案生成 / 定制对话 / 款式变体 SVG 出图

## 目录结构

```
apps/
  backend/     【Java】唯一后端：业务 + BFF 聚合 + WebSocket + JPA（8787）
  ai/          【Python】AI 生成类能力 · FastAPI（8789）
  frontend/    React 19 + TS + Vite 前端（5173）
tools/
  dev/         services.sh（一键启停 MySQL+后端+AI）· mysql.sh · java-env.sh
  smoke/       stack-smoke.mjs（端到端冒烟）
  screenshot/  Playwright QA/截图（qa-v2 / qa-v2-creator / qa-v2-mcreator）
```

## 验证

```bash
node tools/smoke/stack-smoke.mjs            # 端到端冒烟（后端 + AI 全链路）
node apps/backend/scripts/ws-smoke.mjs      # WebSocket 协议自测

cd tools/screenshot                          # 前端回归（需前端运行于 5173）
PLAYWRIGHT_BROWSERS_PATH="$PWD/../../.pw-browsers" node qa-v2.mjs http://localhost:5173
PLAYWRIGHT_BROWSERS_PATH="$PWD/../../.pw-browsers" node qa-v2-creator.mjs http://localhost:5173
PLAYWRIGHT_BROWSERS_PATH="$PWD/../../.pw-browsers" node qa-v2-mcreator.mjs http://localhost:5173
```
