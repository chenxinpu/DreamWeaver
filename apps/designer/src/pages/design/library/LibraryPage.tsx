/* =========================================================
 * 织梦 · 服装设计师 App — 素材库（路由 /design/library）
 * Segmented：面料 / 图案 / 辅料 / 色卡
 * 搜索过滤当前素材 · 卡片点击弹详情 / 复制 toast · 底部 DesignerNav
 * ========================================================= */
import { useMemo, useState } from 'react';
import type { SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon';
import { Segmented, Sheet, useToast } from '../../../components/Sheet';
import { Tag } from '../../../components/ui';
import DesignerNav from '../../../components/design/DesignerNav';
import { COLOR_SWATCHES, FABRICS, PATTERNS } from '../../../data/design';
import type { FabricDef } from '../../../data/design';
import { K, isIn, toggleId } from '../../../utils/store';
import { feelColor } from '../home/parts';

/* ---------------- 类型与常量 ---------------- */
type TabKey = 'fabric' | 'pattern' | 'acc' | 'color';
const TABS: { value: TabKey; label: string }[] = [
  { value: 'fabric', label: '面料' },
  { value: 'pattern', label: '图案' },
  { value: 'acc', label: '辅料' },
  { value: 'color', label: '色卡' },
];
const TAB_HINT: Record<TabKey, string> = {
  fabric: '16 种常用面料 · 参数驱动 3D 物理模拟',
  pattern: '7 种图案 · 可作画布区域填充',
  acc: '10 种常用辅料 · 工艺单 BOM 参考',
  color: '14 个常用女装配色 · 点击即复制色值',
};

interface AccDef { id: string; name: string; group: string; mat: string; use: string; color: string; soft: string }
const ACCESSORIES: AccDef[] = [
  { id: 'btn-resin', name: '树脂纽扣', group: '纽扣', mat: '聚酯树脂 · 温润轻量', use: '衬衫 / 大衣 / 童装', color: '#C89B63', soft: '#FBF3E6' },
  { id: 'btn-metal', name: '金属纽扣', group: '纽扣', mat: '锌合金 / 黄铜 · 复古光泽', use: '外套 / 牛仔 / 工装', color: '#8B94A3', soft: '#EFF1F5' },
  { id: 'btn-cover', name: '包布纽扣', group: '纽扣', mat: '同面料包覆 · 质感统一', use: '连衣裙 / 礼服 / 小香风', color: '#D97E9F', soft: '#FBEAF1' },
  { id: 'zip-hidden', name: '隐形拉链', group: '拉链', mat: '尼龙链齿 · 顺滑隐形', use: '裙装侧缝 / 后背开合', color: '#7A6BA6', soft: '#F3EEFB' },
  { id: 'zip-metal', name: '金属拉链', group: '拉链', mat: '合金链齿 · 硬朗耐用', use: '牛仔裤 / 夹克 / 工装', color: '#A8A06A', soft: '#F2F1E9' },
  { id: 'lace', name: '蕾丝花边', group: '花边', mat: '棉 / 锦纶机绣 · 精致镂空', use: '领口 / 袖口 / 下摆点缀', color: '#D9899B', soft: '#FBEFF0' },
  { id: 'patch', name: '刺绣贴', group: '贴饰', mat: '机绣贴布 · 可缝可烫', use: '局部点缀 / 修补 / 个性装饰', color: '#D96A8C', soft: '#FDEFF2' },
  { id: 'pearl', name: '珍珠', group: '贴饰', mat: '仿珍珠 / 淡水珍珠', use: '领口 / 扣饰 / 下摆流苏', color: '#C9A98A', soft: '#F7F3EE' },
  { id: 'webbing', name: '织带', group: '辅料', mat: '涤纶 / 棉 · 耐磨挺括', use: '束腰 / 肩带 / 滚边装饰', color: '#8A7BC4', soft: '#F0EEFB' },
  { id: 'bow', name: '蝴蝶结', group: '装饰', mat: '缎面 / 欧根纱 · 灵动甜美', use: '领口 / 腰饰 / 发饰', color: '#E56A90', soft: '#FBEDF2' },
];

/** 图案示意背景（纯 CSS） */
const PATTERN_BG: Record<string, string> = {
  none: '#F0EBE4',
  floral: 'radial-gradient(circle 3.2px at 24% 28%, #E8A0B0 96%, transparent), radial-gradient(circle 3.2px at 62% 20%, #E0A458 96%, transparent), radial-gradient(circle 3.2px at 80% 52%, #C2544E 96%, transparent), radial-gradient(circle 3.2px at 36% 62%, #E8A0B0 96%, transparent), radial-gradient(circle 3.2px at 62% 82%, #D44771 96%, transparent), #FBF1EA',
  stripe: 'repeating-linear-gradient(90deg, #E85C87 0 9px, #FBEDF2 9px 19px)',
  plaid: 'linear-gradient(0deg, rgba(43,43,48,.14) 0 2px, transparent 2px 18px), linear-gradient(90deg, rgba(43,43,48,.14) 0 2px, transparent 2px 18px), linear-gradient(0deg, rgba(201,162,63,.35) 0 9px, transparent 9px 46px), #F6EEE0',
  polka: 'radial-gradient(circle 2.8px at 5px 5px, #7E2E3A 97%, transparent) 0 0 / 13px 13px repeat, #FBF4EC',
  geo: 'repeating-linear-gradient(135deg, transparent 0 7px, rgba(74,120,181,.32) 7px 9px), repeating-linear-gradient(45deg, transparent 0 7px, rgba(74,120,181,.22) 7px 9px), #EDF3FA',
};

/* ---------------- 小组件 ---------------- */

/** 面料 3 属性迷你条 */
function FeelBar({ label, v }: { label: string; v: number }) {
  return (
    <span style={{ flex: 1, display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 9, color: 'var(--text-3)' }}>{label}</span>
      <span style={{ display: 'block', height: 4, marginTop: 3, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.round(v * 100)}%`, background: 'linear-gradient(90deg,#F3B8CB,#E85C87)', borderRadius: 99 }} />
      </span>
    </span>
  );
}

/** 属性参数条（只读条形，详情 Sheet 用） */
function PhysBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <span style={{ display: 'block' }}>
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{Math.round(v * 100)}%</span>
      </span>
      <span style={{ display: 'block', height: 7, marginTop: 6, borderRadius: 99, background: 'var(--bg-deep)', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${Math.round(v * 100)}%`, background: color, borderRadius: 99 }} />
      </span>
    </span>
  );
}

/** 辅料图形（手绘小 SVG） */
function AccGlyph({ a, size = 27 }: { a: AccDef; size?: number }) {
  const svg: SVGProps<SVGSVGElement> = {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  const c = a.color;
  const hole = { fill: c, stroke: 'none' } as const;
  switch (a.id) {
    case 'btn-resin':
      return (
        <svg {...svg}><circle cx="12" cy="12" r="8.4" fill="#FBF1DE" stroke={c} /><circle cx="9.7" cy="12" r="1.2" {...hole} /><circle cx="14.3" cy="12" r="1.2" {...hole} /><path d="M8.5 8.5l7 7" opacity={.35} /></svg>
      );
    case 'btn-metal':
      return (
        <svg {...svg}><circle cx="12" cy="12" r="8.4" fill="#F2F4F7" stroke={c} /><circle cx="12" cy="12" r="5.4" strokeDasharray="1.4 2.2" stroke={c} /><circle cx="9.7" cy="12" r="1.1" {...hole} /><circle cx="14.3" cy="12" r="1.1" {...hole} /><path d="M6.9 9.4a5.6 5.6 0 0 1 2.6-2.4" opacity={.5} /></svg>
      );
    case 'btn-cover':
      return (
        <svg {...svg}><circle cx="12" cy="12" r="8.4" fill="#FDE8F0" stroke={c} /><circle cx="12" cy="12" r="5.2" strokeDasharray="3 2" stroke={c} opacity={.8} /><circle cx="10" cy="10" r="1" {...hole} /><circle cx="14" cy="14" r="1" {...hole} /></svg>
      );
    case 'zip-hidden':
      return (
        <svg {...svg}><rect x="5.4" y="3.6" width="13.2" height="16.8" rx="2.6" fill="#F4F0FB" stroke={c} /><path d="M12 6.4v11.2" strokeWidth={1.4} /><rect x="9.3" y="7" width="5.4" height="4.2" rx="1.3" fill={c} stroke="none" /><circle cx="12" cy="12.6" r="1.5" fill="#fff" stroke={c} strokeWidth={1.2} /></svg>
      );
    case 'zip-metal':
      return (
        <svg {...svg}><rect x="5.4" y="3.6" width="13.2" height="16.8" rx="2.6" fill="#FAF9F2" stroke={c} /><path d="M8 8.6v6.8M16 8.6v6.8" strokeWidth={.9} strokeDasharray="1.4 1.6" /><path d="M12 6.4v11.2" strokeWidth={1.2} /><rect x="9.3" y="7" width="5.4" height="4.2" rx="1.3" fill={c} stroke="none" /></svg>
      );
    case 'lace':
      return (
        <svg {...svg}><path d="M5.2 19a3.4 3.4 0 0 1 6.8 0M12 19a3.4 3.4 0 0 1 6.8 0" /><path d="M2.8 19h18.4" strokeWidth={1.2} /><path d="M6.4 11.8v-1.4a2.6 2.6 0 0 1 2.6-2.6" opacity={.5} /><circle cx="15.4" cy="9.6" r="1.6" opacity={.55} /></svg>
      );
    case 'patch':
      return (
        <svg {...svg}><rect x="4.8" y="4.8" width="14.4" height="14.4" rx="3.6" fill="#FDEDF3" stroke={c} /><rect x="7.4" y="7.4" width="9.2" height="9.2" rx="2.4" strokeDasharray="1.6 1.8" opacity={.55} /><circle cx="12" cy="12" r="1.8" fill={c} stroke="none" /><circle cx="12" cy="6.8" r="1.5" /><circle cx="12" cy="17.2" r="1.5" /><circle cx="6.8" cy="12" r="1.5" /><circle cx="17.2" cy="12" r="1.5" /></svg>
      );
    case 'pearl':
      return (
        <svg {...svg}><circle cx="8" cy="15.6" r="2.7" fill="#FFFDF7" stroke={c} /><circle cx="13" cy="12" r="3.3" fill="#FFFDF7" stroke={c} /><circle cx="17.4" cy="9.2" r="2.2" fill="#FFFDF7" stroke={c} /><path d="M8 13.9a1.7 1.7 0 0 1 1.5 1.2M13 10a2 2 0 0 1 1.9 1.4" stroke="#fff" strokeWidth={1} /></svg>
      );
    case 'webbing':
      return (
        <svg {...svg}><rect x="3.4" y="8.8" width="17.2" height="6.4" rx="3.2" fill="#F3F0FB" stroke={c} /><path d="M8 12h8" stroke={c} strokeWidth={1} strokeDasharray="1.6 2.2" /><path d="M6.6 8.8v6.4M17.4 8.8v6.4" stroke={c} strokeWidth={.8} /></svg>
      );
    default: /* bow */
      return (
        <svg {...svg}><circle cx="7.4" cy="9.6" r="4.3" fill="#FDE9F0" stroke={c} /><circle cx="16.6" cy="9.6" r="4.3" fill="#FDE9F0" stroke={c} /><rect x="10.5" y="7.6" width="3" height="4.4" rx="1.5" fill={c} stroke="none" /><path d="M10.6 12.6c-.5 2-.9 4-1.7 6M13.4 12.6c.5 2 .9 4 1.7 6" strokeWidth={1.5} /></svg>
      );
  }
}

/** 面料详情 Sheet */
function FabricSheet({ f, onUse }: { f: FabricDef; onUse: () => void }) {
  const toast = useToast();
  const [fav, setFav] = useState(() => isIn(K.favs, `fabric:${f.id}`));
  const toggleFav = () => {
    const now = toggleId(K.favs, `fabric:${f.id}`);
    setFav(now);
    toast(now ? `已收藏「${f.name}」` : '已取消收藏', now ? 'heart-filled' : 'heart');
  };
  return (
    <div style={{ paddingBottom: 26 }}>
      <div className="row" style={{ gap: 14 }}>
        <span style={{ width: 62, height: 62, borderRadius: 18, background: feelColor(f.id), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,.65)', flexShrink: 0 }}>
          <Icon name="layers" size={24} color="rgba(60,40,70,.5)" />
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 18, fontWeight: 800 }}>{f.name}</span>
            <Tag variant="gray">{f.weight}</Tag>
          </span>
          <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, color: 'var(--text-2)' }}>{f.desc}</span>
        </span>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12 }}>物理参数（3D 模拟表现）</div>
        <span className="col" style={{ gap: 13 }}>
          <PhysBar label="垂坠感 Drape" v={f.drape} color="var(--brand-grad)" />
          <PhysBar label="光泽度 Gloss" v={f.gloss} color="linear-gradient(90deg,#E8C9A0,#C9A23F)" />
          <PhysBar label="弹性 Stretch" v={f.stretch} color="linear-gradient(90deg,#A6C8EF,#5E8FD0)" />
        </span>
      </div>

      <div style={{ marginTop: 16, padding: '11px 13px', borderRadius: 13, background: 'var(--bg-deep)', fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
        该面料将参与 3D 模拟中的物理表现：垂坠影响裙摆、光泽影响质感、弹性影响贴合度。
      </div>

      <div className="row" style={{ gap: 10, marginTop: 20 }}>
        <button
          onClick={toggleFav}
          className="btn"
          style={{ flexShrink: 0, padding: '0 16px', height: 46, borderRadius: 99, background: fav ? 'var(--brand-soft)' : '#fff', border: fav ? '1.5px solid var(--brand)' : '1.5px solid var(--line)', color: fav ? 'var(--brand-deep)' : 'var(--text-2)', fontWeight: 700 }}
        >
          <Icon name={fav ? 'heart-filled' : 'heart'} size={17} />
          {fav ? '已收藏' : '收藏'}
        </button>
        <button className="btn btn-primary flex-1" onClick={onUse} style={{ height: 46 }}>
          <Icon name="dress" size={17} />用此面料做 3D 模拟
        </button>
      </div>
    </div>
  );
}

/** 辅料详情 Sheet */
function AccSheet({ a }: { a: AccDef }) {
  const toast = useToast();
  return (
    <div style={{ paddingBottom: 26 }}>
      <div className="row" style={{ gap: 14 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: a.soft, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AccGlyph a={a} size={30} />
        </span>
        <span>
          <span className="row" style={{ gap: 8 }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{a.name}</span>
            <Tag variant="line">{a.group}</Tag>
          </span>
          <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: 'var(--text-3)' }}>{a.use}</span>
        </span>
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ padding: '12px 13px', borderRadius: 13, background: 'var(--bg-deep)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>材质说明</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>{a.mat}</div>
        </div>
        <div style={{ padding: '12px 13px', borderRadius: 13, background: 'var(--bg-deep)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>适用位置</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 600 }}>{a.use}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
        加入工艺单 BOM 后，可随订单同步采购与排料；同款也可在 2D 画布中作装饰参考。
      </div>
      <button
        className="btn btn-primary btn-block"
        style={{ marginTop: 18, height: 46 }}
        onClick={() => { toast('已加入工艺单 BOM · 画布填充可用', 'check'); }}
      >
        <Icon name="receipt" size={17} />加入工艺单 BOM（模拟）
      </button>
    </div>
  );
}

/* ---------------- 页面 ---------------- */
export default function LibraryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('fabric');
  const [q, setQ] = useState('');
  const [selF, setSelF] = useState<FabricDef | null>(null);
  const [selA, setSelA] = useState<AccDef | null>(null);
  const [cust, setCust] = useState('#E85C87');

  const kw = q.trim().toLowerCase();
  const fabrics = useMemo(() => FABRICS.filter((f) => !kw || f.name.includes(kw) || f.desc.includes(kw) || f.weight.includes(kw)), [kw]);
  const patterns = useMemo(() => PATTERNS.filter((p) => !kw || p.label.includes(kw)), [kw]);
  const accs = useMemo(() => ACCESSORIES.filter((a) => !kw || a.name.includes(kw) || a.mat.includes(kw) || a.use.includes(kw)), [kw]);
  const colors = useMemo(() => COLOR_SWATCHES.filter((c) => !kw || c.includes(kw)), [kw]);

  const copyHex = (hex: string) => {
    try { if (navigator.clipboard) navigator.clipboard.writeText(hex); } catch { /* 模拟 */ }
    toast(`已复制色值 ${hex.toUpperCase()}`, 'copy');
  };

  const applyFabric = (f: FabricDef) => {
    toast(`将在 3D 模拟中选用「${f.name}」`, 'dress');
    navigate(`/design/studio?fabric=${f.id}`);
  };

  const emptyBox = (text: string) => (
    <div style={{ textAlign: 'center', padding: '44px 0 30px', color: 'var(--text-3)' }}>
      <Icon name="search" size={26} />
      <div style={{ marginTop: 10, fontSize: 12.5 }}>{text}</div>
    </div>
  );

  return (
    <div className="page" style={{ paddingBottom: 'calc(104px + var(--safe-bottom))' }}>
      {/* ============ 头部 ============ */}
      <div style={{ padding: '20px 16px 0', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -30, width: 130, height: 130, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,92,135,.16), rgba(232,92,135,0) 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 60, left: -44, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(110,90,168,.12), rgba(110,90,168,0) 70%)', pointerEvents: 'none' }} />
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--brand-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 5px 12px rgba(232,92,135,.32)' }}>
                <Icon name="layers" size={17} />
              </span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>素材库</span>
            </div>
            <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--text-3)' }}>挑面料 · 配图案 · 攒辅料，一键带入设计</div>
          </div>
          <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: '#7A66B8', background: 'rgba(110,90,168,.1)', borderRadius: 99, padding: '4px 9px', lineHeight: 1.5 }}>
            16 面料 · 7 图案 · 10 辅料
          </span>
        </div>

        {/* 搜索框 */}
        <div style={{ position: 'relative', marginTop: 14 }}>
          <span style={{ position: 'absolute', left: 13, top: 0, bottom: 0, display: 'flex', alignItems: 'center', color: 'var(--text-3)' }}>
            <Icon name="search" size={16} />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索面料 / 图案…"
            style={{ width: '100%', height: 42, borderRadius: 99, border: '1px solid var(--line)', background: '#fff', padding: '0 38px 0 38px', fontSize: 13.5, outline: 'none', boxShadow: '0 2px 10px rgba(90,60,100,.05)' }}
          />
          {q && (
            <button
              onClick={() => setQ('')}
              style={{ position: 'absolute', right: 8, top: 0, bottom: 0, display: 'flex', alignItems: 'center', padding: 6, color: 'var(--text-3)' }}
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {/* Segmented Tabs */}
        <div style={{ marginTop: 14 }}>
          <Segmented options={TABS} value={tab} onChange={setTab} equal />
        </div>
        <div style={{ margin: '10px 2px 0', fontSize: 11, color: 'var(--text-3)' }}>{TAB_HINT[tab]}</div>
      </div>

      {/* ============ 内容 ============ */}
      <div style={{ padding: '12px 16px 4px' }}>
        {/* ---- 面料 ---- */}
        {tab === 'fabric' && (
          fabrics.length === 0 ? emptyBox('未找到相关面料') : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {fabrics.map((f) => (
                <button key={f.id} onClick={() => setSelF(f)} className="card fade-in" style={{ padding: '11px 11px 10px', textAlign: 'left', display: 'flex', flexDirection: 'column', minHeight: 116 }}>
                  <span className="row" style={{ gap: 7 }}>
                    <span style={{ width: 11, height: 11, borderRadius: '50%', background: feelColor(f.id), border: '2px solid #fff', boxShadow: '0 0 0 1px var(--line)', flexShrink: 0 }} />
                    <span className="flex-1 ellipsis" style={{ fontSize: 13, fontWeight: 700 }}>{f.name}</span>
                    <span style={{ fontSize: 9.5, color: 'var(--text-3)', flexShrink: 0 }}>{f.weight}</span>
                  </span>
                  <span className="ellipsis" style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-3)' }}>{f.desc}</span>
                  <span style={{ marginTop: 'auto', paddingTop: 9, display: 'flex', gap: 8 }}>
                    <FeelBar label="垂坠" v={f.drape} />
                    <FeelBar label="光泽" v={f.gloss} />
                    <FeelBar label="弹性" v={f.stretch} />
                  </span>
                </button>
              ))}
            </div>
          )
        )}

        {/* ---- 图案 ---- */}
        {tab === 'pattern' && (
          patterns.length === 0 ? emptyBox('未找到相关图案') : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {patterns.map((p) => (
                <button
                  key={p.v}
                  onClick={() => toast(`已复制「${p.label}」图案到剪贴板（模拟）· 可在画布填充`, 'copy')}
                  className="card fade-in"
                  style={{ padding: 6, borderRadius: 15 }}
                >
                  <span
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', height: 66, borderRadius: 11,
                      background: p.v === 'dots2' ? '#FDF2F5' : PATTERN_BG[p.v] || '#F0EBE4',
                    }}
                  >
                    {p.v === 'dots2' && (
                      <span style={{ fontSize: 25, color: '#E85C87', textShadow: '0 0 0 2px rgba(232,92,135,.12)' }}>♥</span>
                    )}
                    {p.v === 'none' && <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 3 }}>纯 色</span>}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '8px 0 4px', fontSize: 12.5, fontWeight: 700 }}>
                    {p.label}
                    <Icon name="copy" size={12} color="var(--text-3)" />
                  </span>
                </button>
              ))}
            </div>
          )
        )}

        {/* ---- 辅料 ---- */}
        {tab === 'acc' && (
          accs.length === 0 ? emptyBox('未找到相关辅料') : (
            <span className="col" style={{ gap: 9 }}>
              {accs.map((a) => (
                <button key={a.id} onClick={() => setSelA(a)} className="card row fade-in" style={{ padding: '10px 12px', gap: 12, textAlign: 'left' }}>
                  <span style={{ width: 44, height: 44, borderRadius: 13, background: a.soft, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <AccGlyph a={a} />
                  </span>
                  <span className="flex-1" style={{ minWidth: 0 }}>
                    <span className="row" style={{ gap: 6 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700 }}>{a.name}</span>
                      <Tag variant="line">{a.group}</Tag>
                    </span>
                    <span className="ellipsis" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>{a.mat} · {a.use}</span>
                  </span>
                  <Icon name="chevron-right" size={15} color="var(--text-3)" />
                </button>
              ))}
            </span>
          )
        )}

        {/* ---- 色卡 ---- */}
        {tab === 'color' && (
          colors.length === 0 ? emptyBox('未找到相关色值') : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {colors.map((c) => (
                  <button key={c} onClick={() => copyHex(c)} className="fade-in" style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'block', width: '100%', aspectRatio: '1 / 1', borderRadius: 14,
                        background: c, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.06), 0 2px 6px rgba(0,0,0,.05)',
                        position: 'relative',
                      }}
                    >
                      <span style={{ position: 'absolute', right: 6, bottom: 6, width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6470' }}>
                        <Icon name="copy" size={10} />
                      </span>
                    </span>
                    <span style={{ display: 'block', marginTop: 6, fontSize: 9, color: 'var(--text-3)' }}>{c.toUpperCase()}</span>
                  </button>
                ))}
              </div>

              {/* 自定义颜色 */}
              <div className="card row fade-in" style={{ marginTop: 16, padding: '12px 14px', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>自定义</span>
                <input
                  type="color"
                  value={cust}
                  onChange={(e) => setCust(e.target.value)}
                  style={{ width: 40, height: 40, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                />
                <button
                  className="row"
                  style={{ gap: 8, flex: 1, textAlign: 'left' }}
                  onClick={() => copyHex(cust)}
                >
                  <span style={{ width: 22, height: 22, borderRadius: 8, background: cust, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.1)', display: 'inline-block' }} />
                  <span className="flex-1">
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{cust.toUpperCase()}</span>
                    <span style={{ display: 'block', fontSize: 10, color: 'var(--text-3)' }}>取色器选色 · 点击复制色值</span>
                  </span>
                </button>
              </div>
            </>
          )
        )}
      </div>

      {/* ============ 详情弹层 ============ */}
      <Sheet open={!!selF} onClose={() => setSelF(null)} title="面料详情">
        {selF && <FabricSheet key={selF.id} f={selF} onUse={() => { applyFabric(selF); setSelF(null); }} />}
      </Sheet>
      <Sheet open={!!selA} onClose={() => setSelA(null)} title="辅料详情">
        {selA && <AccSheet key={selA.id} a={selA} />}
      </Sheet>

      <DesignerNav />
    </div>
  );
}
