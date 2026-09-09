/* ============================================================================
 * 织梦 DreamWeaver V2 · 应用路由
 * 壳判定：/mall = 商城独立页（430 手机壳 + MallTabBar）；/creator = 创作者桌面端；
 *          其余 = 消费者壳（底部 Tab：首页 / 消息 / 我的）
 * ==========================================================================*/
import { HashRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/Sheet';
import { MeProvider, useMe } from './api/session';
import { SideDrawerProvider } from './components/SideDrawer';
import TabBar from './components/TabBar';
import MallTabBar from './components/MallTabBar';
import { useCart } from './utils/v2';

/* 消费者页面 */
import HomePage from './pages/consumer/HomePage';
import PostDetailPage from './pages/consumer/PostDetailPage';
import SearchPage from './pages/consumer/SearchPage';
import MessagesPage from './pages/consumer/MessagesPage';
import LoginPage from './pages/consumer/LoginPage';
import MePage from './pages/consumer/MePage';
import BodyPage from './pages/consumer/BodyPage';
import PreferencesPage from './pages/consumer/PreferencesPage';
import CollectionsPage from './pages/consumer/CollectionsPage';
import SettingsPage from './pages/consumer/SettingsPage';
import HelpPage from './pages/consumer/HelpPage';

/* 学习中心（V1 保留） */
import LearnPage from './pages/learn/LearnPage';
import CourseDetailPage from './pages/learn/CourseDetailPage';
import UploadTutorialPage from './pages/learn/UploadTutorialPage';

/* 商城页面 */
import MallHomePage from './pages/mall/MallHomePage';
import MallCategoryPage from './pages/mall/CategoryPage';
import MallSearchPage from './pages/mall/MallSearchPage';
import MallProductPage from './pages/mall/ProductPage';
import CustomPage from './pages/mall/CustomPage';
import MallCartPage from './pages/mall/CartPage';
import MallCheckoutPage from './pages/mall/CheckoutPage';
import MallOrdersPage from './pages/mall/OrdersPage';
import MallOrderDetailPage from './pages/mall/OrderDetailPage';
import ReturnExchangePage from './pages/mall/ReturnExchangePage';
import ResalePage from './pages/mall/ResalePage';
import ResaleMinePage from './pages/mall/ResaleMinePage';
import MallMinePage from './pages/mall/MallMinePage';

/* 创作者平台（桌面宽壳，§5.3：总览/素材库/作品/发推文/资源池/橱窗/商品/看板/佣金/通知/设置/审核） */
import CreatorLayout, { CreatorScope, StaffScope } from './pages/creator/CreatorLayout';
import OverviewPage from './pages/creator/OverviewPage';
import LibraryPage from './pages/creator/LibraryPage';
import WorksPage from './pages/creator/WorksPage';
import PublishPage from './pages/creator/PublishPage';
import PoolPage from './pages/creator/PoolPage';
import WindowPage from './pages/creator/WindowPage';
import ProductsPage from './pages/creator/ProductsPage';
import DashboardPage from './pages/creator/DashboardPage';
import CommissionPage from './pages/creator/CommissionPage';
import NotificationsPage from './pages/creator/NotificationsPage';
import CreatorSettingsPage from './pages/creator/SettingsPage';
import AuditPage from './pages/creator/AuditPage';
import NotFoundPage from './pages/NotFoundPage';

/* 创作者中心（移动版，/c*：430 手机壳，SideDrawer「创作者中心」入口跳 /c/home） */
import MCreatorLayout from './pages/mcreator/layout';
import MHomePage from './pages/mcreator/HomePage';
import MWorksPage from './pages/mcreator/WorksPage';
import MPublishPage from './pages/mcreator/PublishPage';
import MWindowPage from './pages/mcreator/WindowPage';
import MProductsPage from './pages/mcreator/ProductsPage';
import MLibraryPage from './pages/mcreator/LibraryPage';
import MPoolPage from './pages/mcreator/PoolPage';

export default function App() {
  return (
    <ToastProvider>
      <MeProvider>
        <HashRouter>
          <SideDrawerProvider>
            <ModeRoot />
          </SideDrawerProvider>
        </HashRouter>
      </MeProvider>
    </ToastProvider>
  );
}

/* ---------- 按路径判定壳模式 ---------- */
function ModeRoot() {
  const location = useLocation();
  const path = location.pathname;
  if (path.startsWith('/creator')) {
    return (
      <Routes>
        <Route path="/creator" element={<CreatorLayout />}>
          <Route index element={<CreatorScope><OverviewPage /></CreatorScope>} />
          <Route path="audit" element={<StaffScope><AuditPage /></StaffScope>} />
          <Route path="library" element={<CreatorScope><LibraryPage /></CreatorScope>} />
          <Route path="works" element={<CreatorScope><WorksPage /></CreatorScope>} />
          <Route path="publish" element={<CreatorScope><PublishPage /></CreatorScope>} />
          <Route path="pool" element={<CreatorScope><PoolPage /></CreatorScope>} />
          <Route path="window" element={<CreatorScope><WindowPage /></CreatorScope>} />
          <Route path="products" element={<CreatorScope><ProductsPage /></CreatorScope>} />
          <Route path="dashboard" element={<CreatorScope><DashboardPage /></CreatorScope>} />
          <Route path="commission" element={<CreatorScope><CommissionPage /></CreatorScope>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="settings" element={<CreatorSettingsPage />} />
          <Route path="*" element={<Navigate to="/creator" replace />} />
        </Route>
      </Routes>
    );
  }
  const mall = path.startsWith('/mall');
  const mcreator = path.startsWith('/c');
  return (
    <div className={`app-shell ${mall ? 'mall-mode' : ''} ${mcreator ? 'mc-mode' : ''}`}>
      <Routes>
        {/* 创作者中心（移动版）—— 自带顶栏 + 底部 5 Tab；/c → /c/home */}
        <Route path="/c" element={<MCreatorLayout />}>
          <Route index element={<Navigate to="/c/home" replace />} />
          <Route path="home" element={<MHomePage />} />
          <Route path="works" element={<MWorksPage />} />
          <Route path="publish" element={<MPublishPage />} />
          <Route path="window" element={<MWindowPage />} />
          <Route path="products" element={<MProductsPage />} />
          <Route path="library" element={<MLibraryPage />} />
          <Route path="pool" element={<MPoolPage />} />
          <Route path="*" element={<Navigate to="/c/home" replace />} />
        </Route>

        {/* 消费者壳（含 /login 与 404） */}
        <Route element={<ConsumerLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/post/:id" element={<PostDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/me" element={<MePage />} />
          <Route path="/me/body" element={<BodyPage />} />
          <Route path="/me/preferences" element={<PreferencesPage />} />
          <Route path="/me/collections" element={<CollectionsPage />} />
          <Route path="/me/settings" element={<SettingsPage />} />
          <Route path="/me/help" element={<HelpPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/learn/course/:id" element={<CourseDetailPage />} />
          <Route path="/learn/upload" element={<UploadTutorialPage />} />
          <Route path="*" element={<ConsumerCatchAll />} />
        </Route>

        {/* 商城独立页（自带 MallTabBar） */}
        <Route element={<MallLayout />}>
          <Route path="/mall/home" element={<MallHomePage />} />
          <Route path="/mall/category" element={<MallCategoryPage />} />
          <Route path="/mall/search" element={<MallSearchPage />} />
          <Route path="/mall/product/:id" element={<MallProductPage />} />
          <Route path="/mall/custom/:id" element={<CustomPage />} />
          <Route path="/mall/cart" element={<MallCartPage />} />
          <Route path="/mall/checkout" element={<MallCheckoutPage />} />
          <Route path="/mall/orders" element={<MallOrdersPage />} />
          <Route path="/mall/orders/:id" element={<MallOrderDetailPage />} />
          <Route path="/mall/orders/:id/return" element={<ReturnExchangePage />} />
          <Route path="/mall/orders/:id/exchange" element={<ReturnExchangePage />} />
          <Route path="/mall/resale" element={<ResalePage />} />
          <Route path="/mall/resale/mine" element={<ResaleMinePage />} />
          <Route path="/mall/mine" element={<MallMinePage />} />
          <Route path="/mall/*" element={<NotFoundPage />} />
        </Route>

        {/* 全局兜底 */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </div>
  );
}

/* ---------- 消费者壳布局：底部 Tab(首页/消息/我的)，仅一级页显示 ---------- */
function ConsumerLayout() {
  const location = useLocation();
  const { unread } = useMe();
  const path = location.pathname;
  const top: 'home' | 'messages' | 'me' | null =
    path === '/home' ? 'home' : path === '/messages' ? 'messages' : path === '/me' ? 'me' : null;
  return (
    <>
      <Outlet />
      {top && <TabBar active={top} unread={unread} />}
    </>
  );
}

function ConsumerCatchAll() {
  const location = useLocation();
  if (location.pathname === '/') return <Navigate to="/home" replace />;
  return <NotFoundPage />;
}

/* ---------- 商城壳布局：四个一级 tab 显示 MallTabBar ---------- */
function MallLayout() {
  const location = useLocation();
  const cart = useCart();
  const p = location.pathname;
  const tabRoot = p === '/mall/home' || p === '/mall/category' || p === '/mall/cart' || p === '/mall/mine';
  return (
    <>
      <Outlet />
      {tabRoot && <MallTabBar cartCount={cart.count} />}
    </>
  );
}
