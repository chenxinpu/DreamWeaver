/* ============================================================================
 * /me/settings 设置
 * ==========================================================================*/
import { useNavigate } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { useLocalState } from '../../utils/store';
import { useMe } from '../../api/session';
import { Switch, Row } from './_shared';

export default function SettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useMe();
  const [push, setPush] = useLocalState<boolean>('zm_set_push', true);
  const [recommend, setRecommend] = useLocalState<boolean>('zm_set_recommend', true);
  const [privacy, setPrivacy] = useLocalState<boolean>('zm_set_privacy', false);

  return (
    <div className="page no-tab page-bleed">
      <NavBar back title="设置" />
      <div className="page-body" style={{ paddingTop: 6 }}>
        {/* 账号 */}
        <div className="card" style={{ padding: '4px 14px', marginBottom: 12 }}>
          <div className="f-label" style={{ paddingTop: 10 }}>账号</div>
          <Row icon="user" label="当前账号" value={user ? `${user.nickname} · ${user.id}` : '未登录'} onClick={() => navigate('/login')} />
          <Row icon="phone" label="手机号" value="138****5621（演示）" arrow={false} />
          <Row icon="shield" label="账号与安全" value="修改密码 / 实名" onClick={() => toast('演示环境，暂不开放')} />
        </div>

        {/* 通知与推荐 */}
        <div className="card" style={{ padding: '4px 14px', marginBottom: 12 }}>
          <div className="f-label" style={{ paddingTop: 10 }}>通知与推荐</div>
          <Row icon="bell" label="接收私信与互动通知" value={<Switch on={push} onToggle={() => setPush((p) => !p)} />} arrow={false} />
          <Row icon="sparkle" label="个性化内容推荐" value={<Switch on={recommend} onToggle={() => setRecommend((p) => !p)} />} arrow={false} />
          <Row icon="eye" label="隐藏浏览足迹" value={<Switch on={privacy} onToggle={() => setPrivacy((p) => !p)} />} arrow={false} />
        </div>

        {/* 通用 */}
        <div className="card" style={{ padding: '4px 14px', marginBottom: 12 }}>
          <div className="f-label" style={{ paddingTop: 10 }}>通用</div>
          <Row icon="download" label="清除本地缓存" onClick={() => {
            ['zm_cart_v2', 'zm_collections_v2', 'zm_read_notify', 'zm_preferences'].forEach((k) => { try { localStorage.removeItem(k); } catch { /* */ } });
            toast('本地缓存已清理（购物车/收藏/偏好）', 'check');
          }} />
          <Row icon="history" label="关于织梦" value="v2.0.0" onClick={() => toast('织梦 · 个性化服装设计平台 V2')} />
        </div>

        {user ? (
          <button className="btn btn-danger btn-block" onClick={() => { logout(); toast('已退出登录'); navigate('/login'); }}>
            <Icon name="logout" size={15} />退出登录
          </button>
        ) : (
          <button className="btn btn-primary btn-block" onClick={() => navigate('/login')}>去登录</button>
        )}
      </div>
    </div>
  );
}
