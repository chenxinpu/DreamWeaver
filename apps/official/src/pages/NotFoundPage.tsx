/* ============================================================================
 * 404 全局 fallback
 * ==========================================================================*/
import { useNavigate } from 'react-router-dom';
import NavBar from '../components/NavBar';
import Icon from '../components/Icon';

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="page no-tab page-bleed" style={{ minHeight: '100dvh' }}>
      <NavBar back title="页面走丢了" />
      <div style={{ textAlign: 'center', padding: '90px 28px' }}>
        <div style={{
          width: 96, height: 96, margin: '0 auto 18px', borderRadius: '50%',
          background: 'linear-gradient(135deg,#F6D6E0,#E85C87)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 40, fontWeight: 800, boxShadow: '0 14px 30px rgba(232,92,135,.32)',
        }}>404</div>
        <div style={{ fontSize: 16, fontWeight: 800 }}>页面不存在或已迁移</div>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.8 }}>
          你访问的页面可能属于新版路由（V2），或已被移除。
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 26, flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/home')}>回首页</button>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/mall/home')}>逛商城</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/creator')}>创作者平台</button>
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 26 }}>
          <Icon name="sparkle" size={11} /> 织梦 · DreamWeaver V2
        </div>
      </div>
    </div>
  );
}
