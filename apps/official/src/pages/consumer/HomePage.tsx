/* ============================================================================
 * /home 消费者首页 —— 顶部(抽屉头像+织梦+搜索+消息铃) + Tab(推荐/关注/热门)
 * 数据来自 /api/feed（loading / empty / error 三态齐全）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar } from '../../components/ui';
import { Segmented } from '../../components/Sheet';
import { useDrawer } from '../../components/SideDrawer';
import { useMe, unreadText } from '../../api/session';
import { api } from '../../api/client';
import { useToast } from '../../components/Sheet';
import type { FeedItem } from '../../api/types';
import { Loading, ErrorBox, imgSafe } from '../../components/shared/utils';
import { FeedCard } from './parts';
import { EmptyState } from '../../components/ui';

type FeedTab = 'rec' | 'follow' | 'hot';
const TAB_OPTIONS = [
  { value: 'rec' as FeedTab, label: '推荐' },
  { value: 'follow' as FeedTab, label: '关注' },
  { value: 'hot' as FeedTab, label: '热门' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const drawer = useDrawer();
  const { user, unread, hasToken } = useMe();

  const [tab, setTab] = React.useState<FeedTab>('rec');
  const [list, setList] = React.useState<FeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [end, setEnd] = React.useState(false);
  const [productWorkMap, setProductWorkMap] = React.useState<Record<number, number>>({});

  const fetchList = React.useCallback(async (t: FeedTab, p: number, append = false) => {
    setError('');
    if (p === 1 && !append) setLoading(true);
    try {
      const res = await api.feed.get({ tab: t, page: p, pageSize: 10 });
      const arr = res?.list || [];
      setList((prev) => (append ? [...prev, ...arr] : arr));
      setPage(p);
      setEnd(!arr.length || arr.length < 10);
    } catch (e) {
      setError((e as Error).message || '加载失败');
      if (!append) setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /* 预取商品索引：workId → productId（关联作品卡可跳商品；无则不渲染点击） */
  React.useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const map: Record<number, number> = {};
        for (let p = 1; p <= 3; p++) {
          const r = await api.products.list({ page: p, pageSize: 60 });
          for (const it of r?.list || []) if (it.workId) map[it.workId] = it.id;
          if ((r?.list?.length || 0) < 60) break;
        }
        if (!stop) setProductWorkMap(map);
      } catch { /* 商品不可达时仅保留作品卡文本 */ }
    })();
    return () => { stop = true; };
  }, []);

  React.useEffect(() => { fetchList(tab, 1); }, [tab, fetchList]);

  const onSwitch = (v: FeedTab) => {
    setTab(v);
    setList([]);
  };

  const loadMore = () => { if (!end && !loading) fetchList(tab, page + 1, true); };

  return (
    <div className="page" style={{ paddingBottom: 'calc(var(--tab-h) + var(--safe-bottom) + 14px)' }}>
      {/* 顶部：头像(抽屉) + 织梦 Logo + 搜索框 + 消息铃 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 60, background: 'rgba(246,244,241,.96)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
        <div className="row" style={{ gap: 10, padding: '10px 12px' }}>
          <button onClick={drawer.open} style={{ display: 'flex', alignItems: 'center' }} aria-label="打开侧边栏">
            <Avatar src={user?.avatar ? imgSafe(user.avatar) : undefined} name={user?.nickname || '未登录'} size={34} ring />
          </button>
          {/* 织梦 Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <span style={{
              width: 22, height: 22, borderRadius: 8, background: 'var(--brand-grad)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12,
              boxShadow: '0 3px 8px rgba(232,92,135,.35)',
            }}>织</span>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, background: 'var(--brand-grad)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>梦</span>
          </div>
          {/* 搜索框 */}
          <button
            onClick={() => navigate('/search')}
            className="row flex-1"
            style={{ height: 34, borderRadius: 99, background: 'var(--bg-deep)', padding: '0 12px', gap: 7, color: 'var(--text-3)', fontSize: 13, minWidth: 0 }}
          >
            <Icon name="search" size={15} />
            <span className="ellipsis">搜索商品 / 达人</span>
          </button>
          {/* 消息铃（未读角标） */}
          <button onClick={() => navigate('/messages')} style={{ position: 'relative', padding: 4 }} aria-label="消息">
            <Icon name="bell" size={22} color="var(--text)" />
            {unread > 0 && <span className="badge-dot" style={{ position: 'absolute', top: -2, right: -4 }}>{unreadText(unread)}</span>}
          </button>
        </div>

        {/* Tab：推荐/关注/热门 */}
        <div className="sticky-tabs" style={{ padding: '4px 12px 8px', display: 'flex', justifyContent: 'center' }}>
          <Segmented options={TAB_OPTIONS} value={tab} onChange={(v) => onSwitch(v as FeedTab)} />
        </div>
      </div>

      {/* 未登录提示条 */}
      {!user && !hasToken && (
        <div className="row" style={{ margin: '0 12px 10px', gap: 10, background: 'linear-gradient(120deg,#FFF3F6,#FDE4EC)', border: '1px solid #F6CFDC', borderRadius: 14, padding: '11px 13px' }}>
          <Icon name="user" size={18} color="var(--brand)" />
          <div className="flex-1" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
            登录后可关注达人、点赞评论、下单定制
          </div>
          <button onClick={() => navigate('/login')} className="btn btn-primary btn-sm" style={{ height: 28, padding: '0 14px', fontSize: 12 }}>登录</button>
        </div>
      )}

      {/* 内容区三态 */}
      {loading && <Loading text={tab === 'follow' ? '加载关注流…' : '正在为你推荐…'} />}
      {!loading && error && (
        <div className="state-box">
          <ErrorBox msg={error} onRetry={() => fetchList(tab, 1)} />
        </div>
      )}
      {!loading && !error && list.length === 0 && (
        <div style={{ marginTop: 30 }}>
          <EmptyState
            icon={tab === 'follow' ? 'user' : 'bag'}
            title={tab === 'follow' ? '还没有关注的内容' : '暂时没有新的推文'}
            desc={tab === 'follow' ? '去关注喜欢的达人或作品吧' : '创作者发布后，这里会第一时间展示'}
            action={tab === 'follow' ? (
              <button className="btn btn-outline btn-sm" onClick={() => onSwitch('rec')}>看看推荐</button>
            ) : (
              <button className="btn btn-outline btn-sm" onClick={() => toast('演示数据将由后端 seed 提供，请先启动 apps/server')}>刷新</button>
            )}
          />
        </div>
      )}

      {/* 信息流 */}
      {!loading && !error && (
        <>
          {list.map((p) => (
            <FeedCard
              key={p.id}
              p={p}
              productLink={(workId) => productWorkMap[workId]}
              onOpenAuthor={() => { if (p.author) navigate('/me'); }}
            />
          ))}
          {end && list.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', padding: '16px 0 4px' }}>— 已经到底啦 —</div>
          )}
          {!end && list.length > 0 && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <button onClick={loadMore} style={{ color: 'var(--brand)', fontSize: 12.5, fontWeight: 600, padding: 8 }}>加载更多</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
