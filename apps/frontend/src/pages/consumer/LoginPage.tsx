/* ============================================================================
 * /login 登录 / 演示账号切换
 * 演示身份：14 我的小号(consumer 默认)、1 小织(creator)、99 审核员(auditor)
 * 调 POST /api/auth/login 换取 token 存入 localStorage('zm_v2_token')
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, CertBadge } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { ApiError } from '../../api/client';
import { useMe } from '../../api/session';
import { img, Loading } from '../../components/shared/utils';
import { roleName } from '../../components/SideDrawer';
import type { Role } from '../../api/types';

const DEMO_ACCOUNTS: { id: number; tag: string; role: Role; desc: string; features: string[] }[] = [
  { id: 14, tag: '消费者', role: 'consumer', desc: '逛商城 / 信息流 / 私人定制 / 我的体型与订单', features: ['信息流互动', '商城购物', '私人定制 4 步向导'] },
  { id: 1, tag: '创作者', role: 'creator', desc: '小织 · 独立设计师；素材→作品→橱窗→变现', features: ['素材库导入 DXF/OBJ', '发推文被推荐入池', '橱窗审核与商品上架', 'BI 数据看板'] },
  { id: 99, tag: '审核员', role: 'auditor', desc: '平台审核演示：橱窗人工审核 / 用户与资源池状态', features: ['橱窗强制审核(通过/驳回)', '系统状态查看'] },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { login, user, logout } = useMe();
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [guest, setGuest] = React.useState(false);

  const from = (location.state as { from?: string } | null)?.from || '/home';

  const doLogin = async (id: number) => {
    setBusyId(id);
    try {
      const u = await login(id);
      toast(`欢迎回来，${u.nickname}`, 'check');
      if (u.role === 'creator') navigate('/home'); // 创作者也可先用消费者壳；创作者桌面页由后续任务补全
      else navigate(from);
    } catch (e) {
      if ((e as ApiError).code === 'network') {
        toast('后端未启动：无法登录，可先浏览演示界面', undefined);
        setGuest(true);
      } else {
        toast((e as Error).message || '登录失败');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (busyId !== null) return <Loading text="正在登录…" />;

  return (
    <div className="page no-tab" style={{ minHeight: '100dvh', background: 'linear-gradient(180deg,#FFF 0%,#FDF0F4 55%,#FBE7EE 100%)' }}>
      {/* 顶部品牌 */}
      <div style={{ padding: '44px 24px 10px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 58, height: 58, borderRadius: 18, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 30, boxShadow: '0 12px 28px rgba(232,92,135,.4)',
          }}>织</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginTop: 14, letterSpacing: 1 }}>
          织梦 <span style={{ color: 'var(--brand)' }}>DreamWeaver</span>
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>从设计文件到成衣上架，再到专属定制 —— 一站式服装设计交易平台</p>
      </div>

      {/* 当前登录态 */}
      {user && (
        <div className="row" style={{ gap: 10, margin: '14px 22px 0', background: '#fff', borderRadius: 16, padding: '12px 14px', boxShadow: '0 4px 14px rgba(232,92,135,.12)' }}>
          <Avatar src={user.avatar ? (user.avatar.startsWith('/') || /^https?:/.test(user.avatar) ? user.avatar : img(user.avatar)) : undefined} name={user.nickname} size={42} />
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{user.nickname}</span>
              <CertBadge level={user.level || 0} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>当前登录 · {roleName(user.role)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/login'); }}>退出</button>
        </div>
      )}

      {/* 演示账号卡 */}
      <div style={{ padding: '18px 20px 4px' }}>
        <div className="row" style={{ gap: 6, marginBottom: 12 }}>
          <Icon name="refresh" size={15} color="var(--brand)" />
          <span style={{ fontSize: 13.5, fontWeight: 800 }}>选择演示账号一键登录</span>
        </div>
        {DEMO_ACCOUNTS.map((a) => (
          <button key={a.id} onClick={() => doLogin(a.id)} className="tap-row" style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left',
            background: '#fff', borderRadius: 18, padding: '15px 16px', marginBottom: 12,
            boxShadow: '0 4px 16px rgba(60,25,40,.08)', border: '1px solid rgba(232,92,135,.12)',
          }}>
            <Avatar src={img(`avatar-${String(a.id).padStart(2, '0')}.jpg`)} name={a.tag} size={52} ring />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 7 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800 }}>{a.tag === '消费者' ? '我的小号' : a.id === 1 ? '小织' : '平台审核专员'}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: a.role === 'creator' ? 'var(--gold)' : a.role === 'auditor' ? 'var(--info)' : 'var(--brand)', background: a.role === 'creator' ? 'var(--gold-soft)' : a.role === 'auditor' ? 'var(--info-soft)' : 'var(--brand-soft)', borderRadius: 99, padding: '2px 8px' }}>
                  {roleName(a.role)}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>#{a.id}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{a.desc}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                {a.features.slice(0, 2).map((f) => (
                  <span key={f} style={{ fontSize: 10, color: 'var(--text-2)', background: 'var(--bg)', padding: '2px 7px', borderRadius: 99 }}>{f}</span>
                ))}
              </div>
            </div>
            <span style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: busyId === a.id ? 'var(--brand-soft)' : 'var(--brand-grad)', color: '#fff', boxShadow: '0 6px 14px rgba(232,92,135,.35)',
            }}>
              <Icon name="arrow-right" size={18} />
            </span>
          </button>
        ))}

        <div style={{ textAlign: 'center', margin: '8px 0 20px' }}>
          <button onClick={() => navigate('/home')} style={{ color: 'var(--text-3)', fontSize: 12 }}>
            先逛逛，暂不登录 →
          </button>
        </div>

        {guest && (
          <div style={{ background: 'var(--gold-soft)', border: '1px solid #F0DFAE', color: '#7A5B10', borderRadius: 14, padding: '12px 14px', fontSize: 12, lineHeight: 1.8, marginBottom: 14 }}>
            <span className="row" style={{ gap: 6, fontWeight: 700 }}><Icon name="bell" size={14} />后端服务未启动</span>
            <div>请先在仓库根目录执行 ./tools/dev/services.sh start（网关 :8787）后回来登录；也可先浏览只读演示界面。</div>
          </div>
        )}
      </div>
    </div>
  );
}
