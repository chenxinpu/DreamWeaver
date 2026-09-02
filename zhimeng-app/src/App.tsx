import React from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import TabBar from './components/TabBar';
import { ToastProvider } from './components/Sheet';
import { CartProvider } from './utils/store';

/* ---------- Tab 布局 ---------- */
function TabLayout({ active }: { active: string }) {
  return (
    <>
      <Outlet />
      <TabBar active={active} />
    </>
  );
}

/* ---------- 懒加载页面 ---------- */
const L = (loader: () => Promise<{ default: React.ComponentType<any> }>) => {
  const C = React.lazy(loader);
  return (props: any) => (
    <React.Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>加载中…</div>}>
      <C {...props} />
    </React.Suspense>
  );
};

const PlazaPage = L(() => import('./pages/plaza/PlazaPage'));
const PostDetailPage = L(() => import('./pages/plaza/PostDetailPage'));
const PublishPage = L(() => import('./pages/plaza/PublishPage'));
const SearchPage = L(() => import('./pages/plaza/SearchPage'));
const RankingPage = L(() => import('./pages/ranking/RankingPage'));
const WorkDetailPage = L(() => import('./pages/ranking/WorkDetailPage'));
const LearnPage = L(() => import('./pages/learn/LearnPage'));
const CourseDetailPage = L(() => import('./pages/learn/CourseDetailPage'));
const UploadTutorialPage = L(() => import('./pages/learn/UploadTutorialPage'));
const MallPage = L(() => import('./pages/mall/MallPage'));
const CartPage = L(() => import('./pages/mall/CartPage'));
const CheckoutPage = L(() => import('./pages/mall/CheckoutPage'));
const OrderListPage = L(() => import('./pages/mall/OrderListPage'));
const OrderDetailPage = L(() => import('./pages/mall/OrderDetailPage'));
const AfterSalePage = L(() => import('./pages/mall/AfterSalePage'));
const ProfilePage = L(() => import('./pages/profile/ProfilePage'));
const BodyMeasurementPage = L(() => import('./pages/profile/BodyMeasurementPage'));
const PreferencesPage = L(() => import('./pages/profile/PreferencesPage'));
const CollectionsPage = L(() => import('./pages/profile/CollectionsPage'));
const MyWorksPage = L(() => import('./pages/profile/MyWorksPage'));
const CreatorDashboardPage = L(() => import('./pages/profile/CreatorDashboardPage'));
const CommissionPage = L(() => import('./pages/profile/CommissionPage'));
const SettingsPage = L(() => import('./pages/profile/SettingsPage'));
const HelpPage = L(() => import('./pages/profile/HelpPage'));
const MessagesPage = L(() => import('./pages/profile/MessagesPage'));
const FollowingPage = L(() => import('./pages/profile/FollowingPage'));

export default function App() {
  return (
    <ToastProvider>
      <CartProvider>
        <HashRouter>
          <div className="app-shell">
            <Routes>
              <Route element={<TabLayout active="plaza" />}>
                <Route path="/plaza" element={<PlazaPage />} />
                <Route path="/" element={<Navigate to="/plaza" replace />} />
              </Route>
              <Route element={<TabLayout active="ranking" />}>
                <Route path="/ranking" element={<RankingPage />} />
              </Route>
              <Route element={<TabLayout active="learn" />}>
                <Route path="/learn" element={<LearnPage />} />
              </Route>
              <Route element={<TabLayout active="mall" />}>
                <Route path="/mall" element={<MallPage />} />
              </Route>
              <Route element={<TabLayout active="profile" />}>
                <Route path="/profile" element={<ProfilePage />} />
              </Route>

              {/* 广场子页面 */}
              <Route path="/plaza/post/:id" element={<PostDetailPage />} />
              <Route path="/plaza/publish" element={<PublishPage />} />
              <Route path="/search" element={<SearchPage />} />

              {/* 榜单/作品 */}
              <Route path="/work/:id" element={<WorkDetailPage />} />

              {/* 学习 */}
              <Route path="/learn/course/:id" element={<CourseDetailPage />} />
              <Route path="/learn/upload" element={<UploadTutorialPage />} />

              {/* 商城 */}
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrderListPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/orders/:id/aftersale" element={<AfterSalePage />} />

              {/* 我的 */}
              <Route path="/profile/body" element={<BodyMeasurementPage />} />
              <Route path="/profile/preferences" element={<PreferencesPage />} />
              <Route path="/profile/collections" element={<CollectionsPage />} />
              <Route path="/profile/works" element={<MyWorksPage />} />
              <Route path="/profile/dashboard" element={<CreatorDashboardPage />} />
              <Route path="/profile/commission" element={<CommissionPage />} />
              <Route path="/profile/settings" element={<SettingsPage />} />
              <Route path="/profile/help" element={<HelpPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/profile/following" element={<FollowingPage />} />

              <Route path="*" element={<Navigate to="/plaza" replace />} />
            </Routes>
          </div>
        </HashRouter>
      </CartProvider>
    </ToastProvider>
  );
}
