/* ============================================================================
 * /creator/settings 设置 —— 工作室资料（演示）、账号切换（1 小织 / 99 审核员 / 14 消费者）、
 * 数据服务说明（后端端口 / 重置 seed）、版本信息
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import { Avatar, CertBadge } from '../../components/ui';
import { Loading, imgSafe } from '../../components/shared/utils';
import { useAsync, Field, Confirm, ROLE_TXT, fmtDT } from './_shared';
import { useLocalState } from '../../utils/store';

const DEMO_ACCOUNTS = [
  { id: 1, name: '小织', role: 'creator', roleTxt: '创作者', desc: '运营 / 创作 / 上架全模块', avatar: '/images/avatar-01.jpg' },
  { id: 99, name: '平台审核专员', role: 'auditor', roleTxt: '审核员', desc: '审核演示 · 橱窗复核', avatar: '/images/avatar-05.jpg' },
  { id: 14, name: '我的小号', role: 'consumer', roleTxt: '消费者', desc: '逛商城 / 私人定制', avatar: '/images/avatar-14.jpg' },
];

export default function SettingsPage() {
  const toast = useToast();
  const { user, login, refresh } = useMe();
  const [profile, setProfile] = useLocalState<{ nickname: string; bio: string; avatar: string }>('zm_creator_profile', { nickname: '', bio: '', avatar: '' });
  const [switching, setSwitching] = React.useState<number | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetting, setResetting] = React.useState(false);
  const { data: info } = useAsync(() => api.dev.info(), []);

  const eff = {
    nickname: profile.nickname || user?.nickname || '',
    bio: profile.bio || user?.bio || '',
    avatar: profile.avatar || user?.avatar || '',
  };
  const saveProfile = () => {
    setProfile({ nickname: eff.nickname, bio: eff.bio, avatar: eff.avatar });
    toast('资料已保存（演示版本地存档；正式版将写入用户资料服务）', 'check');
  };
  const switchTo = async (id: number) => {
    setSwitching(id);
    try {
      const u = await login(id);
      toast(`已切换到「${u.nickname}」`, 'check');
    } catch (e) {
      toast((e as Error).message || '切换失败');
    } finally {
      setSwitching(null);
    }
  };
  const doReset = async () => {
    setResetting(true);
    try {
      const r = await api.dev.reset(true);
      toast(`演示数据已重置：${r.msg || 'ok'}`, 'check');
      setResetOpen(false);
      await refresh();
    } catch (e) {
      toast((e as Error).message || '重置失败（需审核员/管理员权限）');
    } finally {
      setResetting(false);
    }
  };

  const entities = info?.entities || {};
  const staff = user?.role === 'auditor' || user?.role === 'admin';

  return (
    <div>
      {/* 工作室资料 */}
      <div className="c-card">
        <div className="c-card-hd"><span className="c-card-title">工作室资料</span><span className="c-pill">演示：修改本地存档</span></div>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}>
            <Avatar src={imgSafe(eff.avatar) || undefined} name={eff.nickname} size={72} />
            <div style={{ marginTop: 6, fontSize: 11, color: '#9AA0AA' }}>头像展示</div>
          </div>
          <div className="flex-1" style={{ minWidth: 320 }}>
            <div className="form-grid">
              <Field label="昵称"><input className="c-input" value={eff.nickname} onChange={(e) => setProfile({ ...profile, nickname: e.target.value })} /></Field>
              <Field label="头像路径"><input className="c-input" value={eff.avatar} onChange={(e) => setProfile({ ...profile, avatar: e.target.value })} placeholder="/images/avatar-01.jpg" /></Field>
            </div>
            <Field label="个人简介"><textarea className="c-textarea" rows={3} value={eff.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} /></Field>
            <div className="row" style={{ gap: 8 }}>
              <button className="c-btn c-btn-primary" onClick={saveProfile}><Icon name="check" size={14} />保存资料</button>
              <button className="c-btn c-btn-outline" onClick={() => setProfile({ nickname: '', bio: '', avatar: '' })}>恢复默认</button>
            </div>
            <div className="c-hint" style={{ marginTop: 10 }}>
              当前登录：{user?.nickname}（{user ? `#${user.id}` : ''} · {user ? (ROLE_TXT[user.role] || user.role) : '—'} · <CertBadge level={user?.level ?? 0} />）
            </div>
          </div>
        </div>
      </div>

      {/* 账号切换 */}
      <div className="c-card" style={{ marginTop: 12 }}>
        <div className="c-card-hd"><span className="c-card-title">切换演示账号</span><span className="c-hint">不同角色进入创作者中心的视图不同（审核员进审核视角）</span></div>
        <div className="c-grid c-grid-3">
          {DEMO_ACCOUNTS.map((a) => {
            const active = user?.id === a.id;
            return (
              <button key={a.id} disabled={!!switching} onClick={() => switchTo(a.id)} className="row tap-row" style={{
                gap: 10, padding: '12px 14px', border: active ? '1.5px solid var(--brand)' : '1px solid var(--creator-line)',
                borderRadius: 14, background: active ? 'var(--brand-soft)' : '#fff', textAlign: 'left', width: '100%',
              }}>
                <Avatar src={imgSafe(a.avatar) || undefined} name={a.name} size={44} />
                <span className="flex-1" style={{ minWidth: 0 }}>
                  <span className="row" style={{ gap: 5 }}>
                    <b style={{ fontSize: 13.5 }} className="ellipsis">{a.name}</b>
                    <span className="c-badge c-badge-brand">#{a.id}</span>
                  </span>
                  <span style={{ fontSize: 11, color: '#8B919C' }}>{a.roleTxt} · {a.desc}</span>
                </span>
                {switching === a.id ? <Loading compact text="" /> : <Icon name={active ? 'check-circle' : 'arrow-right'} size={17} color={active ? 'var(--success)' : '#C0C4CC'} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 数据服务 */}
      <div className="c-card" style={{ marginTop: 12 }}>
        <div className="c-card-hd"><span className="c-card-title">数据服务说明</span><span className="c-pill">dev 环境</span></div>
        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))' }}>
          {[
            ['后端地址', 'http://localhost:8787（/api 前缀）'],
            ['数据存储', 'JSON 文件库 data/db.json（服务端内存 + 落盘）'],
            ['用户', `${entities.users ?? '—'} 人 · 素材 ${entities.materials ?? '—'} · 作品 ${entities.works ?? '—'}`],
            ['内容', `推文 ${entities.posts ?? '—'} · 商品 ${entities.products ?? '—'} · 橱窗 ${entities.windows ?? '—'} · 订单 ${entities.orders ?? '—'}`],
            ['版本', `${info?.version || 'v2.0.0'}`],
            ['本页登录者', `${user?.nickname || '—'}（${user ? ROLE_TXT[user.role] : ''}）`],
          ].map(([k, v]) => (
            <div key={k} style={{ background: '#F7F8FA', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, color: '#9AA0AA' }}>{k}</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="c-notice warn" style={{ marginTop: 12 }}>
          <Icon name="bell" size={15} />
          <span><b>重置演示数据（seed）</b>：将清空当前数据并按初始 seed 重建，随后自动跑一次当日资源池评估。
            {!staff && ' 仅审核员/管理员（#99）有权限 —— 当前账号无法执行。'}
          </span>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <button className="c-btn c-btn-danger" disabled={!staff} onClick={() => setResetOpen(true)}><Icon name="refresh" size={14} />重置演示数据</button>
          {!staff && <span className="c-hint">创作者账号演示角色受限；如需重置请先切换到审核员 #99。</span>}
        </div>
        <div style={{ fontSize: 10.5, color: '#B7BCC6', marginTop: 10 }}>
          工程版本：apps/frontend V2（创作者平台桌面网页） · {user ? fmtDT(user.createdAt) : ''}
        </div>
      </div>

      <Confirm open={resetOpen} danger busy={resetting} title="重置演示数据？"
        body="将重建 users/materials/works/posts/pool/windows/products/orders/notifications/ledger 并重跑资源池评估。当前未保存的数据会丢失。此操作需要审核员/管理员权限。"
        okText="确认重置" onOk={doReset} onClose={() => setResetOpen(false)} />
    </div>
  );
}
