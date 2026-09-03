# 织梦 · 官方平台 App（移动端 H5 原型）

基于《官方平台App PRD》开发的移动端应用原型。女性向「个性化服装设计 + 学习 + 创作者变现」平台，
打通「学习 → 设计 → 生产 → 变现」全链路，核心差异化：**C2M 按需生产零库存 + 3D 虚拟试衣 + 创作者佣金生态**。

## 技术栈

- React 19 + TypeScript + Vite 8
- react-router-dom（HashRouter，支持静态部署）
- 纯 CSS 设计系统 + 行内 SVG 图标，无 UI 库依赖
- 移动优先：桌面端居中显示手机宽度（max-width 430px），移动端全屏

## 快速开始

```bash
cd zhimeng-app
npm install
npm run dev        # http://localhost:5173
npm run build      # 产物在 dist/，可静态部署
```

## 功能模块（5 大 Tab）

| Tab | 页面 | 核心能力 |
|-----|------|----------|
| 首页 | 广场 | 推荐/关注/热门信息流、推文详情（点赞/收藏/评论/转发）、发布推文（关联作品/标签）、全局搜索 |
| 榜单 | 设计榜单 | 周榜/月榜/总榜、品类/风格/价格筛选、每日10票投票、热度算法 |
| 榜单 | 作品详情 | 3D 预览模拟（旋转/缩放）、6 种 3D 背景切换、**一键适配自身体模**、智能尺码推荐、加购/购买 |
| 学习 | 学习中心 | 阶梯式课程（入门/进阶/高级）、视频播放模拟（倍速/进度续播）、学习进度与能力认证、教程上传（创作者） |
| 商城 | 商城 | Banner/品类导航/瀑布流、购物车、下单结算（体型确认+定制条款）、订单跟踪 |
| 商城 | 订单 | 全流程状态时间轴、**生产进度跟踪**（裁剪→缝制→质检→发货）、质检报告、物流轨迹、售后申请 |
| 我的 | 个人中心 | 体型数据采集（手动12项/AI拍照量体模拟）、偏好标签、收藏夹、作品集、关注 |
| 我的 | 创作者后台 | KPI 面板（成交额/转化率/排名/成交量/退货率）、7日成交量折线、30日柱状、退货分析、渠道饼图、佣金与提现 |
| 我的 | 品牌孵化 | 申请条件与流程入口 |
| — | **服装设计App（创作工具端）** | 独立入口：我的 → 织梦·设计创作台 |
| 设计 | 首页·灵感 | 新建设计（6 品类）、AI 生成入口、热门模板、灵感瀑布流 |
| 设计 | **设计工作台** | 参数化设计（**6 品类 × 18 类款式元素**实时驱动 SVG 3D 服装）、撤销/重做、保存 |
| 设计 | AI 工具箱 | 文生图（5 款候选一键应用）、草图优化、风格融合、**一人一版**（体型驱动版型） |
| 设计 | 3D 试衣间 | 虚拟人台（体型数据）、6 场景背景、拖动旋转、动态展示动画、垂坠/光泽/弹性物理调节 |
| 设计 | 我的作品 | 设计稿管理、**一键同步至官方App个人作品页**、删除/编辑 |

## 目录结构

```
zhimeng-app/
├── src/
│   ├── components/
│   │   ├── design/    # 服装设计App：DressCanvas 参数化引擎 / ParamPanel / DesignTabBar
│   │   └── …官方App共享组件（Icon/ui/NavBar/TabBar/Sheet 等）
│   ├── data/
│   │   ├── types.ts + mock.ts   # 官方App 数据
│   │   └── design.ts            # 设计App：18类元素/6品类/面料物理库/AI候选
│   ├── pages/
│   │   ├── plaza/ ranking/ learn/ mall/ profile/  # 官方App 模块
│   │   └── design/              # 设计App：StudioPage 工作台 / TryonPage 试衣间 …
│   ├── styles/        # 设计系统
│   ├── utils/         # store.tsx + designStore.tsx（设计稿持久化与跨端同步标记）
│   └── App.tsx        # 路由（官方App + /design/* 设计App）
├── public/images/     # 本地图片素材（Unsplash 精选服装图）
└── docs/CONTRACT.md   # 并行开发契约
```

## 设计说明

- 品牌色：玫瑰粉渐变 `#F27BA0 → #E85C87 → #D44771`，暖灰底 `#F6F4F1`
- 全部数据为前端 mock（localStorage 持久化交互状态），可无缝替换为真实 API
- 官方App的 3D 预览为交互模拟；服装设计App的服装为**参数化 SVG 引擎实时重建**（18 类元素驱动几何），真实 3D 渲染建议后续按 PRD 接入原生 3D 引擎（SceneKit/Filament + glTF）
- 跨端流转：设计App保存/同步的设计稿（params JSON）写入官方App「我的作品集」并可被发布推文关联，体现"设计 → 上架 → 变现"闭环

## 验证工具

```bash
cd ../tools/screenshot
PLAYWRIGHT_BROWSERS_PATH=../../.pw-browsers node shot.mjs http://localhost:5173 pages.csv shots
```
