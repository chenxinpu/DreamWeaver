import { useMemo, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { CertBadge, EmptyState } from '../../components/ui';
import { Segmented, Sheet, useToast } from '../../components/Sheet';
import { CATEGORIES, STYLE_TAGS, rankingByPeriod, userById, workById } from '../../data/mock';
import type { RankingItem } from '../../data/types';
import { K, useLocalState } from '../../utils/store';

const PERIODS = [
  { value: '1', label: '周榜' },
  { value: '2', label: '月榜' },
  { value: '3', label: '总榜' },
] as const;

const PRICE_OPTIONS = [
  { value: 'all', label: '全部价格' },
  { value: '0-200', label: '0 - 200 元' },
  { value: '200-500', label: '200 - 500 元' },
  { value: '500+', label: '500 元以上' },
] as const;

const RULE_ITEMS: { icon: IconName; label: string; weight: string; color: string }[] = [
  { icon: 'fire', label: '投票', weight: '× 0.3', color: '#E85C87' },
  { icon: 'heart', label: '收藏', weight: '× 0.2', color: '#C9A23F' },
  { icon: 'bag', label: '销量', weight: '× 0.3', color: '#3B82F6' },
  { icon: 'message', label: '互动', weight: '× 0.2', color: '#34A36F' },
];

type Period = '1' | '2' | '3';
type PriceRange = 'all' | '0-200' | '200-500' | '500+';

const GOLD_TEXT = 'linear-gradient(135deg,#F3D78A 0%,#C9A23F 55%,#8A5A00 100%)';
const fmt = (n: number) => (n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n.toLocaleString('zh-CN'));

/* ---------- 图片兜底 ---------- */
function SafeImg({ src, style }: { src: string; style?: CSSProperties }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="img-ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <Icon name="bag" size={20} color="var(--text-3)" />
      </div>
    );
  }
  return <img src={src} alt="" draggable={false} onError={() => setErr(true)} style={{ ...style, objectFit: 'cover' }} />;
}

/* ---------- 排名徽章 ---------- */
function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div style={{ width: 34, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Icon name="crown" size={rank === 1 ? 18 : 14} color="#C9A23F" />
        <span style={{
          fontSize: rank === 1 ? 26 : 20, fontWeight: 800, lineHeight: 1,
          background: GOLD_TEXT, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
        }}>{rank}</span>
      </div>
    );
  }
  return <div style={{ width: 34, flexShrink: 0, textAlign: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text-3)' }}>{rank}</div>;
}

export default function RankingPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [period, setPeriod] = useState<Period>('1');
  const [category, setCategory] = useState('全部');
  const [styles, setStyles] = useState<string[]>([]);
  const [price, setPrice] = useState<PriceRange>('all');

  const [ruleOpen, setRuleOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);

  /* 投票持久化：已投作品 + 每日剩余票数 */
  const [voted, setVoted] = useLocalState<number[]>(K.votedWorks, []);
  const [votesLeft, setVotesLeft] = useLocalState<number>('zm_votes_left', 10);
  const [extra, setExtra] = useState<Record<number, number>>({});
  const votedSet = useMemo(() => new Set(voted), [voted]);

  /* 组合筛选：品类 / 风格 / 价格 */
  const list = useMemo(() => {
    return rankingByPeriod[Number(period)]
      .map((item) => ({ item, work: workById(item.workId) }))
      .filter(({ work }) => {
        if (!work) return false;
        if (category !== '全部' && work.category !== category) return false;
        if (styles.length > 0 && !work.styleTags.some((t) => styles.includes(t))) return false;
        if (price === '0-200' && work.price > 200) return false;
        if (price === '200-500' && (work.price <= 200 || work.price > 500)) return false;
        if (price === '500+' && work.price <= 500) return false;
        return true;
      })
      .map(({ item }, idx) => ({ ...item, rank: idx + 1 }));
  }, [period, category, styles, price]);

  const handleVote = (item: RankingItem) => {
    if (votedSet.has(item.workId)) { toast('今天已经投过这件作品啦'); return; }
    if (votesLeft <= 0) { toast('今日投票次数已用完，明天再来吧～'); return; }
    const left = votesLeft - 1;
    setVoted((p) => [...p, item.workId]);
    setVotesLeft(left);
    setExtra((p) => ({ ...p, [item.workId]: (p[item.workId] || 0) + 1 }));
    toast(left > 0 ? `投票成功（今日剩余${left}票）` : '投票成功（今日已投满）', 'check');
  };

  const toggleStyle = (t: string) => {
    setStyles((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));
  };

  return (
    <div className="page">
      {/* ===== 粘性页头 ===== */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 60, paddingBottom: 10,
        background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)',
      }}>
        {/* 标题 + 规则按钮 */}
        <div className="row" style={{ padding: '10px 12px 0' }}>
          <div style={{ width: 56 }} />
          <div className="flex-1" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: 2 }}>设计榜单</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>每周热度更新，为喜欢的作品投票</div>
          </div>
          <div style={{ width: 56, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setRuleOpen(true)}
              aria-label="热度算法说明"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="help-circle" size={19} color="var(--text-2)" />
            </button>
          </div>
        </div>
        {/* 周 / 月 / 总 */}
        <div className="row" style={{ padding: '9px 16px 0', gap: 10 }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Segmented size="sm" options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} value={period} onChange={setPeriod} />
          </div>
          <span className="row" style={{ gap: 3, fontSize: 11.5, whiteSpace: 'nowrap', fontWeight: 600, color: votesLeft > 0 ? 'var(--text-3)' : 'var(--danger)' }}>
            <Icon name="fire" size={12} color={votesLeft > 0 ? '#FF5A3C' : 'var(--danger)'} />
            {votesLeft > 0 ? `剩余 ${votesLeft} 票` : '今日已投满'}
          </span>
        </div>
        {/* 筛选栏 */}
        <div className="row" style={{ gap: 8, padding: '10px 16px 0', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
            {['全部', ...CATEGORIES].map((c) => {
              const on = c === category;
              return (
                <button key={c} onClick={() => setCategory(c)} style={{
                  flexShrink: 0, padding: '6px 13px', borderRadius: 99, fontSize: 12.5,
                  fontWeight: on ? 700 : 500, color: on ? '#fff' : 'var(--text-2)',
                  background: on ? 'var(--brand-grad)' : 'var(--bg-deep)',
                  boxShadow: on ? '0 2px 8px rgba(232,92,135,.3)' : 'none', transition: 'all .18s',
                }}>{c}</button>
              );
            })}
          </div>
          <button
            onClick={() => setStyleOpen(true)}
            className="row"
            style={{
              flexShrink: 0, gap: 4, height: 29, padding: '0 11px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
              color: styles.length ? 'var(--brand-deep)' : 'var(--text-2)',
              background: styles.length ? 'var(--brand-soft)' : 'var(--bg-deep)',
            }}
          >
            <Icon name="filter" size={13} />风格{styles.length ? `(${styles.length})` : ''}
          </button>
          <button
            onClick={() => setPriceOpen(true)}
            className="row"
            style={{
              flexShrink: 0, gap: 4, height: 29, padding: '0 11px', borderRadius: 99, fontSize: 12.5, fontWeight: 600,
              color: price !== 'all' ? 'var(--brand-deep)' : 'var(--text-2)',
              background: price !== 'all' ? 'var(--brand-soft)' : 'var(--bg-deep)',
            }}
          >
            <Icon name="wallet" size={13} />{price === 'all' ? '价格' : price}
          </button>
        </div>
      </div>

      {/* ===== 榜单列表 ===== */}
      <div className="row" style={{ justifyContent: 'space-between', padding: '12px 16px 4px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>共 {list.length} 件作品</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>每日可投 10 票</span>
      </div>
      <div style={{ padding: '4px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((item) => {
          const work = workById(item.workId)!;
          const author = userById(work.creatorId);
          const isVoted = votedSet.has(item.workId);
          const noLeft = votesLeft <= 0;
          const heat = (item.totalScore + (extra[item.workId] || 0) * 0.3).toFixed(1);
          const top1 = item.rank === 1;
          return (
            <div
              key={item.workId}
              className="card fade-in"
              onClick={() => navigate(`/work/${item.workId}`)}
              style={{
                padding: 12, cursor: 'pointer',
                border: top1 ? '1px solid rgba(201,162,63,.45)' : '1px solid transparent',
                boxShadow: top1 ? '0 6px 18px rgba(201,162,63,.14)' : undefined,
              }}
            >
              <div className="row" style={{ gap: 10 }}>
                <RankBadge rank={item.rank} />
                <SafeImg src={work.cover} style={{ width: 90, height: 110, borderRadius: 12 }} />
                <div className="col flex-1" style={{ gap: 4, minWidth: 0 }}>
                  <div className="ellipsis" style={{ fontSize: 14.5, fontWeight: 700 }}>{work.title}</div>
                  <div className="row" style={{ gap: 6 }}>
                    <span className="ellipsis" style={{ maxWidth: 84, fontSize: 12, color: 'var(--text-2)' }}>{author.nickname}</span>
                    <CertBadge level={author.level} />
                  </div>
                  <div className="row" style={{ gap: 4 }}>
                    <Icon name="fire" size={15} color="#FF5A3C" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: '#FF5A3C' }}>热度 {heat}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>已售 {fmt(work.sales)}</div>
                </div>
                <button
                  onClick={(e: ReactMouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleVote(item); }}
                  disabled={isVoted || noLeft}
                  style={{
                    alignSelf: 'center', flexShrink: 0, height: 30, padding: '0 15px', borderRadius: 99,
                    fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', transition: 'all .18s',
                    color: isVoted ? 'var(--text-3)' : '#fff',
                    background: isVoted || noLeft ? 'var(--bg-deep)' : 'var(--brand-grad)',
                    boxShadow: isVoted || noLeft ? 'none' : '0 4px 12px rgba(232,92,135,.35)',
                    opacity: noLeft ? 0.65 : 1,
                  }}
                >
                  {isVoted ? '已投' : noLeft ? '今日已投满' : '投票'}
                </button>
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <EmptyState icon="trophy" title="没有符合条件的作品" desc="换个筛选条件再试试吧" />
        )}
      </div>

      {/* ===== 热度算法说明 ===== */}
      <Sheet open={ruleOpen} onClose={() => setRuleOpen(false)} title="热度算法说明">
        <div style={{ paddingBottom: 18 }}>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
            热度值综合衡量作品在一段时间内的表现，每周一 0 点更新榜单。
          </p>
          <div className="card" style={{ marginTop: 14, padding: 14 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700 }}>热度值 =</div>
            {RULE_ITEMS.map((r) => (
              <div key={r.label} className="row" style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <span className="row" style={{ gap: 6, fontSize: 13, color: 'var(--text-2)' }}>
                  <Icon name={r.icon} size={15} color={r.color} />{r.label}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: r.color }}>{r.weight}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 14, lineHeight: 1.6 }}>
            每天可投 10 票，投出的每一票都会实时累计到作品的热度值中，为喜欢的作品投票吧！
          </p>
        </div>
      </Sheet>

      {/* ===== 风格多选 ===== */}
      <Sheet open={styleOpen} onClose={() => setStyleOpen(false)} title="选择风格" height="64%">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 16 }}>
          {STYLE_TAGS.map((t) => {
            const on = styles.includes(t);
            return (
              <button key={t} onClick={() => toggleStyle(t)} style={{
                padding: '7px 14px', borderRadius: 99, fontSize: 13,
                fontWeight: on ? 700 : 500, color: on ? '#fff' : 'var(--text-2)',
                background: on ? 'var(--brand-grad)' : 'var(--bg-deep)',
                boxShadow: on ? '0 2px 8px rgba(232,92,135,.3)' : 'none', transition: 'all .18s',
              }}>{t}</button>
            );
          })}
        </div>
        <div className="row" style={{ position: 'sticky', bottom: 0, gap: 10, margin: '0 -18px', padding: '12px 18px 18px', background: '#fff', borderTop: '1px solid var(--line)' }}>
          <button className="btn btn-ghost" style={{ flex: 1, height: 42 }} onClick={() => setStyles([])}>清空</button>
          <button className="btn btn-primary" style={{ flex: 1, height: 42 }} onClick={() => setStyleOpen(false)}>
            确定{styles.length > 0 ? `（${styles.length}）` : ''}
          </button>
        </div>
      </Sheet>

      {/* ===== 价格区间 ===== */}
      <Sheet open={priceOpen} onClose={() => setPriceOpen(false)} title="价格区间">
        <div style={{ paddingBottom: 16 }}>
          {PRICE_OPTIONS.map((o) => {
            const on = price === o.value;
            return (
              <button
                key={o.value}
                onClick={() => { setPrice(o.value); setPriceOpen(false); }}
                className="row"
                style={{
                  width: '100%', justifyContent: 'space-between', padding: '13px 4px',
                  borderBottom: '1px solid var(--line)', fontSize: 14,
                  color: on ? 'var(--brand-deep)' : 'var(--text)', fontWeight: on ? 700 : 500,
                }}
              >
                {o.label}
                {on && <Icon name="check" size={18} color="var(--brand)" />}
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}
