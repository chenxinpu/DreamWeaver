/* ============ 织梦 · 设置 ============ */
import { useState } from 'react';
import Icon from '../../components/Icon';
import { Tag } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import NavBar from '../../components/NavBar';
import { useLocalState } from '../../utils/store';
import { Row, Switch, TapStyle } from './_shared';

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600, margin: '16px 4px 6px' }}>{children}</div>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [notify, setNotify] = useLocalState<Record<string, boolean>>('zm_notify', { like: true, comment: true, order: true, live: false });
  const [aboutOpen, setAboutOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const toggleNotify = (k: string, label: string) => {
    setNotify((p) => ({ ...p, [k]: !p[k] }));
    toast(`${label}通知已${notify[k] ? '关闭' : '开启'}`);
  };

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar back title="设置" />
      <div className="page-body">
        {/* 账号安全 */}
        <GroupTitle>账号安全</GroupTitle>
        <div className="card" style={{ padding: '4px 16px' }}>
          <Row icon="user" iconColor="var(--brand)" iconBg="var(--brand-soft)" label="手机号" value="138****5621" onClick={() => toast('手机号已绑定')} />
          <div className="divider" />
          <Row icon="message" iconColor="#3B82F6" iconBg="var(--info-soft)" label="微信绑定" value="已绑定" onClick={() => toast('微信已绑定')} />
          <div className="divider" />
          <Row icon="lock" iconColor="#C9A23F" iconBg="var(--gold-soft)" label="修改密码" onClick={() => toast('修改密码功能开发中')} />
        </div>

        {/* 通知设置 */}
        <GroupTitle>通知设置</GroupTitle>
        <div className="card" style={{ padding: '4px 16px' }}>
          <Row icon="heart" iconColor="#E85C87" iconBg="var(--brand-soft)" label="点赞通知" arrow={false}>
            <Switch on={!!notify.like} onToggle={() => toggleNotify('like', '点赞')} />
          </Row>
          <div className="divider" />
          <Row icon="comment" iconColor="#34A36F" iconBg="var(--success-soft)" label="评论通知" arrow={false}>
            <Switch on={!!notify.comment} onToggle={() => toggleNotify('comment', '评论')} />
          </Row>
          <div className="divider" />
          <Row icon="package" iconColor="#3B82F6" iconBg="var(--info-soft)" label="订单通知" arrow={false}>
            <Switch on={!!notify.order} onToggle={() => toggleNotify('order', '订单')} />
          </Row>
          <div className="divider" />
          <Row icon="play" iconColor="#8B5CF6" iconBg="#F1EDF9" label="直播提醒" arrow={false}>
            <Switch on={!!notify.live} onToggle={() => toggleNotify('live', '直播')} />
          </Row>
        </div>

        {/* 隐私 */}
        <GroupTitle>隐私</GroupTitle>
        <div className="card" style={{ padding: '4px 16px' }}>
          <Row icon="shield" iconColor="#34A36F" iconBg="var(--success-soft)" label="体型数据加密存储" value={<Tag variant="success">AES-256</Tag>} onClick={() => toast('体型数据采用 AES-256 加密，仅用于版型匹配')} />
          <div className="divider" />
          <Row icon="upload" iconColor="#3B82F6" iconBg="var(--info-soft)" label="数据导出" onClick={() => toast('数据导出中，请稍候')} />
          <div className="divider" />
          <Row icon="trash" iconColor="var(--danger)" iconBg="var(--danger-soft)" label="注销账号" danger onClick={() => setLogoutOpen(true)} />
        </div>

        {/* 通用 */}
        <GroupTitle>通用</GroupTitle>
        <div className="card" style={{ padding: '4px 16px' }}>
          <Row icon="refresh" iconColor="#C9A23F" iconBg="var(--gold-soft)" label="清除缓存" value="12.6MB" onClick={() => toast('已清理 12.6MB', 'check')} />
          <div className="divider" />
          <Row icon="sparkle" iconColor="var(--brand)" iconBg="var(--brand-soft)" label="检查更新" value="v1.0.0" onClick={() => toast('已是最新版本 v1.0.0', 'check')} />
          <div className="divider" />
          <Row icon="help-circle" iconColor="#64748B" iconBg="var(--bg-deep)" label="关于织梦" onClick={() => setAboutOpen(true)} />
        </div>

        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 20 }}>织梦 v1.0.0 · 用心做好每一件衣服</div>
      </div>

      {/* 关于织梦 */}
      <Sheet open={aboutOpen} onClose={() => setAboutOpen(false)} title="关于织梦">
        <div style={{ textAlign: 'center', padding: '6px 0 10px' }}>
          <span style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--brand-grad)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(232,92,135,.35)' }}>
            <Icon name="scissors" size={30} />
          </span>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 10 }}>织梦</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>女性设计师的成长社区 · 版本 v1.0.0</div>
        </div>
        <div className="divider" />
        <Row icon="book" iconColor="var(--brand)" iconBg="var(--brand-soft)" label="用户协议" onClick={() => toast('用户协议（模拟）')} />
        <div className="divider" />
        <Row icon="shield" iconColor="#34A36F" iconBg="var(--success-soft)" label="隐私政策" onClick={() => toast('隐私政策（模拟）')} />
        <div style={{ height: 14 }} />
      </Sheet>

      {/* 注销确认 */}
      <Sheet open={logoutOpen} onClose={() => setLogoutOpen(false)} title="注销账号">
        <div style={{ fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
          注销后账号数据（作品、收藏、佣金）将永久删除且无法恢复，确定要注销吗？
        </div>
        <div className="row" style={{ gap: 12, margin: '20px 0 14px' }}>
          <button className="btn flex-1 btn-ghost" onClick={() => setLogoutOpen(false)}>再想想</button>
          <button className="btn flex-1 btn-danger" onClick={() => { setLogoutOpen(false); toast('已提交注销申请', 'check'); }}>确认注销</button>
        </div>
      </Sheet>
    </div>
  );
}
