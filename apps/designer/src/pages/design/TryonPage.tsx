/* ============ 织梦 · 服装设计App · 3D 试衣间 ============
 * 虚拟人台实时试衣 + 面料物理动态展示 + 动态动画
 * 路由 /design/tryon（已在 App.tsx 注册，默认导出）
 */
import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import NavBar from '../../components/NavBar';
import { Tag } from '../../components/ui';
import { Segmented, useToast } from '../../components/Sheet';
import DressCanvas from '../../components/design/DressCanvas';
import DesignerNav from '../../components/design/DesignerNav';
import { AI_CANDIDATES, DEFAULT_PARAMS, applyCandidate, fabricById } from '../../data/design';
import type { AiCandidate, DesignParams } from '../../data/design';
import { useDesignWorks } from '../../utils/designStore';
import { DEFAULT_BODY, K, useBody } from '../../utils/store';
import type { BodyMeasurement } from '../../data/types';

/* ---------- 动作预设 ---------- */
type PoseKey = 'stand' | 'turn' | 'skirt' | 'walk';
const POSE_KEYS: { key: PoseKey; label: string }[] = [
  { key: 'stand', label: '站立' },
  { key: 'turn', label: '转身' },
  { key: 'skirt', label: '摆裙' },
  { key: 'walk', label: '行走' },
];
const POSE_ANIM: Record<Exclude<PoseKey, 'stand'>, { name: string; dur: string }> = {
  turn: { name: 'tryon-turn', dur: '3.2s' },
  skirt: { name: 'tryon-skirt', dur: '1.6s' },
  walk: { name: 'tryon-walk', dur: '1.2s' },
};

/* 内嵌 CSS 动画（组件内 keyframes，避免污染全局） */
const POSE_CSS = `
@keyframes tryon-turn { 0%,100% { transform: rotateY(-6deg); } 50% { transform: rotateY(6deg); } }
@keyframes tryon-skirt { 0%,100% { transform: rotateY(-3.5deg); } 20% { transform: rotateY(-1.5deg); } 40% { transform: rotateY(2deg); } 60% { transform: rotateY(4.5deg); } 80% { transform: rotateY(0.5deg); } }
@keyframes tryon-walk { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
`;

/* ---------- 快捷换装变体（换色/换料/换图案） ---------- */
const QUICK_SWAPS: { label: string; pattern: string; color: string; fabric: string; accent: string }[] = [
  { label: '缎面光泽', pattern: 'none', color: '#E8A0B0', fabric: 'satin', accent: '#7E2E3A' },
  { label: '真丝碎花', pattern: 'floral', color: '#F5EFE6', fabric: 'silk', accent: '#C2544E' },
  { label: '牛津条纹', pattern: 'stripe', color: '#9FB4C7', fabric: 'oxford', accent: '#2A3B5C' },
  { label: '格纹大衣感', pattern: 'plaid', color: '#EFD9CF', fabric: 'wool', accent: '#C9A23F' },
  { label: '奶油波点', pattern: 'polka', color: '#F6F4F0', fabric: 'cotton', accent: '#2B2B30' },
];

/* ---------- 背景（同官方作品详情页：按场景 id 取渐变/纯色） ---------- */
const sceneBg = (id: string, color: string) => {
  if (id === 'night') return 'radial-gradient(130% 100% at 50% 0%, #3E4C6E 0%, #20283C 52%, #141A2A 100%)';
  if (id === 'beach') return `linear-gradient(175deg, #EFF7F2 0%, ${color} 120%)`;
  if (id === 'street') return `linear-gradient(175deg, #F3F7FB 0%, ${color} 130%)`;
  return `linear-gradient(175deg, rgba(255,255,255,.92) 0%, ${color} 135%)`;
};

/* 6 大试衣场景（studio 工作室 / street 街拍 / cafe 咖啡厅 / beach 海滩 / night 夜景 / custom 自定义照片背景） */
const SCENES: { id: string; name: string; icon: string; color: string }[] = [
  { id: 'studio', name: '工作室', icon: 'layers', color: '#F3EDE8' },
  { id: 'street', name: '街拍', icon: 'sun', color: '#DCE6EE' },
  { id: 'cafe', name: '咖啡厅', icon: 'coffee', color: '#EADFD2' },
  { id: 'beach', name: '海滩', icon: 'beach', color: '#D8E8E4' },
  { id: 'night', name: '夜景', icon: 'moon', color: '#232A3D' },
  { id: 'custom', name: '自定义', icon: 'grid', color: '#E8E4EE' },
];

/* 自定义场景可选背景图（/images/bg-01.jpg ~ bg-05.jpg） */
const CUSTOM_BGS = [1, 2, 3, 4, 5].map((n) => `/images/bg-0${n}.jpg`);

/* ---------- 是否已采集体型（localStorage 存在且非默认值，跨官方App共享） ---------- */
const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

/* ---------- AI 候选 → 可直接试穿的完整参数 ---------- */
function presetOf(c: AiCandidate): DesignParams {
  return { ...DEFAULT_PARAMS[c.category], ...applyCandidate(c) };
}

/* ---------- 图片 onError 兜底 ---------- */
function BgImg({ src, style }: { src: string; style?: React.CSSProperties }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return <div className="img-ph" style={{ ...style }} />;
  }
  return <img src={src} alt="" onError={() => setErr(true)} style={{ ...style, objectFit: 'cover' }} />;
}

type SourceKey = 'work' | 'ai';
interface TryItem {
  key: string; title: string; params: DesignParams; workId?: number; tag?: string;
}

export default function TryonPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { works } = useDesignWorks();
  const [body] = useBody();

  /* ---------- 状态 ---------- */
  const [source, setSource] = useState<SourceKey>('work');
  const [params, setParams] = useState<DesignParams>(() => (works[0] ? { ...works[0].params } : { ...DEFAULT_PARAMS.dress }));
  const [selKey, setSelKey] = useState<string>(`w${works[0]?.id ?? 0}`);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [customImg, setCustomImg] = useState(0);
  const [pose, setPose] = useState<PoseKey>('stand');
  const lastPose = useRef<Exclude<PoseKey, 'stand'>>('turn');

  /* 拖动旋转（松手回弹） */
  const [rot, setRot] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 212, h: 326 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const h = Math.max(190, r.height - 148);
      const w = Math.min(r.width - 66, h * 0.643);
      setBox({ w: Math.round(w), h: Math.round(h) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- 试穿作品 / AI 灵感列表 ---------- */
  const workItems: TryItem[] = works.length
    ? works.map((w) => ({ key: `w${w.id}`, title: w.title, params: w.params, workId: w.id }))
    : [{ key: 'w0', title: '默认连衣裙（兜底）', params: { ...DEFAULT_PARAMS.dress } }];
  const aiItems: TryItem[] = AI_CANDIDATES.slice(0, 3).map((c) => {
    const seed = works.find((w) => w.title === c.title && w.params.category === c.category);
    return { key: `ai${c.id}`, title: c.title, tag: c.tagline, params: presetOf(c), workId: seed?.id };
  });
  const items = source === 'work' ? workItems : aiItems;
  const curItem = items.find((i) => i.key === selKey);

  const selectItem = (it: TryItem) => {
    const changed = it.key !== selKey;
    setParams({ ...it.params });
    setSelKey(it.key);
    if (changed) toast(`已载入「${it.title}」`, 'check');
  };

  const changeSource = (s: SourceKey) => {
    if (s === source) return;
    setSource(s);
    const first = (s === 'work' ? workItems : aiItems)[0];
    if (first) {
      setSelKey(first.key);
      setParams({ ...first.params });
    }
    toast(s === 'work' ? '已切换：从我的作品试穿' : '已切换：AI 灵感方案');
  };

  const editDesign = () => {
    if (curItem?.workId) {
      navigate(`/design/studio?work=${curItem.workId}`);
    } else {
      navigate('/design/studio');
      toast('该灵感尚未入库，已为你打开空白工作台');
    }
  };

  /* ---------- 场景/背景 ---------- */
  const scene = SCENES[sceneIdx] || SCENES[0];
  const pickScene = (i: number) => {
    setSceneIdx(i);
    toast(`已切换到「${SCENES[i].name}」场景`);
  };

  /* ---------- 物理参数微调（实时影响引擎） ---------- */
  const sliderHint = (k: 'drape' | 'gloss' | 'stretch', v: number) => {
    if (k === 'drape') return v >= 0.7 ? '飘逸' : v >= 0.4 ? '适中' : '挺括';
    if (k === 'gloss') return v >= 0.6 ? '缎光' : v >= 0.3 ? '微光' : '哑光';
    return v >= 0.6 ? '高弹' : v >= 0.3 ? '微弹' : '无弹';
  };

  /* ---------- 拖动旋转 ---------- */
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return; // 按钮不触发拖拽
    setDragging(true);
    dragStart.current = e.clientX;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current;
    setRot(Math.max(-16, Math.min(16, dx * 0.08)));
  };
  const endDrag = () => { setDragging(false); setRot(0); };

  /* ---------- 动作播放 ---------- */
  const setPoseKey = (k: PoseKey) => {
    if (k !== 'stand') lastPose.current = k;
    setPose(k);
  };
  const togglePlay = () => setPose((p) => (p === 'stand' ? lastPose.current : 'stand'));

  const collected = hasBodyData(body);
  const fab = fabricById(params.fabric);
  const anim = pose === 'stand' ? undefined : POSE_ANIM[pose];

  /* ---------- 换装变体 ---------- */
  const variantParams = (s: (typeof QUICK_SWAPS)[number]): DesignParams => {
    const f = fabricById(s.fabric);
    return { ...params, pattern: s.pattern, color: s.color, fabric: s.fabric, accent: s.accent, drape: f.drape, gloss: f.gloss, stretch: f.stretch };
  };
  const applySwap = (s: (typeof QUICK_SWAPS)[number]) => {
    setParams(variantParams(s));
    toast(`已换装 · ${s.label}`, 'check');
  };

  const sliderRow = (label: string, k: 'drape' | 'gloss' | 'stretch') => (
    <div style={{ marginBottom: 9 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{sliderHint(k, params[k])}</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.05}
        value={params[k]}
        onChange={(e) => { const patch = { [k]: Number(e.target.value) } as Partial<DesignParams>; setParams((p) => ({ ...p, ...patch })); }}
        style={{ width: '100%', accentColor: 'var(--brand)' }}
      />
    </div>
  );

  return (
    <div className="page no-tab" style={{ paddingBottom: 'calc(84px + var(--safe-bottom))' }}>
      <style>{POSE_CSS}</style>
      <DesignerNav />

      {/* ===== 顶部 NavBar ===== */}
      <NavBar
        title="3D 试衣间"
        back
        backTo="/design/sim3d"
        right={
          <div className="row" style={{ gap: 8 }}>
            <button
              onClick={() => toast('分享链接已生成，快邀请好友一起来试衣吧', 'share')}
              aria-label="分享"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="share" size={16} color="var(--text-2)" />
            </button>
            <button
              onClick={() => toast('试衣快照已保存到相册（模拟）', 'camera')}
              aria-label="截图"
              style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="camera" size={16} color="var(--text-2)" />
            </button>
          </div>
        }
      />

      <div className="page-body" style={{ paddingTop: 6 }}>
        {/* ===== 试衣对象来源 ===== */}
        <div className="row" style={{ justifyContent: 'center', margin: '2px 0 12px' }}>
          <Segmented<SourceKey>
            options={[{ value: 'work', label: '从我的作品' }, { value: 'ai', label: 'AI 灵感' }]}
            value={source}
            onChange={changeSource}
          />
        </div>

        {/* ===== 1. 试穿作品选择条 ===== */}
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 2px 8px' }}>
          {items.map((it) => {
            const on = it.key === selKey;
            return (
              <button
                key={it.key}
                onClick={() => selectItem(it)}
                style={{
                  flexShrink: 0, width: 96, borderRadius: 14, overflow: 'hidden', textAlign: 'left', padding: 0,
                  background: '#fff',
                  border: on ? '1.6px solid var(--brand)' : '1px solid var(--line)',
                  boxShadow: on ? '0 6px 16px rgba(232,92,135,.22)' : '0 1px 3px rgba(40,25,32,.06)',
                  transition: 'all .18s',
                }}
              >
                <div style={{ height: 128, padding: '6px 3px 0', background: '#FBF8F5' }}>
                  <DressCanvas params={it.params} showModel uid={`sel-${it.key}`} />
                </div>
                <div style={{ padding: '7px 8px 9px', borderTop: '1px solid var(--line)' }}>
                  <div className="ellipsis" style={{ fontSize: 12, fontWeight: 600 }}>{it.title}</div>
                  {it.tag && <div className="ellipsis" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{it.tag}</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* ===== 2. 3D 试衣主区 ===== */}
        <div
          ref={stageRef}
          style={{
            position: 'relative', height: '56vh', minHeight: 320, borderRadius: 20, overflow: 'hidden',
            background: sceneBg(scene.id, scene.color), transition: 'background .3s ease',
            userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'pan-y',
          }}
        >
          {/* 场景背景图（仅自定义场景） */}
          {scene.id === 'custom' && (
            <>
              <BgImg src={CUSTOM_BGS[customImg]} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.95 }} />
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,.16)' }} />
            </>
          )}

          {/* 背景切换（横滑圆形色块） */}
          <div style={{ position: 'absolute', top: 10, left: 0, right: 0, zIndex: 5, display: 'flex', gap: 9, overflowX: 'auto', padding: '0 12px 4px' }}>
            {SCENES.map((s, i) => {
              const on = i === sceneIdx;
              return (
                <button key={s.id} onClick={() => pickScene(i)} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', background: s.color,
                    border: on ? '2px solid #fff' : '2px solid rgba(255,255,255,.55)',
                    boxShadow: on ? '0 0 0 2px var(--brand), 0 4px 10px rgba(0,0,0,.26)' : '0 2px 6px rgba(0,0,0,.16)',
                    color: s.id === 'night' ? '#fff' : '#4A4450',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .2s',
                  }}>
                    <Icon name={s.icon as IconName} size={15} />
                  </span>
                  <span style={{
                    fontSize: 9.5, fontWeight: on ? 700 : 500, color: '#fff', lineHeight: 1.2,
                    textShadow: '0 1px 3px rgba(0,0,0,.5)', background: 'rgba(20,14,18,.3)',
                    padding: '1.5px 6px', borderRadius: 99, whiteSpace: 'nowrap',
                  }}>{s.name}</span>
                </button>
              );
            })}
          </div>

          {/* 自定义背景图小图选择 */}
          {scene.id === 'custom' && (
            <div style={{ position: 'absolute', top: 74, left: 0, right: 0, zIndex: 5, display: 'flex', gap: 7, overflowX: 'auto', padding: '0 14px 4px' }}>
              {CUSTOM_BGS.map((src, i) => {
                const on = i === customImg;
                return (
                  <button key={src} onClick={() => { setCustomImg(i); toast('已应用自定义背景图', 'image'); }} style={{ flexShrink: 0 }}>
                    <BgImg src={src} style={{
                      width: 34, height: 34, borderRadius: 8,
                      border: on ? '2px solid #fff' : '2px solid rgba(255,255,255,.5)',
                      boxShadow: on ? '0 0 0 2px var(--brand)' : 'none', display: 'block',
                    }} />
                  </button>
                );
              })}
            </div>
          )}

          {/* 中央画布：拖动 rotateY ±16° + 动作 CSS 动画 */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
              position: 'absolute', inset: 0, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: `${scene.id === 'custom' ? 118 : 66}px 10px 66px`,
            }}
          >
            <div style={{
              width: box.w, height: box.h,
              transform: `perspective(900px) rotateY(${rot}deg)`,
              transformStyle: 'preserve-3d',
              transition: dragging ? 'transform .05s linear' : 'transform .6s cubic-bezier(.22,1,.36,1)',
              cursor: 'grab',
            }}>
              <div style={{
                width: '100%', height: '100%',
                transformOrigin: '50% 55%',
                animation: anim ? `${anim.name} ${anim.dur} ease-in-out infinite` : undefined,
              }}>
                <DressCanvas params={params} body={body} showModel showGrid uid="tryon" />
              </div>
            </div>
          </div>

          {/* 底部：动作预设 + 播放 + 拖动提示 */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 10, zIndex: 6, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{
              pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center',
              background: 'rgba(22,14,22,.52)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 16, padding: '6px 10px 5px',
            }}>
              <div className="row" style={{ gap: 3 }}>
                {POSE_KEYS.map((p) => {
                  const on = pose === p.key;
                  return (
                    <button
                      key={p.key}
                      onClick={() => setPoseKey(p.key)}
                      style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 11.5, whiteSpace: 'nowrap',
                        fontWeight: on ? 700 : 500, color: on ? '#fff' : 'rgba(255,255,255,.78)',
                        background: on ? 'var(--brand-grad)' : 'rgba(255,255,255,.14)',
                        boxShadow: on ? '0 2px 8px rgba(232,92,135,.4)' : 'none', transition: 'all .16s',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
                <button
                  onClick={togglePlay}
                  aria-label={pose === 'stand' ? '播放动态' : '暂停'}
                  style={{
                    marginLeft: 4, width: 26, height: 26, borderRadius: '50%', background: '#fff',
                    color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,.3)',
                  }}
                >
                  <Icon name={pose === 'stand' ? 'play' : 'pause'} size={13} />
                </button>
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.9)', letterSpacing: .5 }}>360° · 拖动旋转</div>
            </div>
          </div>
        </div>

        {/* ===== 3. 体模信息卡 ===== */}
        <div className="card" style={{ marginTop: 12, padding: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="user-filled" size={17} color="var(--brand)" />
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>当前试穿者</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>
                  {collected ? `体型同步自官方App · ${body.updatedAt || '最近更新'}` : '默认体型 · 采集后按你的身材实时生成'}
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/profile/body')}>重新采集</button>
          </div>

          <div style={{ marginTop: 8 }}>
            <Tag variant="primary">一人一版 · 按你的体型生成</Tag>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', background: 'var(--bg)', borderRadius: 12, padding: '9px 2px', marginTop: 10 }}>
            {[
              { l: '身高', v: `${body.height}cm` },
              { l: '胸围', v: `${body.bust}cm` },
              { l: '腰围', v: `${body.waist}cm` },
              { l: '臀围', v: `${body.hip}cm` },
            ].map((c) => (
              <div key={c.l} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{c.v}</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{c.l}</div>
              </div>
            ))}
          </div>

          {!collected && (
            <div className="row" style={{ gap: 10, marginTop: 10, background: 'var(--brand-soft)', borderRadius: 12, padding: '9px 12px' }}>
              <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="ruler" size={15} color="var(--brand)" />
              </span>
              <div className="flex-1">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-deep)' }}>采集体型，生成你的专属版型</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 1 }}>在官方App体型页采集后自动跨端同步</div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => navigate('/profile/body')}>去采集体型</button>
            </div>
          )}
        </div>

        {/* ===== 4. 面料物理模拟控制卡 ===== */}
        <div className="card" style={{ marginTop: 12, padding: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="layers" size={16} color="var(--brand)" />
              </span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700 }}>面料物理模拟</div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>拖动滑块 · 垂坠/光泽实时作用于画布</div>
              </div>
            </div>
            <Tag variant="gold">{fab.weight}</Tag>
          </div>

          <div style={{ margin: '10px 0 12px', padding: '9px 12px', borderRadius: 10, background: 'var(--bg)' }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{fab.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fab.desc}</span>
            </div>
          </div>

          {sliderRow('垂坠感', 'drape')}
          {sliderRow('光泽度', 'gloss')}
          {sliderRow('弹性', 'stretch')}
        </div>

        {/* ===== 5. 快捷换装区 ===== */}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
          <div className="row" style={{ gap: 8 }}>
            <span style={{ width: 3.5, height: 15, borderRadius: 2, background: 'var(--brand-grad)', display: 'inline-block' }} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>快捷换装</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>一键换色 · 换料 · 换图案</div>
            </div>
          </div>
          <button
            onClick={editDesign}
            className="row"
            style={{ gap: 4, padding: '7px 13px', borderRadius: 99, background: 'var(--bg-deep)', fontSize: 12.5, fontWeight: 600 }}
          >
            <Icon name="pen-tool" size={13} color="var(--brand)" />编辑此设计
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '10px 2px 6px' }}>
          {QUICK_SWAPS.map((s, i) => {
            const vp = variantParams(s);
            const active = params.pattern === s.pattern && params.color === s.color && params.fabric === s.fabric;
            const f = fabricById(s.fabric);
            return (
              <button
                key={s.label}
                onClick={() => applySwap(s)}
                style={{
                  flexShrink: 0, width: 88, borderRadius: 14, overflow: 'hidden', textAlign: 'left', padding: 0,
                  background: '#fff',
                  border: active ? '1.6px solid var(--brand)' : '1px solid var(--line)',
                  boxShadow: active ? '0 6px 16px rgba(232,92,135,.2)' : '0 1px 3px rgba(40,25,32,.06)',
                  transition: 'all .18s',
                }}
              >
                <div style={{ height: 118, padding: '5px 3px 0', background: '#FBF8F5' }}>
                  <DressCanvas params={vp} uid={`sw-${i}`} />
                </div>
                <div style={{ padding: '6px 8px 8px', borderTop: '1px solid var(--line)' }}>
                  <div className="ellipsis" style={{ fontSize: 11.5, fontWeight: 700 }}>{s.label}</div>
                  <div className="ellipsis" style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>{f.name} · {f.weight}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
