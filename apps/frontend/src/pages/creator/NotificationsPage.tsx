/* ============================================================================
 * /creator/notifications 平台通知 —— 类型图标 + 未读高亮 + 全部已读 + 点击跳转
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { Notification } from '../../api/types';
import { useAsync, CState, Loading, fmtDT } from './_shared';

const TYPE_META: Record<string, { icon: IconName; color: string; bg: string }> = {
  pool_remind: { icon: 'layers', color: '#9A7A1E', bg: '#FBF4E2' },
  audit: { icon: 'shield', color: '#B4547A', bg: '#FBEDF2' },
  product: { icon: 'store', color: '#34A36F', bg: '#E6F5EE' },
  order: { icon: 'package', color: '#3B82F6', bg: '#EAF2FE' },
  refund: { icon: 'refresh', color: '#E5484D', bg: '#FCEBEC' },
  resale: { icon: 'cart', color: '#8B5CF6', bg: '#F1ECFE' },
  commission: { icon: 'chart', color: '#C9A23F', bg: '#FBF4E2' },
  system: { icon: 'bell', color: '#6B7180', bg: '#F1F2F5' },
  like: { icon: 'heart', color: '#E85C87', bg: '#FBEDF2' },
  comment: { icon: 'comment', color: '#3B82F6', bg: '#EAF2FE' },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { setUnread } = useMe();
  const [tab, setTab] = React.useState<'all' | 'unread'>('all');
  const { data, loading, error, reload, setData } = useAsync(() => api.notifications.list({ pageSize: 200 }), [tab]);

  const list = data?.list || [];
  const unreadCount = data?.unreadCount ?? list.filter((n) => !n.read).length;

  const markAll = async () => {
    try {
      await api.notifications.read('all');
      toast('已全部标为已读', 'check');
      setUnread(0);
      reload();
    } catch (e) {
      toast((e as Error).message || '操作失败');
    }
  };
  const open = async (n: Notification) => {
    if (!n.read) {
      api.notifications.read([n.id]).catch(() => {});
      setData((d) => (d ? { ...d, list: d.list.map((x) => (x.id === n.id ? { ...x, read: true } : x)), unreadCount: Math.max(0, (d.unreadCount ?? 1) - 1) } : d));
      setUnread(Math.max(0, unreadCount - 1));
    }
    if (!n.link) return;
    if (/^https?:/.test(n.link)) window.open(n.link, '_blank');
    else if (n.link.startsWith('/')) navigate(n.link);
  };

  return (
    <div className="c-card">
      <div className="c-card-hd">
        <span className="c-card-title">平台通知</span>
        <div className="row" style={{ gap: 8 }}>
          <span className="c-pill">{unreadCount} 条未读</span>
          <button className="c-btn c-btn-sm c-btn-soft" onClick={markAll} disabled={!unreadCount}><Icon name="check" size={13} />全部已读</button>
          <button className="c-btn c-btn-sm c-btn-outline" onClick={reload}><Icon name="refresh" size={13} /></button>
        </div>
      </div>
      <div className="c-tabs" style={{ marginBottom: 10 }}>
        <button className={`c-tab ${tab === 'all' ? 'on' : ''}`} onClick={() => setTab('all')}>全部</button>
        <button className={`c-tab ${tab === 'unread' ? 'on' : ''}`} onClick={() => setTab('unread')}>未读</button>
      </div>

      {loading && <Loading />}
      {!loading && error && <CState danger icon="bell" title="通知加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重试</button>} />}
      {!loading && !list.length && <CState icon="bell" title={tab === 'all' ? '暂无通知' : '没有未读通知'} desc="入池提醒、审核结果、订单成交、佣金结算都会第一时间通知你" />}

      {!loading && list.map((n, i) => {
        const meta = TYPE_META[n.type] || TYPE_META.system;
        return (
          <button key={n.id} onClick={() => open(n)} className="row" style={{
            width: '100%', gap: 12, alignItems: 'flex-start', textAlign: 'left', padding: '13px 6px',
            borderBottom: i < list.length - 1 ? '1px solid #F0F1F4' : 'none',
            background: !n.read ? '#FFF8FA' : undefined, borderRadius: 12,
          }}>
            <span style={{ position: 'relative', flexShrink: 0 }}>
              <span style={{ width: 40, height: 40, borderRadius: 12, background: meta.bg, color: meta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={meta.icon} size={18} />
              </span>
              {!n.read && <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: '#FF3B30', border: '2px solid #fff' }} />}
            </span>
            <span className="flex-1" style={{ minWidth: 0 }}>
              <span className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 13.5 }} className="ellipsis">{n.title}</b>
                <span style={{ fontSize: 10.5, color: '#A8AEB8', flexShrink: 0 }}>{fmtDT(n.createdAt)}</span>
              </span>
              <span style={{ display: 'block', fontSize: 12, color: '#6B7180', marginTop: 4, lineHeight: 1.7 }} className="whitespace-pre">{n.body}</span>
              {n.link && <span className="c-hint" style={{ fontSize: 11, marginTop: 5, display: 'flex', gap: 4, alignItems: 'center' }}>
                <Icon name="link" size={11} color="var(--brand)" />{n.link.startsWith('/') ? '站内跳转' : '外部链接'}
                <Icon name="chevron-right" size={12} color="#C0C4CC" />
              </span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
