import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import { Price, EmptyState, SectionHeader } from '../../components/ui';
import { useToast } from '../../components/Sheet';
import { works, img, userById, CATEGORIES } from '../../data/mock';
import type { Work } from '../../data/types';

/* ---------- 运营 Banner ---------- */
const BANNERS = [
  { img: img('style-09.jpg'), title: '新势力设计周', sub: '新锐设计师作品首发 · 满减叠加' },
  { img: img('style-10.jpg'), title: '夏末清仓 · 定制8折', sub: '设计师款限时特惠，手慢无' },
  { img: img('dress-03.jpg'), title: '新人专享礼包', sub: '首单立减 ¥30 · 全场包邮' },
];

/* ---------- 品类图标 ---------- */
const CAT_ICONS: Record<string, IconName> = {
  连衣裙: 'sparkle', 衬衫: 'layers', 半裙: 'award', 外套: 'shield',
  裤装: 'scissors', 套装: 'gift', 配饰: 'crown',
};

/* 瀑布流封面高度比例（错落） */
const RATIOS = [1.32, 1.08, 1.24, 1.02, 1.3, 1.14, 1.2, 1.06];

const fmtSales = (n: number) => (n >= 10000 ? (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w' : n);

/* 封面图（onError 兜底） */
function Cover({ src, ratio }: { src: string; ratio: number }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="img-ph" style={{ aspectRatio: ratio, borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bag" size={26} color="var(--text-3)" />
      </div>
    );
  }
  return (
    <img
      src={src} alt=""
      className="img-ph"
      style={{ aspectRatio: ratio, width: '100%', objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
      onError={() => setErr(true)}
    />
  );
}

export default function MallPage() {
  const navigate = useNavigate();
  const toast = useToast();

  /* Banner 轮播 */
  const [idx, setIdx] = useState(0);
  const touchX = useRef(0);
  useEffect(() => {
    const t = window.setInterval(() => setIdx((i) => (i + 1) % BANNERS.length), 4000);
    return () => window.clearInterval(t);
  }, [idx]);

  /* 品类过滤 */
  const [cat, setCat] = useState('');
  const list = useMemo(() => (cat ? works.filter((w) => w.category === cat) : works), [cat]);

  /* 双列瀑布流（按累计高度分配） */
  const cols = useMemo(() => {
    const result: { w: Work; ratio: number }[][] = [[], []];
    const hs = [0, 0];
    list.forEach((w, i) => {
      const ratio = RATIOS[i % RATIOS.length];
      const j = hs[0] <= hs[1] ? 0 : 1;
      result[j].push({ w, ratio });
      hs[j] += ratio;
    });
    return result;
  }, [list]);

  /* 上拉加载提示 */
  const reachedRef = useRef(false);
  const [reached, setReached] = useState(false);
  useEffect(() => {
    reachedRef.current = false;
    setReached(false);
    const onScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 140) {
        if (!reachedRef.current) {
          reachedRef.current = true;
          setReached(true);
          toast('已加载全部商品');
        }
      }
    };
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat]);

  return (
    <div className="page">
      {/* 顶部搜索 + 消息 */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--bg)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/search')}
          style={{ flex: 1, height: 40, borderRadius: 99, background: '#fff', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', color: 'var(--text-3)', fontSize: 13.5, boxShadow: '0 2px 8px rgba(40,25,32,.04)' }}
        >
          <Icon name="search" size={18} />
          <span>搜索设计师 / 款式 / 面料</span>
        </button>
        <button
          onClick={() => navigate('/messages')}
          style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', background: '#fff', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="bell" size={20} />
          <span style={{ position: 'absolute', top: 8, right: 9, width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)' }} />
        </button>
      </div>

      <div className="page-body" style={{ paddingTop: 4 }}>
        {/* Banner 轮播 */}
        <div
          style={{ overflow: 'hidden', borderRadius: 16, boxShadow: '0 6px 18px rgba(40,25,32,.1)' }}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) {
              setIdx((i) => (dx < 0 ? (i + 1) % BANNERS.length : (i - 1 + BANNERS.length) % BANNERS.length));
            }
          }}
        >
          <div style={{ display: 'flex', transform: `translateX(-${idx * 100}%)`, transition: 'transform .45s cubic-bezier(.25,.8,.25,1)' }}>
            {BANNERS.map((b) => (
              <div key={b.title} style={{ width: '100%', flexShrink: 0, position: 'relative', aspectRatio: '2.1/1' }}>
                <img src={b.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(45,22,34,.6) 0%, rgba(45,22,34,.12) 62%)' }} />
                <div style={{ position: 'absolute', left: 16, bottom: 14, color: '#fff' }}>
                  <div style={{ fontSize: 19, fontWeight: 800, textShadow: '0 2px 10px rgba(0,0,0,.35)' }}>{b.title}</div>
                  <div style={{ fontSize: 12, marginTop: 4, opacity: .95 }}>{b.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* 指示点 */}
        <div className="row" style={{ justifyContent: 'center', gap: 5, marginTop: 9 }}>
          {BANNERS.map((b, i) => (
            <button
              key={b.title}
              onClick={() => setIdx(i)}
              style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 99, background: i === idx ? 'var(--brand)' : 'var(--line)', transition: 'width .25s ease' }}
            />
          ))}
        </div>

        {/* 品类导航 */}
        <div className="row" style={{ gap: 14, margin: '18px 0 4px', overflowX: 'auto', paddingBottom: 6 }}>
          {CATEGORIES.map((c) => {
            const active = cat === c;
            return (
              <button
                key={c}
                onClick={() => setCat((p) => (p === c ? '' : c))}
                style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'var(--brand-grad)' : '#fff', color: active ? '#fff' : 'var(--brand)',
                  border: active ? 'none' : '1px solid var(--line)', boxShadow: '0 2px 8px rgba(40,25,32,.06)',
                  transition: 'all .2s ease',
                }}>
                  <Icon name={CAT_ICONS[c]} size={24} />
                </div>
                <span style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? 'var(--brand)' : 'var(--text-2)' }}>{c}</span>
              </button>
            );
          })}
        </div>

        {/* 推荐信息流 */}
        <div style={{ marginTop: 10 }}>
          <SectionHeader title={cat ? `「${cat}」精选` : '为你推荐'} extra={cat ? '点击品类可取消筛选' : '上新了'} />
          {list.length === 0 ? (
            <EmptyState icon="bag" title="该品类暂无商品" desc="设计师新品正在打版中，敬请期待" />
          ) : (
            <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
              {cols.map((col, ci) => (
                <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {col.map(({ w, ratio }) => (
                    <div key={w.id} className="card" onClick={() => navigate(`/work/${w.id}`)} style={{ overflow: 'hidden', cursor: 'pointer' }}>
                      <Cover src={w.cover} ratio={ratio} />
                      <div style={{ padding: '10px 10px 12px' }}>
                        <div className="ellipsis-2" style={{ fontSize: 13.5, lineHeight: 1.45, minHeight: 39 }}>{w.title}</div>
                        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                          <Price value={w.price} size={16} />
                          {w.isCustom && <span style={{ fontSize: 10, color: 'var(--gold)', background: 'var(--gold-soft)', borderRadius: 99, padding: '2px 7px' }}>可定制</span>}
                        </div>
                        <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 11, color: 'var(--text-3)' }}>
                          <span>已售 {fmtSales(w.sales)}</span>
                          <span>·</span>
                          <span className="ellipsis" style={{ maxWidth: 88 }}>{userById(w.creatorId).nickname}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          <div className="sim-pull" style={{ marginTop: 4 }}>{reached ? '— 已加载全部商品 —' : '— 上拉加载更多 —'}</div>
        </div>
      </div>
    </div>
  );
}
