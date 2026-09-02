/* ============ 织梦 · 消息中心 ============ */
import Icon, { type IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { useToast } from '../../components/Sheet';
import { messages } from '../../data/mock';
import { useLocalState } from '../../utils/store';
import { TapStyle } from './_shared';
import type { MessageItem } from '../../data/mock';

const TYPE_META: Record<MessageItem['type'], { icon: IconName; color: string; bg: string }> = {
  like: { icon: 'heart-filled', color: '#E85C87', bg: '#FBEDF2' },
  comment: { icon: 'comment', color: '#34A36F', bg: '#E6F5EE' },
  collect: { icon: 'star-filled', color: '#C9A23F', bg: '#FBF4E2' },
  order: { icon: 'package', color: '#3B82F6', bg: '#EAF2FE' },
  system: { icon: 'bell', color: '#6B6470', bg: '#F1EDE9' },
};

export default function MessagesPage() {
  const toast = useToast();
  const [readIds, setReadIds] = useLocalState<number[]>('zm_read_msgs', []);

  const isUnread = (m: MessageItem) => !m.read && !readIds.includes(m.id);

  const markRead = (m: MessageItem) => {
    if (isUnread(m)) setReadIds((p) => [...p, m.id]);
    toast('已读');
  };

  const readAll = () => {
    setReadIds(messages.map((m) => m.id));
    toast('已全部标记为已读', 'check');
  };

  const unreadCount = messages.filter(isUnread).length;

  return (
    <div className="page no-tab">
      <TapStyle />
      <NavBar
        back
        title="消息中心"
        right={
          <button onClick={readAll} style={{ fontSize: 13, color: unreadCount > 0 ? 'var(--brand-deep)' : 'var(--text-3)', fontWeight: 600 }}>
            全部已读
          </button>
        }
      />
      <div className="page-body" style={{ paddingTop: 6 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          {messages.map((m, i) => {
            const unread = isUnread(m);
            const meta = TYPE_META[m.type];
            return (
              <button
                key={m.id}
                className="tap row"
                onClick={() => markRead(m)}
                style={{
                  width: '100%', padding: '14px 16px', gap: 12, textAlign: 'left',
                  background: unread ? 'rgba(232,92,135,.05)' : '#fff',
                  borderBottom: i < messages.length - 1 ? '1px solid var(--line)' : 'none',
                }}
              >
                <span style={{ position: 'relative', width: 42, height: 42, borderRadius: 14, background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={meta.icon} size={20} color={meta.color} />
                  {unread && <span style={{ position: 'absolute', top: -2, right: -2, width: 9, height: 9, borderRadius: '50%', background: 'var(--danger)', boxShadow: '0 0 0 2px #fff' }} />}
                </span>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="flex-1 ellipsis" style={{ fontSize: 14, fontWeight: unread ? 700 : 500 }}>{m.title}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{m.time}</span>
                  </div>
                  <div className="ellipsis" style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4 }}>{m.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 16 }}>仅保留最近 30 天消息</div>
      </div>
    </div>
  );
}
