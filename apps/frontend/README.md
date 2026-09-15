# 织梦 · 官方平台 V2（全栈前端）

依据 `apps/v2_0.md` 迭代。本仓库前端 = 三种独立网页形态，全部数据来自 `apps/backend`（Java / Spring Boot，端口 8787，Vite dev 将 `/api` 与 `/ws` 代理过去）。

## 快速开始

```bash
cd apps/backend && ./mvnw spring-boot:run      # 后端 http://localhost:8787（自动播种演示数据）
cd apps/frontend && npm install && npm run dev  # 前端 http://localhost:5173
```

## 演示账号

| id | 昵称 | 角色 |
|----|------|------|
| 1 | 小织 | 创作者（发推文/资源池/橱窗/商品/数据看板/佣金） |
| 14 | 我的小号 | 消费者（默认，预置体型，可演示私人定制→退货→二手） |
| 99 | 平台审核专员 | 审核员（`/creator/audit` 人工复核、数据重置） |

## 路由族（全部中文 UI）

### 消费者手机壳（底部 Tab：首页/消息/我的；左上角头像开侧边栏 → 商城/创作者中心(移动版)/二手集市/学习中心…）
```
/home  /post/:id  /search  /messages  /login
/me  /me/body（手动12项 + AI 量体演示） /me/preferences /me/collections /me/settings /me/help
/learn  /learn/course/:id  /learn/upload
```

### 创作者中心移动版（官方侧边栏入口；430 手机壳，底部 5 Tab：总览/作品/发布/橱窗/商品；镜像桌面功能）
```
/c/home  总览（KPI + 快捷宫格 + 待办）
/c/works 作品（品类联动风格标签；按品类分组；编辑/删除/去发布）
/c/publish 发推文（关联作品置顶、配图+预览一体、手动话题；下方「我的推文」近 1/3/7 天进度）
/c/window 橱窗材料（无原价/基础费字段、平台定价；被拒可删除）
/c/products 商品管理（状态/上下架/佣金率）
/c/library 素材库（本地/示例导入 DXF/OBJ/SVG…）  /c/pool 资源池（立即评估 + 去上橱窗）
```

### 商城独立页（自带底部导航：推荐/分类/购物车/我的；入口在侧边栏，参考抖音商城）
```
/mall/home  /mall/category  /mall/search
/mall/product/:id         商品详情：轮播 + 设计材料(3D/打版)弹层 + AI 详情折叠 + 规格表(国际码换算) + 直购/私人定制
/mall/custom/:id          私人定制四步向导：体型 → adapt 对照表 + fitAlerts(哪些规格不合适) → AI 交互改款/出图 → 确认付款
/mall/cart  /mall/checkout
/mall/orders  /mall/orders/:id(/return|/exchange)   订单/时间轴/质检/物流/演示推进/退货(退原价留基础费)/换货重做
/mall/resale  /mall/resale/mine(降价/下架/已售)  /mall/mine
```

### 创作者平台桌面网页（左导航 12 模块，BI 规范；保留用于打包原生桌面应用）
```
/creator                总览（KPI/待办/快捷入口；已移除资源池引擎与最近订单）
/creator/library        素材库 → 导入主流软件结果文件（DXF/OBJ/SVG…真实解析预览）
/creator/works          作品（说明文案+新建；风格标签随品类联动；按品类分组 + 编辑/删除管理）
/creator/publish        发推文（关联作品置顶/配图与预览合并/手动话题；右侧「我的推文」近 1/3/7 天进度 + 演示热度）
/creator/pool           资源池（引擎规则 + 立即评估 + 去上橱窗）
/creator/window         橱窗材料（真人穿搭图/部件面料/规格尺码 → 平台定价自动生成 → 系统审核 → AI 详情上架；被拒可删除）
/creator/products       商品管理（AI 详情非材料内容编辑 + 佣金率逐条原因 + 上下架）
/creator/dashboard      数据看板（7/30/90 天 BI：KPI/趋势/对比/退货/渠道/明细/池重复度）
/creator/commission     佣金（2%–10% 规则逐条 + 可提现/待结算/流水/提现）
/creator/notifications  通知  /creator/settings  设置与账号切换
/creator/audit          平台审核（auditor/admin：枚举 submitted 橱窗 → 人工复核）
```

## 结构要点

- `src/api/`：types（对齐契约）、client（模块化请求 + `zm_v2_token` Bearer）、session（useMe）
- `src/components/shared/`：ObjViewer(canvas 3D)、PatternSvg(打版预览)、MaterialViewer、UploadBox、charts(SVG BI)、MaterialBadge…
- `src/styles/`：global.css（品牌 token）+ mall.css + creator.css（桌面工作台）
- 详细契约见 `docs/ITER_V2_SPEC.md`；V2 流程设计与注意事项见 `../iter_v2.md`
