import type { CategoryKey, DesignParams, GroupKey } from '../../data/design';
import {
  CATEGORY_LABELS, OPTIONS, GROUP_LABELS, APPLICABLE, FABRICS, PATTERNS,
  COLOR_SWATCHES, LENGTH_RANGE, LENGTH_LABEL,
} from '../../data/design';
import Icon from '../Icon';
import type { IconName } from '../Icon';

/* ============ 参数化调节面板（工作台底部） ============ */

export type PanelTab = 'style' | 'fabric' | 'pattern' | 'deco';

export function CategoryRow({ value, onChange, dark }: { value: CategoryKey; onChange: (c: CategoryKey) => void; dark?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 8px' }}>
      {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((c) => {
        const on = c === value;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            style={{
              flexShrink: 0, padding: '7px 15px', borderRadius: 99, fontSize: 13,
              fontWeight: on ? 700 : 500, whiteSpace: 'nowrap',
              color: on ? '#fff' : dark ? 'rgba(255,255,255,.75)' : 'var(--text-2)',
              background: on ? 'var(--brand-grad)' : dark ? 'rgba(255,255,255,.12)' : 'var(--bg-deep)',
              boxShadow: on ? '0 4px 12px rgba(232,92,135,.35)' : 'none',
              transition: 'all .16s',
            }}
          >
            {CATEGORY_LABELS[c]}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  params: DesignParams;
  onChange: (patch: Partial<DesignParams>) => void;
  tab: PanelTab;
  onTab: (t: PanelTab) => void;
  compact?: boolean;
}

const TAB_LIST: { key: PanelTab; label: string; icon: IconName }[] = [
  { key: 'style', label: '款式', icon: 'scissors' },
  { key: 'fabric', label: '面料', icon: 'layers' },
  { key: 'pattern', label: '图案', icon: 'grid' },
  { key: 'deco', label: '装饰', icon: 'sparkle' },
];

export default function ParamPanel({ params, onChange, tab, onTab, compact }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶部 Tab */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--line)' }}>
        {TAB_LIST.map((t) => (
          <button
            key={t.key}
            onClick={() => onTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '10px 0', fontSize: 13.5, fontWeight: tab === t.key ? 700 : 500,
              color: tab === t.key ? 'var(--brand-deep)' : 'var(--text-2)',
              borderBottom: tab === t.key ? '2.5px solid var(--brand)' : '2.5px solid transparent',
            }}
          >
            <Icon name={t.icon} size={15} />{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: compact ? 8 : 12 }}>
        {tab === 'style' && <StyleTab params={params} onChange={onChange} />}
        {tab === 'fabric' && <FabricTab params={params} onChange={onChange} />}
        {tab === 'pattern' && <PatternTab params={params} onChange={onChange} />}
        {tab === 'deco' && <DecoTab params={params} onChange={onChange} />}
      </div>
    </div>
  );
}

/* ---------- 通用：chips 行 ---------- */
function Chips({ options, value, onPick, cols }: {
  options: { v: string; label: string }[]; value: string; onPick: (v: string) => void; cols?: number;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, overflowX: cols ? 'auto' : undefined }}>
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button
            key={o.v}
            onClick={() => onPick(o.v)}
            style={{
              flexShrink: 0, padding: '6px 12px', borderRadius: 99, fontSize: 12.5,
              whiteSpace: 'nowrap',
              color: on ? '#fff' : 'var(--text-2)',
              background: on ? 'var(--brand-grad)' : 'var(--bg-deep)',
              boxShadow: on ? '0 3px 10px rgba(232,92,135,.3)' : 'none',
              transition: 'all .15s',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function GroupRow({ g, params, onChange }: { g: Exclude<GroupKey, 'length'>; params: DesignParams; onChange: (p: Partial<DesignParams>) => void }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--brand)' }} />
        {GROUP_LABELS[g]}
      </div>
      <Chips options={OPTIONS[g]} value={params[g]} onPick={(v) => onChange({ [g]: v } as Partial<DesignParams>)} />
    </div>
  );
}

/* ---------- 款式 Tab：18 类元素 ---------- */
function StyleTab({ params, onChange }: { params: DesignParams; onChange: (p: Partial<DesignParams>) => void }) {
  const groups = APPLICABLE[params.category].filter((g) => g !== 'length');
  const len = LENGTH_RANGE[params.category];
  return (
    <div>
      {groups.map((g) => (
        <GroupRow key={g} g={g} params={params} onChange={onChange} />
      ))}
      {/* 精确长度滑块（长度类元素始终展示在款式页） */}
      {APPLICABLE[params.category].includes('length') && (
        <div style={{ marginTop: 4 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>精确长度（cm）</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-deep)' }}>
              {params.lengthCm}cm · {LENGTH_LABEL(params.category, params.lengthCm)}
            </span>
          </div>
          <input
            type="range"
            min={len.min} max={len.max} step={1}
            value={params.lengthCm}
            onChange={(e) => onChange({ lengthCm: Number(e.target.value) })}
            style={{ width: '100%', accentColor: 'var(--brand)' }}
          />
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
            <span>{len.min}cm</span><span>{len.max}cm</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 面料 Tab ---------- */
function FabricTab({ params, onChange }: { params: DesignParams; onChange: (p: Partial<DesignParams>) => void }) {
  const pickFabric = (id: string) => {
    const f = FABRICS.find((x) => x.id === id);
    if (!f) return;
    onChange({ fabric: id, drape: f.drape, gloss: f.gloss, stretch: f.stretch });
  };
  const slider = (label: string, key: 'drape' | 'gloss' | 'stretch', hint: string) => (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{hint}</span>
      </div>
      <input
        type="range" min={0} max={1} step={0.05}
        value={params[key]}
        onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<DesignParams>)}
        style={{ width: '100%', accentColor: 'var(--brand)' }}
      />
    </div>
  );
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {FABRICS.map((f) => {
          const on = params.fabric === f.id;
          return (
            <button
              key={f.id}
              onClick={() => pickFabric(f.id)}
              style={{
                padding: '8px 4px', borderRadius: 10, textAlign: 'center',
                border: on ? '1.6px solid var(--brand)' : '1px solid var(--line)',
                background: on ? 'var(--brand-soft)' : '#fff',
                transition: 'all .15s',
              }}
            >
              <div style={{ fontSize: 12.5, fontWeight: 700, color: on ? 'var(--brand-deep)' : 'var(--text)' }}>{f.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>{f.weight}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 14, padding: '12px', background: 'var(--bg)', borderRadius: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>物理参数微调（实时影响 3D 垂坠/光泽）</div>
        {slider('垂坠感', 'drape', params.drape >= 0.7 ? '飘逸' : params.drape >= 0.4 ? '适中' : '挺括')}
        {slider('光泽度', 'gloss', params.gloss >= 0.6 ? '缎光' : params.gloss >= 0.3 ? '微光' : '哑光')}
        {slider('弹性', 'stretch', params.stretch >= 0.6 ? '高弹' : params.stretch >= 0.3 ? '微弹' : '无弹')}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>颜色</div>
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          {COLOR_SWATCHES.map((c) => {
            const on = params.color.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                style={{
                  width: 30, height: 30, borderRadius: '50%', background: c,
                  border: on ? '2.5px solid var(--brand)' : '2px solid rgba(0,0,0,.08)',
                  boxShadow: on ? '0 0 0 2px #fff, 0 0 0 4px var(--brand)' : 'none',
                  transition: 'all .15s',
                }}
              />
            );
          })}
          <label
            style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'conic-gradient(#f87171,#fbbf24,#4ade80,#22d3ee,#a78bfa,#f87171)',
              border: '2px solid rgba(0,0,0,.1)', cursor: 'pointer',
            }}
          >
            <input
              type="color" value={params.color}
              onChange={(e) => onChange({ color: e.target.value })}
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
            />
            <Icon name="plus" size={12} color="#fff" />
          </label>
        </div>
      </div>
    </div>
  );
}

/* ---------- 图案 Tab ---------- */
function PatternTab({ params, onChange }: { params: DesignParams; onChange: (p: Partial<DesignParams>) => void }) {
  const ACCENTS = ['#C2544E', '#7E2E3A', '#9A7A1E', '#2A3B5C', '#3E6B4F', '#5A6650', '#6B6470', '#B0544C'];
  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 6 }}>面料图案</div>
      <Chips options={PATTERNS} value={params.pattern} onPick={(v) => onChange({ pattern: v })} />
      {params.pattern !== 'none' && (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '12px 0 6px' }}>印花位置</div>
          <Chips options={OPTIONS.printPos} value={params.printPos} onPick={(v) => onChange({ printPos: v })} />
        </>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '12px 0 6px' }}>辅助色（图案/装饰用）</div>
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
        {ACCENTS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ accent: c })}
            style={{
              width: 26, height: 26, borderRadius: '50%', background: c,
              border: params.accent.toLowerCase() === c.toLowerCase() ? '2.5px solid var(--brand)' : '2px solid rgba(0,0,0,.08)',
              boxShadow: params.accent.toLowerCase() === c.toLowerCase() ? '0 0 0 2px #fff, 0 0 0 4px var(--brand)' : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ---------- 装饰 Tab（5 类快捷入口） ---------- */
function DecoTab({ params, onChange }: { params: DesignParams; onChange: (p: Partial<DesignParams>) => void }) {
  const quick: { label: string; icon: IconName; patch: Partial<DesignParams> }[] = [
    { label: '刺绣花卉', icon: 'sparkle', patch: { ornament: 'embroidery', buttons: 'none', stitch: 'hidden', lining: 'none', zipper: 'none' } },
    { label: '蝴蝶结', icon: 'gift', patch: { ornament: 'bow', buttons: 'none', stitch: 'hidden', lining: 'none', zipper: 'none' } },
    { label: '珍珠点缀', icon: 'award', patch: { ornament: 'pearls', buttons: 'none', stitch: 'hidden', lining: 'none', zipper: 'none' } },
    { label: '蕾丝花边', icon: 'camera', patch: { ornament: 'lace', buttons: 'none', stitch: 'hidden', lining: 'half', zipper: 'hidden' } },
    { label: '撞色明线', icon: 'pen-tool', patch: { stitch: 'contrast', ornament: 'none', buttons: 'none', lining: 'none', zipper: 'none' } },
    { label: '金属双排扣', icon: 'crown', patch: { placket: 'double', buttons: 'metal', ornament: 'none', stitch: 'visible', lining: 'none', zipper: 'none' } },
    { label: '系带收腰', icon: 'send', patch: { placket: 'tie', buttons: 'none', ornament: 'none', stitch: 'hidden', lining: 'none', zipper: 'none' } },
  ];
  return (
    <div>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>一键风格装饰</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
        {quick.map((q) => (
          <button
            key={q.label}
            onClick={() => onChange(q.patch)}
            className="row"
            style={{ gap: 5, padding: '9px 6px', borderRadius: 10, border: '1px solid var(--line)', background: '#fff', fontSize: 12, fontWeight: 600, justifyContent: 'center' }}
          >
            <Icon name={q.icon} size={14} color="var(--brand)" />{q.label}
          </button>
        ))}
      </div>

      <div style={{ height: 1, background: 'var(--line)', margin: '14px 0' }} />

      <GroupRow g="ornament" params={params} onChange={onChange} />
      <GroupRow g="buttons" params={params} onChange={onChange} />
      <GroupRow g="stitch" params={params} onChange={onChange} />
      <GroupRow g="lining" params={params} onChange={onChange} />
      <GroupRow g="zipper" params={params} onChange={onChange} />
    </div>
  );
}
