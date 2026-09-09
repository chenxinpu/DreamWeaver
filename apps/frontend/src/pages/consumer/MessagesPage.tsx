/* ============================================================================
 * /messages 消息中心 —— 通知（/api/notifications，未读红点、全部已读）
 * + 互动消息占位；item.link 可跳 /mall/orders /creator 等
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Segmented, useToast } from '../../components/Sheet';
import { api, ApiError } from '../../api/client';
import { useMe } from '../../api/session';
import type { Notification } from '../../api/types';
import { Loading, ErrorBox, relTime } from '../../components/shared/utils';

const TYPE_STYLE: Record<string, { icon: IconName; color: string; bg: string }> = {
  pool_remind: { icon: 'layers', color: '#7C5CD6', bg: '#F0EBFC' },
  audit: { icon: 'shield', color: '#3B82F6', bg: '#EAF2FE' },
  product: { icon: 'store', color: '#E85C87', bg: '#FBEDF2' },
  order: { icon: 'package', color: '#34A36F', bg: '#E6F5EE' },
  refund: { icon: 'wallet', color: '#C9A23F', bg: '#FBF4E2' },
  resale: { icon: 'cart', color: '#3B82F6', bg: '#EAF2FE' },
  commission: { icon: 'chart', color: '#8B5CF6', bg: '#F0EBFC' },
  system: { icon: 'bell', color: '#6B6470', bg: '#F1EDE9' },
  like: { icon: 'heart', color: '#E5484D', bg: '#FCEBEC' },
  comment: { icon: 'comment', color: '#0EA5A4', bg: '#E6F7F7' },
};

export default function MessagesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { unread, setUnread, refresh } = useMe();
  const [tab, setTab] = React.useState<'notify' | 'interact'>('notify');
  const [list, setList] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await api.notifications.list({ page: 1, pageSize: 50 });
      setList(res?.list || []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      await api.notifications.read('all');
      setList((ls) => ls.map((n) => ({ ...n, read: true })));
      setUnread(0);
      toast('已全部标记为已读', 'check');
      refresh();
    } catch (e) {
      // 后端不可达：本地降级（已读状态仍在本地）
      if ((e as ApiError).code === 'network') {
        setList((ls) => ls.map((n) => ({ ...n, read: true })));
        setUnread(0);
        toast('后端未启动：已在本机标记已读', 'check');
      } else toast((e as Error).message);
    }
  };

  const tap = (n: Notification) => {
    // 已读上报（网络失败时仅本地降级标记）
    if (!n.read) {
      setList((ls) => ls.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      const before = list.filter((x) => !x.read).length;
      if (before - 1 === 0 && unread > 0) setUnread(0);
      api.notifications.read([n.id]).catch(() => {});
    }
    if (n.link) {
      if (/^\/(mall|creator|me|learn|post)/.test(n.link)) navigate(n.link);
      else if (/^https?:/.test(n.link)) window.open(n.link, '_blank');
    }
  };

  return (
    <div className="page">
      <NavBar
        title="消息"
        right={
          <button onClick={markAllRead} style={{ color: 'var(--brand)', fontSize: 13, fontWeight: 600, padding: '4px 8px' }}>全部已读</button>
        }
      />
      <div style={{ padding: '2px 12px 10px', display: 'flex', justifyContent: 'center' }}>
        <Segmented
          options={[
            { value: 'notify', label: `通知${unread > 0 ? ` ${unread}` : ''}` },
            { value: 'interact', label: '互动' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'notify' | 'interact')}
        />
      </div>

      {tab === 'notify' && (
        <>
          {loading && <Loading text="加载通知中…" />}
          {!loading && error && (
            <div className="state-box">
              <ErrorBox msg={error} onRetry={() => load()}>
                通知由后端提供（/api/notifications）；本地无演示数据。
              </ErrorBox>
            </div>
          )}
          {!loading && !error && list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '70px 30px', color: 'var(--text-3)' }}>
              <div style={{ width: 76, height: 76, margin: '0 auto 14px', borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bell" size={30} color="var(--text-3)" />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>还没有通知</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>资源池入选、审核结果、订单与售后消息会出现在这里</div>
            </div>
          )}
          {!loading && !error && (
            <div className="card" style={{ margin: '0 12px', overflow: 'hidden' }}>
              {list.map((n, i) => {
                const st = TYPE_STYLE[n.type] || TYPE_STYLE.system;
                return (
                  <button key={n.id} onClick={() => tap(n)} className="row tap-row" style={{ width: '100%', gap: 11, padding: '12px 13px', borderBottom: i < list.length - 1 ? '1px solid var(--line)' : 'none', textAlign: 'left', position: 'relative' }}>
                    <span style={{ width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: st.bg, color: st.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={st.icon} size={18} />
                    </span>
                    <div className="flex-1" style={{ minWidth: 0 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                        <span style={{ fontSize: 10.5, color: 'var(--text-3)', flexShrink: 0 }}>{relTime(n.createdAt)}</span>
                      </div>
                      <div className="ellipsis-2" style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3, lineHeight: 1.5 }}>{n.body}</div>
                      {n.link && <span style={{ fontSize: 11, color: 'var(--brand-deep)', marginTop: 4, display: 'block' }}>查看详情 →</span>}
                    </div>
                    {!n.read && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF3B30', flexShrink: 0, marginTop: -22 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'interact' && (
        <div className="card" style={{ margin: '0 12px', padding: 18 }}>
          <div className="row" style={{ gap: 10, marginBottom: 10 }}>
            <Icon name="heart" size={20} color="var(--brand)" />
            <span style={{ fontSize: 14, fontWeight: 800 }}>互动消息</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.9 }}>
            你收到的点赞、收藏与评论互动会集中显示在这里。
            <br />
            当有人点赞你的作品、评论你的推文或收藏你的商品时，这里会实时提醒你。
          </div>
          <div style={{ marginTop: 12, background: 'var(--bg)', borderRadius: 12, padding: '12px 14px', fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.8 }}>
            <span className="row" style={{ gap: 6 }}><Icon name="heart" size={12} color="#E5484D" /> 点赞提醒</span>
            <span className="row" style={{ gap: 6 }}><Icon name="comment" size={12} color="#0EA5A4" /> 评论回复提醒</span>
            <span className="row" style={{ gap: 6 }}><Icon name="star" size={12} color="#C9A23F" /> 收藏提醒</span>
            <span style={{ display: 'block', marginTop: 6 }}>— 暂无新互动 —</span>
          </div>
        </div>
      )}
    </div>
  );
}
