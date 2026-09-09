# 织梦 DreamWeaver · 项目结构

> 本文档描述当前主干（V2 全栈迭代）的目录结构、各模块职责与运行方式。
> 顶层入口文档：产品需求（`apps/v2_0.md`）、全栈实现契约（`apps/frontend/docs/ITER_V2_SPEC.md`）。

## 1. 总览

```
DreamWeaver/
├── README.md                       # 平台定位 + V2 全栈快速开始
├── .gitignore
│
├── apps/
│   ├── v1.md                       # V1：官方平台 PRD（历史文档）
│   ├── v2_0.md                     # V2 迭代需求（流程设计的唯一来源，原 iter_v2.md）
│   ├── server/                     # V2 后端（Node 22 + Express + TS，端口 8787）
│   ├── frontend/                   # V2 官方前端（React 19 + TS + Vite，端口 5173）
│   │                               #   = 消费者手机壳 + 商城独立页 + 创作者平台（桌面）+ 创作者中心（移动）
│   └── designer/                   # V1 遗留：自研服装设计师 App（V2 已暂停接入，保留演示）
│
└── tools/
    └── screenshot/                 # Playwright QA/截图工作台（不入库产物：shots*）
```

## 2. apps/server —— 后端服务

```
apps/server/
├── package.json / tsconfig.json / .gitignore / README.md
├── data/
│   └── db.json                     # 运行时持久化（JSON 文件库，gitignore）
├── samples/                        # seed 自动生成的真实示例文件（供素材库导入演示）
│   ├── dress-front-pattern.dxf     # 连衣裙前片打版（含 bulge 圆弧）
│   ├── shirt-front.dxf             # 衬衫版片
│   ├── dress.obj                   # 参数化 3D 网格
│   └── floral-print.svg            # 印花 SVG
└── src/
    ├── index.ts                    # Express 入口：CORS/JSON/公开接口白名单/404/启动
    ├── types.ts                    # 领域模型（用户/素材/作品/推文/资源池/橱窗/商品/订单/二手/通知…）
    ├── db/
    │   ├── store.ts                # 内存库 + JSON 原子写盘（debounce 300ms）
    │   └── seed.ts                 # 演示数据播种（19 用户/素材/作品/推文/订单/商品…）
    ├── middleware/auth.ts          # Bearer token、登录守卫、角色守卫
    ├── parsers/                    # 纯 TS 文件解析器
    │   ├── dxf.ts                  # DXF R12：LAYER/LINE/LWPOLYLINE(bulge 圆弧)/CIRCLE/ARC… → patternSvg
    │   ├── obj.ts                  # OBJ → 轻量三角网格（positions/faces）
    │   ├── svg.ts / image.ts / meta.ts / samples.ts / index.ts
    ├── engine/                     # 业务引擎（各模块相互独立、可测试）
    │   ├── pool.ts                 # 资源池：P60 分位 + 增量/定时评估（点赞>P60 或评论≥10 入池）
    │   ├── window.ts               # 橱窗完整性审核（缺失即拒绝，缺失项列明）
    │   ├── aiProduct.ts            # AI 商品详情页生成（面料/工艺/规格/生产模板）
    │   ├── custom.ts               # 私人定制：品类松量 → 基码匹配 → fitAlerts 不适配预警 → AI 改款
    │   ├── orderflow.ts            # 订单创建/支付/状态机/履约阶段推导
    │   ├── aftercare.ts            # 退货（退原价留基础费）/换货重做（再收基础费）/取消
    │   ├── resale.ts               # 二手集市：退货自动挂单（75%）/降价/成交结算
    │   ├── commission.ts           # 佣金 2%-10%：转化/退货率/池内样式重复度 KPI 管线
    │   ├── dashboard.ts            # 变现数据看板聚合（7/30/90 天）
    │   ├── scheduler.ts / dailyJobs.ts / helpers.ts(通知/资金流水)
    ├── routes/                     # REST 路由（前缀 /api，{ok:true,data}|{ok:false,code,msg}）
    │   ├── index.ts                # 路由装配
    │   ├── auth.ts / users.ts / materials.ts / works.ts / feed.ts
    │   ├── pool.ts / window.ts / products.ts / custom.ts / orders.ts
    │   ├── resale.ts / notifications.ts / creator.ts / admin.ts / dto.ts
    └── utils/                      # resp(统一响应/错误中间件) / misc / time
```

运行：`cd apps/server && npm run dev`（tsx watch）或 `npm start`（node dist）。端口 **8787**。

## 3. apps/frontend —— V2 官方前端（重命名自 apps/official）

单一 Vite 应用，按路径前缀分三种形态：

| 路由前缀 | 形态 | 说明 |
|---|---|---|
| `/`（/home 等） | 消费者手机壳 430px | 底部 Tab：首页/消息/我的；左侧滑出侧边栏 |
| `/mall*` | 商城独立页 | 自带底部导航 推荐/分类/购物车/我的 |
| `/creator/*` | 创作者平台桌面网页 | 左导航 12 模块（保留，供打包原生桌面应用） |
| `/c/*` | 创作者中心移动版 | 官方侧边栏进入，底部 5 Tab：总览/作品/发布/橱窗/商品 |

```
apps/frontend/
├── package.json / vite.config.ts(dev 代理 /api → 8787) / tsconfig*.json
├── index.html / public/images/*      # 静态资源（84 张服装/头像图）
├── docs/
│   ├── ITER_V2_SPEC.md               # 全栈实现契约（数据模型/API/路由/Seed）
│   └── CONTRACT.md
├── scripts/                          # V1 图片下载脚本（历史遗留）
└── src/
    ├── main.tsx / App.tsx            # 入口 + ModeRoot 按路径分发三种形态
    ├── api/
    │   ├── types.ts                  # API 数据类型（对齐契约）
    │   ├── client.ts                 # fetch 封装 + 分模块 API（token、分页、GET 参数修正）
    │   └── session.tsx               # useMe() 会话（登录态/未读/登出）
    ├── components/
    │   ├── Icon.tsx / ui.tsx / Sheet.tsx / NavBar.tsx / TabBar.tsx
    │   ├── MallTabBar.tsx / SideDrawer.tsx
    │   └── shared/                   # 素材/图表共享组件
    │       ├── ObjViewer.tsx         # canvas 3D 网格查看器（无 WebGL 依赖）
    │       ├── PatternSvg.tsx        # DXF/SVG 打版图查看器
    │       ├── MaterialViewer.tsx / MaterialBadge.tsx / UploadBox.tsx
    │       ├── charts.tsx            # SVG BI 图表（Line/Bar/Donut/KPI/Table）
    │       └── utils.tsx
    ├── pages/
    │   ├── consumer/                 # 首页信息流/推文详情/搜索/消息/登录/我的/体型/偏好/收藏/设置/帮助
    │   ├── mall/                     # 商城首页/分类/搜索/商品详情/私人定制向导/购物车/结算/订单/退换货/二手集市/我的
    │   ├── creator/                  # 创作者平台桌面 12 模块
    │   ├── mcreator/                 # 创作者中心移动版 7 页（镜像桌面，含素材库/资源池）
    │   ├── learn/                    # 学习中心（V1 页面保留 + mock 课程）
    │   └── NotFoundPage.tsx
    ├── data/courses.ts               # 学习中心课程数据
    ├── styles/                       # global.css（品牌 token）/ creator.css（桌面工作台+mc-* 移动）/ mall.css
    └── utils/                        # store.tsx / v2.ts（本地购物车等）
```

运行：`cd apps/frontend && npm run dev`，端口 **5173**，`/api` 代理到 8787。

## 4. apps/designer —— V1 遗留创作工具

```
apps/designer/                        # 自研服装设计师 App（V2 已按 iter_v2 暂停接入，保留演示）
├── src/pages/design/                 # 首页(项目中心)/2D 画布/素材库/3D 模拟/作品+工艺单/创作链路 Pipeline
├── src/components/design/            # DressCanvas(参数化 SVG 引擎)/ParamPanel/DesignerNav
├── src/data/                         # 品类/版片/草图/工艺单 mock 数据
└── src/utils/                        # 设计稿/草图 store
```

## 5. tools/screenshot —— 验证工作台

```
tools/screenshot/
├── shot.mjs                  # 按 CSV 路由清单截图
├── pages*.csv / pages-v2.csv # 各版本截图路由清单
├── qa-v2.mjs                 # 消费者+商城 DOM 回归（14 页）
├── qa-v2-creator.mjs         # 创作者桌面回归（13 页）
├── qa-v2-mcreator.mjs        # 创作者中心移动回归（10 页）
├── *.mjs（smoke/design-smoke 等） # V1 冒烟（历史遗留）
└── shots-*/                 # 截图产物（gitignore，不入库）
```

使用：`PLAYWRIGHT_BROWSERS_PATH=../../.pw-browsers node qa-v2.mjs http://localhost:5173`

## 6. 运行总览（端口）

| 服务 | 目录 | 命令 | 地址 |
|---|---|---|---|
| 后端 API | `apps/server` | `npm run dev` | http://localhost:8787/api/health |
| 官方前端 | `apps/frontend` | `npm run dev` | http://localhost:5173 |
| 设计师 App(V1) | `apps/designer` | `npm run dev` | http://localhost:5174 |

演示账号：`1` 小织（创作者）· `14` 我的小号（消费者）· `99` 平台审核专员。

## 7. 生成/忽略目录（不入库）

`node_modules/` · `dist/` · `apps/server/data/db.json` · `apps/server/samples/*`（seed 生成）· `.pw-browsers/` · `.npm-cache/` · `tools/screenshot/shots*` · `.ssh-deploy/`（本地部署密钥）
