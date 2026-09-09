# 织梦 App · 模块开发契约（Contract）

本契约定义了共享基础设施与约定。所有模块页面必须严格遵循，以保证 5 个模块并行开发后可直接集成。

## 1. 技术栈与运行

- React 19 + TypeScript + Vite，路由 `react-router-dom`（HashRouter）
- 样式：CSS 变量 + 行内样式为主，全局类见 `src/styles/global.css`
- 图片：本地文件 `/images/*.jpg`（public 目录），用 `img(name)` 辅助函数生成路径
- 手机容器：`.app-shell`（max-width 430px 居中）。**不要**设置 body/html 宽度或引入外部布局

## 2. 文件与路由（不得新增/修改 App.tsx）

| 路由 | 文件（`src/pages/<模块>/<文件>.tsx`，默认导出组件） |
|---|---|
| /plaza | `plaza/PlazaPage.tsx` |
| /plaza/post/:id | `plaza/PostDetailPage.tsx`（useParams 取 id） |
| /plaza/publish | `plaza/PublishPage.tsx` |
| /search | `plaza/SearchPage.tsx` |
| /ranking | `ranking/RankingPage.tsx` |
| /work/:id | `ranking/WorkDetailPage.tsx`（榜单+商城共用作品详情） |
| /learn | `learn/LearnPage.tsx` |
| /learn/course/:id | `learn/CourseDetailPage.tsx` |
| /learn/upload | `learn/UploadTutorialPage.tsx` |
| /mall | `mall/MallPage.tsx` |
| /cart | `mall/CartPage.tsx` |
| /checkout | `mall/CheckoutPage.tsx` |
| /orders | `mall/OrderListPage.tsx` |
| /orders/:id | `mall/OrderDetailPage.tsx` |
| /orders/:id/aftersale | `mall/AfterSalePage.tsx` |
| /profile | `profile/ProfilePage.tsx` |
| /profile/body | `profile/BodyMeasurementPage.tsx` |
| /profile/preferences | `profile/PreferencesPage.tsx` |
| /profile/collections | `profile/CollectionsPage.tsx` |
| /profile/works | `profile/MyWorksPage.tsx` |
| /profile/dashboard | `profile/CreatorDashboardPage.tsx` |
| /profile/commission | `profile/CommissionPage.tsx` |
| /profile/settings | `profile/SettingsPage.tsx` |
| /profile/help | `profile/HelpPage.tsx` |
| /messages | `profile/MessagesPage.tsx` |
| /profile/following | `profile/FollowingPage.tsx` |

带底部 Tab 的页面（plaza/ranking/learn/mall/profile）需给 `.page` 加 padding-bottom（global.css 已处理）；无 Tab 的子页面用 `.page.no-tab`。TabBar 已由 TabLayout 渲染，页面内不要自己渲染 TabBar。

## 3. 共享组件 API（`src/components/`）

- `Icon`（默认导出）：`<Icon name="heart" size={20} color="..." strokeWidth={1.8}/>`。可用名字见 `src/components/Icon.tsx` 的 `IconName`。
- `ui.tsx` 具名导出：
  - `Avatar({src, size?, name?, ring?})`
  - `Tag({children, variant?: 'primary'|'gold'|'gray'|'success'|'danger'|'info'|'line', icon?})`
  - `Price({value, size?, symbol?})`（显示 ¥ 价格）
  - `EmptyState({icon?, title, desc?, action?})`
  - `SectionHeader({title, extra?, onClick?})`
  - `CertBadge({level})`（设计能力认证徽章 0-3）
  - `StatCell({label, value, sub?, color?})`
- `NavBar`（默认导出）：`<NavBar title="..." back right={<.../>}/>`
- `Sheet.tsx` 具名导出：
  - `useToast()` → `const toast = useToast(); toast('文案', 'check'?)`
  - `Sheet({open, onClose, title?, children, height?})` 底部弹层
  - `Segmented({options:[{value,label}], value, onChange, size?, equal?})`
  - `CountButton({icon, activeIcon, count, active, color?, activeColor?, onToggle, size?})` 点赞/收藏按钮
- `utils/store.ts` 具名导出：
  - `useLocalState<T>(key, initial)`
  - `K` 键名常量、`isIn(key, id)`、`toggleId(key, id)`（点赞收藏投票持久化）
  - `useCart()` → `{items, add, update, remove, clear, count}`
  - `useBody()` → `[body, setBody]`；`BODY_FIELDS`（12项字段定义）；`recommendSize(body)`
- 通用样式类：`row col flex-1 gap-* text-2 text-3 bold ellipsis ellipsis-2 card btn btn-* tag tag-* divider divider-gap page page-body page.no-tab price fade-in mt-*`

## 4. 数据（`src/data/mock.ts` 与 `src/data/types.ts`）

- `users: User[]`、`userById(id)`、`me`（当前登录用户 id=14）
- `works: Work[]`、`workById(id)`、`worksByCreator(creatorId)`；`Work` 含 title/category/styleTags/fabric/price/cover/colors/sizes/sales/likes/collects/views/desc/isCustom/returnRate/productionDays
- `posts: Post[]`、`postById(id)`、`commentsByPost: Record<number, Comment[]>`
- `rankings: RankingItem[]`（周榜）、`rankingByPeriod: Record<1|2|3, RankingItem[]>`
- `courses: Course[]`、`STYLE_TAGS`、`CATEGORIES`、`messages: MessageItem[]`、`BG_SCENES`（6种3D背景）
- `orders: Order[]`、`orderById(id)`、`ORDER_STATUS_TEXT`
- `dashboard: DashboardData`（创作者后台 KPI）、`initialCart`

## 5. 交互状态约定

- 点赞/收藏/投票持久化：`isIn(K.likedPosts, postId)` / `toggleId(...)`，配合本地 state 驱动 UI。作品用 `K.likedWorks/collectedWorks`，推文用 `K.likedPosts/collectedPosts`，投票用 `K.votedWorks`。
- 购物车用 `useCart()`。
- 体型数据用 `useBody()`。
- 反馈用 `useToast()`。

## 6. 视觉规范

- 品牌色 `--brand:#E85C87`，渐变 `--brand-grad`；背景 `--bg:#F6F4F1`；卡片白底圆角 `--r-lg`
- 主按钮 `btn btn-primary`（渐变圆角胶囊）；页面底部操作栏：fixed 底部 + safe-area
- 列表分隔用 `.divider` 或 `.divider-gap`
- 数字高亮用 `.price`（`Price` 组件）
- 所有交互要有 toast 反馈与 hover/active 反馈；图片加 `img-ph` 类或 onError 兜底
- 文案使用简体中文，语气符合女性向服装社区（小红书风格）
- 页面统一结构：`<div className="page no-tab"><NavBar back .../><div className="page-body">...</div></div>`；Tab 页 `<div className="page">...</div>`

## 7. 禁止事项

- 不修改 `App.tsx`、`main.tsx`、`global.css`、`data/mock.ts`、`data/types.ts`、`utils/store.ts`、共享组件
- 不引入新 npm 依赖
- 不新增路由（如有新页面需求，复用现有路由或合并进现有页面）
- 图表等复杂可视化用纯 CSS/SVG 实现（禁止 canvas 库）
