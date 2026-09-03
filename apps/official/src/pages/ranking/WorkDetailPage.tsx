import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon, { type IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Avatar, CertBadge, EmptyState, Price, SectionHeader, StatCell, Tag } from '../../components/ui';
import { CountButton, Sheet, useToast } from '../../components/Sheet';
import { BG_SCENES, img, userById, workById, worksByCreator } from '../../data/mock';
import type { BodyMeasurement } from '../../data/types';
import { DEFAULT_BODY, K, recommendSize, useBody, useCart, useLocalState } from '../../utils/store';

const fmt = (n: number) => (n >= 10000 ? (n / 10000).toFixed(1) + 'w' : n.toLocaleString('zh-CN'));

/* ---------- 内置用户评价（mock） ---------- */
const REVIEWS = [
  { userId: 6, stars: 5, time: '3天前', imgName: 'style-02.jpg', content: '质量超出预期！收到后和预览完全一致，泡泡袖完全不显肩宽，已经安利给闺蜜了～' },
  { userId: 7, stars: 5, time: '1周前', imgName: 'style-04.jpg', content: '定制体验绝了，按我的体型生成的版型穿上刚刚好，腰线收得特别漂亮。' },
  { userId: 11, stars: 4, time: '2周前', imgName: '', content: '面料很舒服，做工细致，就是发货比预期慢了一点点，整体很满意。' },
] as const;

/* 是否已采集过体型（localStorage 存在且非默认值） */
const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

/* ---------- 图片兜底 ---------- */
function SafeImg({ src, style, icon = 'bag' }: { src: string; style?: CSSProperties; icon?: IconName }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="img-ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <Icon name={icon} size={22} color="var(--text-3)" />
      </div>
    );
  }
  return <img src={src} alt="" draggable={false} onError={() => setErr(true)} style={{ ...style, objectFit: 'cover' }} />;
}

/* ---------- 关注按钮 ---------- */
function FollowBtn({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        flexShrink: 0, height: 30, padding: '0 15px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
        color: active ? 'var(--text-2)' : '#fff', background: active ? 'var(--bg-deep)' : 'var(--brand-grad)',
        boxShadow: active ? 'none' : '0 4px 12px rgba(232,92,135,.3)', transition: 'all .18s',
      }}
    >
      {active ? '已关注' : '+ 关注'}
    </button>
  );
}

/* ---------- 星级 ---------- */
function Stars({ n }: { n: number }) {
  return (
    <span className="row" style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={i <= n ? 'star-filled' : 'star'} size={13} color={i <= n ? '#F0B429' : 'var(--line)'} />
      ))}
    </span>
  );
}

/* ---------- 3D 场景背景 ---------- */
const sceneBg = (id: string, color: string) => {
  if (id === 'night') return 'radial-gradient(130% 100% at 50% 0%, #3E4C6E 0%, #20283C 52%, #141A2A 100%)';
  if (id === 'beach') return `linear-gradient(175deg, #EFF7F2 0%, ${color} 120%)`;
  if (id === 'street') return `linear-gradient(175deg, #F3F7FB 0%, ${color} 130%)`;
  return `linear-gradient(175deg, rgba(255,255,255,.92) 0%, ${color} 135%)`;
};

export default function WorkDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const cart = useCart();
  const [body] = useBody();
  const work = workById(Number(id));

  const [collected, setCollected] = useLocalState<number[]>(K.collectedWorks, []);
  const [follows, setFollows] = useLocalState<number[]>(K.follows, []);
  const [color, setColor] = useState('');
  const [size, setSize] = useState('');
  const [sceneIdx, setSceneIdx] = useState(0);
  const [bodySheet, setBodySheet] = useState(false);
  const [onlyImg, setOnlyImg] = useState(false);

  /* 3D 拖动旋转模拟 */
  const [dragging, setDragging] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);

  if (!work) {
    return (
      <div className="page no-tab">
        <NavBar back title="作品详情" />
        <EmptyState
          icon="bag"
          title="作品不存在或已下架"
          desc="去看看榜单上其他的优秀设计吧"
          action={<button className="btn btn-primary" onClick={() => navigate('/ranking')}>去榜单逛逛</button>}
        />
      </div>
    );
  }

  const creator = userById(work.creatorId);
  const others = worksByCreator(work.creatorId).filter((w) => w.id !== work.id);
  const scene = BG_SCENES[sceneIdx] || BG_SCENES[0];
  const hasBody = hasBodyData(body);
  const recommend = recommendSize(body);
  const isCollected = collected.includes(work.id);
  const isFollowed = follows.includes(creator.id);
  const collectCount = work.collects + (isCollected ? 1 : 0);
  const reviews = onlyImg ? REVIEWS.filter((r) => r.imgName) : [...REVIEWS];

  const ry = Math.max(-20, Math.min(20, offsetX * 0.12));
  const scale = 1 + Math.min(Math.abs(offsetX) * 0.0012, 0.1);

  const resetDrag = () => { setDragging(false); setOffsetX(0); };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return; // 按钮点击不触发拖拽
    setDragging(true);
    setOffsetX(0);
    startX.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging) setOffsetX(e.clientX - startX.current);
  };

  const toggleCollect = () => {
    if (isCollected) {
      setCollected((p) => p.filter((x) => x !== work.id));
      toast('已取消收藏');
    } else {
      setCollected((p) => [...p, work.id]);
      toast('已收藏，可在「我的收藏」查看', 'check');
    }
  };

  const toggleFollow = () => {
    if (isFollowed) {
      setFollows((p) => p.filter((x) => x !== creator.id));
      toast(`已取消关注 ${creator.nickname}`);
    } else {
      setFollows((p) => [...p, creator.id]);
      toast(`已关注 ${creator.nickname}`, 'check');
    }
  };

  const addCart = () => {
    if (!color) { toast('请先选择颜色'); return; }
    if (!size) { toast('请先选择尺码'); return; }
    cart.add({ workId: work.id, qty: 1, color, size });
    toast('已加入购物车', 'check');
  };

  const buyNow = () => {
    if (!color) { toast('请先选择颜色'); return; }
    if (!size) { toast('请先选择尺码'); return; }
    cart.add({ workId: work.id, qty: 1, color, size });
    navigate('/checkout');
  };

  return (
    <div className="page no-tab" style={{ paddingBottom: 'calc(118px + var(--safe-bottom))' }}>
      {/* ===== 3D 预览区 ===== */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={resetDrag}
        onPointerCancel={resetDrag}
        style={{
          position: 'relative', height: 'calc(55vh + env(safe-area-inset-top, 0px))', overflow: 'hidden',
          touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none',
          background: sceneBg(scene.id, scene.color), transition: 'background .3s ease',
        }}
      >
        {/* 场景光斑装饰 */}
        <div style={{ position: 'absolute', top: '-18%', right: '-12%', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.5), transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-16%', left: '-14%', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.35), transparent 65%)', pointerEvents: 'none' }} />

        {/* 主视觉（拖动旋转 / 缩放） */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 116px)', left: 0, right: 0, height: '62%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{
            width: '56%', height: '100%',
            transform: `perspective(900px) rotateY(${dragging ? ry : 0}deg) scale(${dragging ? scale : 1})`,
            transition: dragging ? 'transform .08s linear' : 'transform .55s cubic-bezier(.22,1,.36,1)',
            transformStyle: 'preserve-3d', borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 26px 50px rgba(20,14,18,.35), 0 4px 14px rgba(20,14,18,.18)',
            border: '1px solid rgba(255,255,255,.4)',
          }}>
            <SafeImg src={work.cover} style={{ width: '100%', height: '100%', borderRadius: 18 }} />
          </div>
        </div>
        {/* 地面投影 */}
        <div style={{ position: 'absolute', bottom: '16%', left: '50%', transform: 'translateX(-50%)', width: '56%', height: 36, background: 'radial-gradient(50% 100% at 50% 50%, rgba(20,14,18,.22), transparent 72%)', pointerEvents: 'none' }} />

        {/* 顶部透明导航 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <NavBar
            transparent
            back
            onBack={() => navigate(-1)}
            style={{ background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none', color: '#fff' }}
            right={
              <button
                onClick={() => toast('链接已复制，快去分享给朋友吧～', 'share')}
                aria-label="分享"
                style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,.25)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}
              >
                <Icon name="share" size={17} />
              </button>
            }
          />
        </div>

        {/* 背景切换（横滑圆形色块） */}
        <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 52px)', left: 0, right: 0, zIndex: 10, display: 'flex', gap: 10, overflowX: 'auto', padding: '0 12px 4px' }}>
          {BG_SCENES.map((s, i) => {
            const on = i === sceneIdx;
            return (
              <button key={s.id} onClick={() => { setSceneIdx(i); toast(`已切换到「${s.name}」场景`); }} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: '50%', background: s.color,
                  border: on ? '2px solid #fff' : '2px solid rgba(255,255,255,.55)',
                  boxShadow: on ? '0 0 0 2px var(--brand), 0 4px 12px rgba(0,0,0,.28)' : '0 2px 6px rgba(0,0,0,.18)',
                  color: s.id === 'night' ? '#fff' : '#4A4450',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
                }}>
                  <Icon name={s.icon as IconName} size={16} />
                </span>
                <span style={{
                  fontSize: 10, fontWeight: on ? 700 : 500, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.45)',
                  background: 'rgba(20,14,18,.28)', padding: '1px 7px', borderRadius: 99, whiteSpace: 'nowrap',
                }}>{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* 底部提示 */}
        <div style={{ position: 'absolute', bottom: 68, left: 0, right: 0, zIndex: 5, display: 'flex', justifyContent: 'center' }}>
          <span className="row" style={{ gap: 5, fontSize: 11, color: '#fff', background: 'rgba(20,14,18,.38)', padding: '4px 12px', borderRadius: 99, backdropFilter: 'blur(4px)' }}>
            <Icon name="rotate" size={12} />拖动旋转 · 双指缩放
          </span>
        </div>

        {/* 一键适配体模 */}
        <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setBodySheet(true)}
            className="row"
            style={{
              gap: 7, height: 42, padding: '0 26px', borderRadius: 99, background: 'var(--brand-grad)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: '1px solid rgba(255,255,255,.45)',
              boxShadow: '0 10px 24px rgba(232,92,135,.5), 0 2px 6px rgba(232,92,135,.3)',
            }}
          >
            <Icon name="sparkle" size={16} />一键适配我的体模
          </button>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        {/* ===== 作品信息卡 ===== */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.35 }}>{work.title}</div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <Avatar src={creator.avatar} size={36} name={creator.nickname} />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6 }}>
                <span className="ellipsis" style={{ fontSize: 13.5, fontWeight: 700 }}>{creator.nickname}</span>
                <CertBadge level={creator.level} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{fmt(creator.followers)} 粉丝</div>
            </div>
            <FollowBtn active={isFollowed} onToggle={toggleFollow} />
          </div>
          <div style={{ marginTop: 12 }}><Price value={work.price} size={26} /></div>
          <div className="row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            <StatCell label="销量" value={fmt(work.sales)} />
            <StatCell label="收藏" value={fmt(work.collects)} />
            <StatCell label="浏览" value={fmt(work.views)} color="var(--info)" />
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <Tag variant="gray" icon="layers">{work.fabric}</Tag>
            <Tag variant="primary">{work.category}</Tag>
            {work.isCustom && <Tag variant="gold" icon="scissors">定制生产</Tag>}
          </div>
          <div className="row" style={{ gap: 4, marginTop: 10, fontSize: 12, color: 'var(--text-2)' }}>
            <Icon name="clock" size={14} color="var(--text-3)" />
            <span>预计生产周期 {work.productionDays} 天{work.isCustom ? ' · 按需定制' : ''}</span>
          </div>
        </div>

        {/* ===== 选择款式 ===== */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>选择款式</div>
          <div style={{ marginTop: 14 }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>颜色</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: color ? 'var(--brand-deep)' : 'var(--text-3)' }}>{color || '（请选择）'}</span>
            </div>
            <div className="row" style={{ gap: 14, marginTop: 10, flexWrap: 'wrap' }}>
              {work.colors.map((c) => {
                const on = color === c.name;
                return (
                  <button key={c.name} onClick={() => setColor(c.name)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: 2 }}>
                    <span style={{
                      width: 34, height: 34, borderRadius: '50%', background: c.hex,
                      border: on ? '2px solid var(--brand)' : '2px solid var(--line)',
                      boxShadow: on ? '0 0 0 2px #fff, 0 0 0 4px var(--brand)' : '0 1px 3px rgba(0,0,0,.14)',
                      transition: 'all .15s',
                    }} />
                    <span style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? 'var(--brand-deep)' : 'var(--text-3)' }}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>尺码</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: size ? 'var(--brand-deep)' : 'var(--text-3)' }}>{size || '（请选择）'}</span>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {work.sizes.map((s) => {
                const on = size === s;
                return (
                  <button key={s} onClick={() => setSize(s)} style={{
                    minWidth: 52, height: 34, padding: '0 13px', borderRadius: 10, fontSize: 13,
                    fontWeight: on ? 700 : 500, color: on ? '#fff' : 'var(--text-2)',
                    background: on ? 'var(--brand-grad)' : 'var(--bg-deep)',
                    boxShadow: on ? '0 4px 10px rgba(232,92,135,.32)' : 'none', transition: 'all .15s',
                  }}>{s}</button>
                );
              })}
            </div>
            {/* 智能尺码推荐 */}
            <div className="row" style={{ gap: 8, marginTop: 12, borderRadius: 12, background: 'var(--brand-soft)', padding: '10px 12px' }}>
              <Icon name="ruler" size={18} color="var(--brand-deep)" />
              {hasBody ? (
                <button onClick={() => { setSize(recommend); toast(`已为你选择 ${recommend} 码`, 'check'); }} className="row flex-1" style={{ gap: 4, textAlign: 'left' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>根据你的体型，为你推荐</span>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--brand-deep)' }}>{recommend} 码</span>
                  <Icon name="chevron-right" size={13} color="var(--brand-deep)" />
                </button>
              ) : (
                <button onClick={() => navigate('/profile/body')} className="row flex-1" style={{ gap: 4, textAlign: 'left' }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>完成体型采集获取智能尺码</span>
                  <Icon name="chevron-right" size={13} color="var(--brand-deep)" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ===== 商品详情 ===== */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>商品详情</div>
          <div style={{ marginTop: 8, fontSize: 13.5, color: 'var(--text-2)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>{work.desc}</div>
        </div>

        {/* ===== 设计师卡 ===== */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <SectionHeader title="设计师" />
          <div className="row" style={{ gap: 10 }}>
            <Avatar src={creator.avatar} size={46} name={creator.nickname} ring />
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{creator.nickname}</span>
                <CertBadge level={creator.level} />
              </div>
              <div className="ellipsis" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>{creator.bio || '这位设计师很低调，等你来发现～'}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3 }}>{fmt(creator.followers)} 粉丝 · {creator.works} 件作品</div>
            </div>
            <FollowBtn active={isFollowed} onToggle={toggleFollow} />
          </div>
          {others.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {others.map((w) => (
                <button key={w.id} onClick={() => navigate(`/work/${w.id}`)} style={{ flexShrink: 0, width: 118, textAlign: 'left' }}>
                  <SafeImg src={w.cover} style={{ width: 118, height: 148, borderRadius: 12 }} />
                  <div className="ellipsis" style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{w.title}</div>
                  <Price value={w.price} size={13} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ===== 用户评价卡 ===== */}
        <div className="card" style={{ padding: 14, marginTop: 12 }}>
          <SectionHeader
            title="用户评价"
            extra={
              <button onClick={() => setOnlyImg(!onlyImg)} style={{ color: onlyImg ? 'var(--brand-deep)' : 'var(--text-3)', fontWeight: onlyImg ? 700 : 500 }}>
                {onlyImg ? '查看全部' : '只看有图'}
              </button>
            }
          />
          {reviews.map((r) => {
            const u = userById(r.userId);
            return (
              <div key={r.userId} style={{ padding: '13px 0', borderTop: '1px solid var(--line)' }}>
                <div className="row" style={{ gap: 8 }}>
                  <Avatar src={u.avatar} size={30} name={u.nickname} />
                  <div className="flex-1">
                    <div className="row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700 }}>{u.nickname}</span>
                      <Stars n={r.stars} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.time} · 已购</div>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.65, marginTop: 8 }}>{r.content}</div>
                {r.imgName && <SafeImg src={img(r.imgName)} style={{ width: 88, height: 88, borderRadius: 10, marginTop: 8 }} />}
              </div>
            );
          })}
          {reviews.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12.5, color: 'var(--text-3)' }}>暂无有图评价</div>}
        </div>
      </div>

      {/* ===== 底部操作栏 ===== */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 430, zIndex: 90,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)', paddingBottom: 'var(--safe-bottom)',
      }}>
        {work.isCustom && (
          <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 600, color: 'var(--danger)', padding: '6px 12px 0' }}>
            定制商品按需生产，不支持无理由退货
          </div>
        )}
        <div className="row" style={{ gap: 6, padding: '8px 14px' }}>
          <CountButtonLike active={isCollected} count={collectCount} onToggle={toggleCollect} />
          <button onClick={() => navigate('/cart')} aria-label="购物车" style={{ position: 'relative', padding: '4px 10px', color: 'var(--text-2)' }}>
            <Icon name="cart" size={24} />
            {cart.count > 0 && (
              <span style={{
                position: 'absolute', top: -1, right: 2, minWidth: 16, height: 16, borderRadius: 99,
                background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                boxShadow: '0 2px 6px rgba(229,72,77,.4)',
              }}>
                {cart.count > 99 ? '99+' : cart.count}
              </span>
            )}
          </button>
          <button onClick={addCart} className="btn btn-outline" style={{ flex: 1, height: 42 }}>加入购物车</button>
          <button onClick={buyNow} className="btn btn-primary" style={{ flex: 1, height: 42 }}>立即购买</button>
        </div>
      </div>

      {/* ===== 体模预览 Sheet ===== */}
      <Sheet open={bodySheet} onClose={() => setBodySheet(false)} title="体模预览">
        {hasBody ? (
          <div style={{ paddingBottom: 18 }}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
              <svg width={150} height={215} viewBox="0 0 120 190" aria-hidden="true">
                <ellipse cx="60" cy="180" rx="34" ry="5" fill="none" stroke="var(--brand)" strokeOpacity=".35" strokeDasharray="3 4" />
                <circle cx="60" cy="24" r="13" fill="none" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M60 37 L60 46" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M46 50 Q60 44 74 50 L80 118 Q60 126 40 118 Z" fill="rgba(232,92,135,.07)" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M60 46 L60 122" stroke="var(--brand)" strokeWidth="1.2" strokeOpacity=".5" strokeDasharray="3 3" />
                <path d="M44 54 L26 96" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M76 54 L94 96" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M52 120 L50 172" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M68 120 L70 172" stroke="var(--brand)" strokeWidth="1.6" />
                <path d="M42 172 L60 172 M60 172 L78 172" stroke="var(--brand)" strokeWidth="1.6" />
              </svg>
              <img
                src={work.cover} alt=""
                style={{ position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', width: 50, height: 64, borderRadius: 8, objectFit: 'cover', boxShadow: '0 6px 14px rgba(20,14,18,.28)' }}
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>模拟 3D 体模线框 · 可缩放旋转查看</div>
            <div className="row" style={{ gap: 8, marginTop: 14 }}>
              {[
                ['身高', `${body.height}cm`],
                ['胸围', `${body.bust}cm`],
                ['腰围', `${body.waist}cm`],
                ['臀围', `${body.hip}cm`],
              ].map(([k, v]) => (
                <div key={k} className="card" style={{ flex: 1, textAlign: 'center', padding: '10px 4px' }}>
                  <div style={{ fontSize: 14, fontWeight: 800 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 6, marginTop: 12, borderRadius: 12, background: 'var(--brand-soft)', padding: '10px 12px', fontSize: 12.5, color: 'var(--brand-deep)', fontWeight: 600 }}>
              <Icon name="check-circle" size={15} />已按你的体型生成专属版型，适配度 98%
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 16, height: 46 }} onClick={() => { setBodySheet(false); toast('已按你的体型生成专属版型', 'check'); }}>
              确认适配
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
            <div style={{ width: 92, height: 92, borderRadius: '50%', background: 'var(--bg-deep)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="ruler" size={40} color="var(--text-3)" />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>完成体型采集后可一键适配</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.7 }}>
              填写 12 项身体数据，即可生成专属体模，
              <br />
              预览每件作品的上身效果与智能尺码推荐
            </div>
            <button className="btn btn-primary btn-block" style={{ marginTop: 22, height: 46 }} onClick={() => navigate('/profile/body')}>
              去采集
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

/* ---------- 收藏按钮（CountButton 封装，带文字） ---------- */
function CountButtonLike({ active, count, onToggle }: { active: boolean; count: number; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
      <CountButton icon="heart" activeIcon="heart-filled" count={count} active={active} onToggle={onToggle} size={24} color="var(--text-2)" activeColor="var(--brand)" />
      <span style={{ fontSize: 9.5, color: active ? 'var(--brand)' : 'var(--text-3)', lineHeight: 1, marginTop: -2 }}>收藏</span>
    </div>
  );
}
