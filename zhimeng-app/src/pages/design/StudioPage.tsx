/* =========================================================
 * 设计工作台 StudioPage（路由 /design/studio）
 * 参数化服装设计 + AI 辅助创作 沉浸式编辑器
 * 结构：顶部工具栏 / 3D 画布区（拖动旋转·缩放）/ 底部参数面板（AI 工具箱 + ParamPanel）
 * ========================================================= */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { Sheet, useToast } from '../../components/Sheet';
import ParamPanel, { CategoryRow } from '../../components/design/ParamPanel';
import type { PanelTab } from '../../components/design/ParamPanel';
import DressCanvas from '../../components/design/DressCanvas';
import type { AiCandidate, DesignParams, GroupKey } from '../../data/design';
import {
  AI_CANDIDATES, CATEGORY_LABELS, DEFAULT_PARAMS, OPTIONS, PATTERNS, applyCandidate, fabricById,
} from '../../data/design';
import { useDesignWorks } from '../../utils/designStore';
import { DEFAULT_BODY, K, recommendSize, useBody, useLocalState } from '../../utils/store';
import type { BodyMeasurement } from '../../data/types';

/* ---------------- 工具与常量 ---------------- */

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const HISTORY_LIMIT = 30;

/** 选项值 → 中文标签 */
const labelOf = (g: GroupKey, v: string) => OPTIONS[g].find((o) => o.v === v)?.label || v;

/** 图案值 → 中文标签 */
const patternLabel = (v: string) => PATTERNS.find((p) => p.v === v)?.label || v;

/** 是否已采集过真实体型（localStorage 存在且 ≠ 默认值） */
const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

const GEN_PHASES = ['理解你的需求…', '勾勒服装轮廓…', '渲染面料质感…', '生成 5 款候选…'];
const GEN_IDEAS = [
  '适合约会的法式碎花泡泡袖连衣裙',
  '晚宴穿的光泽缎面吊带裙',
  '通勤的燕麦色极简羊毛大衣',
  '假日波点 A 字茶歇裙',
  '学院风格纹长袖衬衫',
];

const SKETCH_SRC: Record<'album' | 'camera', string> = { album: 'style-03.jpg', camera: 'style-07.jpg' };

const FUSION_STYLES = [
  { img: 'style-01.jpg', label: '法式奶油碎花', desc: '奶油底色 · 碎花 · 温柔', fabric: 'silk', pattern: 'floral', color: '#F5EFE6', accent: '#C2544E' },
  { img: 'style-02.jpg', label: '复古波点红调', desc: '黑底白点 · 明快俏皮', fabric: 'cotton', pattern: 'polka', color: '#2B2B30', accent: '#F5EFE6' },
  { img: 'style-03.jpg', label: '燕麦极简通勤', desc: '燕麦色 · 挺括羊毛', fabric: 'wool', pattern: 'none', color: '#D8CFC2', accent: '#4A4A52' },
  { img: 'style-07.jpg', label: '雾紫针织慵懒', desc: '莫兰迪紫 · 针织肌理', fabric: 'knit', pattern: 'none', color: '#A99BB5', accent: '#5A6650' },
  { img: 'fabric-01.jpg', label: '藏青精纺格纹', desc: '深藏青 · 精纺格纹', fabric: 'wool', pattern: 'plaid', color: '#2A3B5C', accent: '#C9A23F' },
  { img: 'fabric-02.jpg', label: '玫瑰缎面光泽', desc: '玫瑰粉 · 缎面微光', fabric: 'satin', pattern: 'none', color: '#E8A0B0', accent: '#7E2E3A' },
] as const;
type FusionItem = (typeof FUSION_STYLES)[number];

const AI_TOOLS: { key: 'gen' | 'sketch' | 'fusion' | 'fit'; label: string; icon: IconName }[] = [
  { key: 'gen', label: '文生图', icon: 'sparkle' },
  { key: 'sketch', label: '草图优化', icon: 'pen-tool' },
  { key: 'fusion', label: '风格融合', icon: 'layers' },
  { key: 'fit', label: '一人一版', icon: 'user' },
];

const KEYFRAMES = `
@keyframes zmSpin { to { transform: rotate(360deg); } }
@keyframes zmSweep { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
@keyframes zmScan { 0% { top: 3%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 95%; opacity: 0; } }
@keyframes zmFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
`;

/* ---------------- 小组件 ---------------- */

/** 图片兜底（onError 灰底图标） */
function Cover({ src, style, icon = 'dress' }: { src: string; style?: CSSProperties; icon?: IconName }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="img-ph" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <Icon name={icon} size={24} color="var(--text-3)" />
      </div>
    );
  }
  return <img src={src} alt="" draggable={false} onError={() => setErr(true)} style={{ ...style, objectFit: 'cover' }} />;
}

/** 标题栏圆形图标按钮 */
function HeadIcon({ title, disabled, onClick, flip, children }: {
  title: string; disabled?: boolean; onClick: () => void; flip?: boolean; children: ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: disabled ? 'var(--bg-deep)' : '#fff', border: '1px solid var(--line)',
        color: disabled ? 'var(--text-3)' : 'var(--text-2)', opacity: disabled ? 0.55 : 1,
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(90,60,100,.08)',
      }}
    >
      <span style={{ display: 'flex', transform: flip ? 'scaleX(-1)' : undefined }}>{children}</span>
    </button>
  );
}

/** AI 忙碌态：旋转圆环 + 文案 + 扫光进度条 */
function AiBusy({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '44px 10px 56px' }}>
      <div style={{ width: 58, height: 58, margin: '0 auto 18px', borderRadius: '50%', border: '3px solid var(--brand-soft)', borderTopColor: 'var(--brand)', animation: 'zmSpin 1s linear infinite' }} />
      <div style={{ fontSize: 14, fontWeight: 700 }}>{text}</div>
      <div style={{ margin: '16px auto 0', width: '72%', height: 6, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, rgba(232,92,135,0) 20%, rgba(232,92,135,.9) 50%, rgba(232,92,135,0) 80%)', backgroundSize: '200% 100%', animation: 'zmSweep 1.1s linear infinite' }} />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>约 2 秒 · AI 正在为你工作</div>
    </div>
  );
}

/* =========================================================
 * AI 文生图（5 款候选）
 * ========================================================= */
function AiGenSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (c: AiCandidate) => void }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState('');
  const [phase, setPhase] = useState<'idle' | 'gen' | 'done'>('idle');
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (phase !== 'gen') return;
    setStage(0);
    const iv = setInterval(() => setStage((s) => Math.min(s + 1, GEN_PHASES.length - 1)), 720);
    const to = setTimeout(() => setPhase('done'), 720 * GEN_PHASES.length + 260);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [phase]);

  const start = () => {
    if (!prompt.trim()) { toast('先写一句灵感描述吧～'); return; }
    setPhase('gen');
  };

  return (
    <Sheet open={open} onClose={onClose} title="AI 文生图" height="88%">
      {phase === 'idle' && (
        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>快捷灵感（点一下填入）</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {GEN_IDEAS.map((s) => (
              <button key={s} onClick={() => setPrompt(s)} style={{ padding: '6px 11px', borderRadius: 99, background: 'var(--bg-deep)', fontSize: 11.5, color: 'var(--text-2)', maxWidth: '100%' }}>{s}</button>
            ))}
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="描述你想要的款式，如：适合约会的法式碎花泡泡袖连衣裙"
            style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 12, border: '1px solid var(--line)', background: '#FBF9FA', fontSize: 13.5, resize: 'none', outline: 'none', lineHeight: 1.6 }}
          />
          <button onClick={start} className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }}>
            <Icon name="sparkle" size={18} />生成 5 款候选
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--text-3)' }}>支持描述品类 / 颜色 / 元素 / 场合，一次生成 5 款可应用方案</div>
        </div>
      )}

      {phase === 'gen' && (
        <div style={{ paddingBottom: 24 }}>
          <div style={{ textAlign: 'center', padding: '18px 0 8px' }}>
            <span className="pop" key={stage} style={{ display: 'inline-flex', animation: 'zmFloat 1.6s ease-in-out infinite' }}>
              <Icon name="sparkle" size={30} color="var(--brand)" />
            </span>
          </div>
          {GEN_PHASES.map((s, i) => {
            const on = i === stage;
            const done = i < stage;
            return (
              <div key={s} className="row" style={{ justifyContent: 'center', gap: 8, marginBottom: 10, opacity: done ? 0.55 : 1 }}>
                {done
                  ? <Icon name="check-circle" size={15} color="var(--success)" />
                  : <Icon name="sparkle" size={15} color={on ? 'var(--brand)' : 'var(--line)'} />}
                <span style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: on ? 'var(--text)' : 'var(--text-3)' }}>{s}</span>
              </div>
            );
          })}
          <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden', margin: '8px 12px 0' }}>
            <div style={{ height: '100%', width: `${((stage + 1) / GEN_PHASES.length) * 100}%`, background: 'var(--brand-grad)', borderRadius: 3, transition: 'width .4s ease' }} />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '0 12px' }}>
            正在按「{prompt.slice(0, 18)}{prompt.length > 18 ? '…' : ''}」创作…
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ paddingBottom: 24 }}>
          <div className="row" style={{ gap: 7, marginBottom: 2 }}>
            <span style={{ width: 3.5, height: 14, borderRadius: 2, background: 'var(--brand-grad)' }} />
            <b style={{ fontSize: 14.5 }}>已生成 5 款候选</b>
          </div>
          {prompt.trim() && <div style={{ fontSize: 11.5, color: 'var(--text-3)', margin: '4px 0 12px' }}>灵感：「{prompt}」</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {AI_CANDIDATES.map((c) => (
              <div key={c.id} style={{ borderRadius: 14, border: '1px solid var(--line)', overflow: 'hidden', background: '#fff', boxShadow: '0 2px 8px rgba(90,60,100,.06)' }}>
                <Cover src={c.preview} style={{ width: '100%', height: 128 }} />
                <div style={{ padding: 9 }}>
                  <div className="ellipsis" style={{ fontSize: 12.5, fontWeight: 700 }}>{c.title}</div>
                  <div className="ellipsis" style={{ fontSize: 10.5, color: 'var(--text-3)', margin: '2px 0 8px' }}>{c.tagline}</div>
                  <button onClick={() => onPick(c)} style={{ width: '100%', padding: '7px 0', borderRadius: 99, background: 'var(--brand-grad)', color: '#fff', fontSize: 12, fontWeight: 700, boxShadow: '0 3px 10px rgba(232,92,135,.3)' }}>
                    应用此款
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* =========================================================
 * AI 草图优化（相册 / 拍照 → 识别 → 线稿对比）
 * ========================================================= */
function AiSketchSheet({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: () => void }) {
  const toast = useToast();
  const [phase, setPhase] = useState<'pick' | 'scan' | 'done'>('pick');
  const [srcImg, setSrcImg] = useState(SKETCH_SRC.album);
  const [from, setFrom] = useState('相册导入');

  useEffect(() => {
    if (phase !== 'scan') return;
    const to = setTimeout(() => setPhase('done'), 2000);
    return () => clearTimeout(to);
  }, [phase]);

  const pick = (mode: 'album' | 'camera') => {
    setFrom(mode === 'album' ? '相册导入' : '现场拍照');
    setSrcImg(SKETCH_SRC[mode]);
    toast(mode === 'album' ? '已从相册选择图片' : '已拍摄图片', 'check');
    setPhase('scan');
  };

  return (
    <Sheet open={open} onClose={onClose} title="AI 草图优化">
      {phase === 'pick' && (
        <div style={{ paddingBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.7, marginBottom: 16 }}>上传手绘线稿或成衣照片，AI 将提取轮廓、补全结构线并生成可编辑的「优化线稿」。</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <button onClick={() => pick('album')} className="col" style={{ gap: 10, padding: '22px 10px', borderRadius: 16, border: '1px dashed var(--brand)', background: 'var(--brand-soft)', alignItems: 'center' }}>
              <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.35)' }}>
                <Icon name="image" size={21} />
              </span>
              <b style={{ fontSize: 14 }}>从相册选择</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>导入现有草图照片</span>
            </button>
            <button onClick={() => pick('camera')} className="col" style={{ gap: 10, padding: '22px 10px', borderRadius: 16, border: '1px dashed var(--brand)', background: 'var(--brand-soft)', alignItems: 'center' }}>
              <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 14px rgba(232,92,135,.35)' }}>
                <Icon name="camera" size={21} />
              </span>
              <b style={{ fontSize: 14 }}>拍照识别</b>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>拍摄纸上线稿</span>
            </button>
          </div>
        </div>
      )}

      {phase === 'scan' && (
        <div style={{ paddingBottom: 30 }}>
          <div style={{ position: 'relative', width: '76%', maxWidth: 292, aspectRatio: '4 / 5', margin: '4px auto 0', borderRadius: 18, overflow: 'hidden', background: '#24192B', boxShadow: '0 10px 26px rgba(40,25,50,.25)' }}>
            <img src={`/images/${srcImg}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(1.5px) brightness(.75)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(18,12,24,.28)' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, height: 2.5, background: 'linear-gradient(90deg, transparent, #F27BA0, transparent)', boxShadow: '0 0 16px rgba(232,92,135,.95)', animation: 'zmScan 1.5s ease-in-out infinite' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontSize: 12.5, color: '#fff', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,.5)' }}>AI 识别线稿中…（{from}）</div>
          </div>
        </div>
      )}

      {phase === 'done' && (
        <div style={{ paddingBottom: 26 }}>
          <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 14 }}>
            <Icon name="check-circle" size={16} color="var(--success)" />
            <b style={{ fontSize: 14 }}>优化完成 · 已生成结构线稿</b>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <Cover src={`/images/${srcImg}`} style={{ width: '100%', height: 190 }} />
              <div style={{ padding: '7px 10px', fontSize: 11.5, color: 'var(--text-3)', background: '#FAF8F9' }}>优化前 · {from}</div>
            </div>
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(201,162,63,.6)' }}>
              <Cover src={`/images/${srcImg}`} style={{ width: '100%', height: 190, filter: 'grayscale(1) contrast(2.05) brightness(1.04)' }} icon="pen-tool" />
              <div style={{ padding: '7px 10px', fontSize: 11.5, fontWeight: 700, color: '#8A5A00', background: '#FBF4E2' }}>AI 优化线稿 ✓</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 4, margin: '12px 0', fontSize: 12, color: 'var(--text-3)' }}>
            <Icon name="refresh" size={13} />
            <button onClick={() => setPhase('pick')} style={{ color: 'var(--brand)', fontWeight: 600 }}>换一张图重新识别</button>
          </div>
          <button onClick={onApply} className="btn btn-primary btn-block">
            <Icon name="pen-tool" size={16} />应用优化稿到工作台
          </button>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>将按优化稿载入法式泡泡袖参数，可继续在下方调整</div>
        </div>
      )}
    </Sheet>
  );
}

/* =========================================================
 * AI 风格融合（参考图 → 自动提取色彩/纹理）
 * ========================================================= */
function AiFusionSheet({ open, onClose, onApplyPatch }: { open: boolean; onClose: () => void; onApplyPatch: (p: Partial<DesignParams>) => void }) {
  const toast = useToast();
  const [sel, setSel] = useState<FusionItem | null>(null);
  const [fusing, setFusing] = useState(false);

  useEffect(() => {
    if (!fusing || !sel) return;
    const to = setTimeout(() => {
      const fd = fabricById(sel.fabric);
      onApplyPatch({ fabric: sel.fabric, drape: fd.drape, gloss: fd.gloss, stretch: fd.stretch, color: sel.color, accent: sel.accent, pattern: sel.pattern });
      toast(`已融合「${sel.label}」风格 · 色彩与纹理已更新`, 'check');
      setFusing(false);
      onClose();
    }, 2000);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fusing]);

  return (
    <Sheet open={open} onClose={onClose} title="AI 风格融合" height="86%">
      {!fusing ? (
        <div style={{ paddingBottom: 26 }}>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>选择一张参考图，AI 将提取其中的色彩与纹理应用到当前设计</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
            {FUSION_STYLES.map((f) => {
              const on = sel === f;
              return (
                <button key={f.img} onClick={() => setSel(f)} style={{ flexShrink: 0, width: 96, borderRadius: 12, overflow: 'hidden', border: on ? '2.5px solid var(--brand)' : '2px solid var(--line)', boxShadow: on ? '0 6px 16px rgba(232,92,135,.3)' : 'none', textAlign: 'left', padding: 0, transition: 'all .15s' }}>
                  <Cover src={`/images/${f.img}`} style={{ width: '100%', height: 96 }} />
                  <div style={{ padding: '6px 7px', background: '#fff' }}>
                    <div className="ellipsis" style={{ fontSize: 11.5, fontWeight: 700 }}>{f.label}</div>
                    <div className="ellipsis" style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 1 }}>{f.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 12, background: 'var(--bg)', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.7 }}>
            {sel ? (
              <>将提取：<b style={{ color: sel.color, marginRight: 2 }}>■</b> {sel.color} 主色 · 图案「{patternLabel(sel.pattern)}」 · 面料「{fabricById(sel.fabric).name}」</>
            ) : '请先选择一张参考图'}
          </div>
          <button
            disabled={!sel}
            onClick={() => { setFusing(true); }}
            className="btn btn-primary btn-block"
            style={{ marginTop: 16, opacity: sel ? 1 : 0.5 }}
          >
            <Icon name="layers" size={16} />开始融合
          </button>
        </div>
      ) : (
        <div style={{ paddingBottom: 20 }}>
          <AiBusy text="提取色彩 / 纹理特征…" />
          {sel && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)' }}>正在融合「{sel.label}」风格</div>}
        </div>
      )}
    </Sheet>
  );
}

/* =========================================================
 * AI 一人一版（体型适配）
 * ========================================================= */
function AiFitSheet({ open, onClose, hasBody, adapted, onAdapt, onCancelAdapt }: {
  open: boolean; onClose: () => void; hasBody: boolean; adapted: boolean;
  onAdapt: () => void; onCancelAdapt: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [body] = useBody();
  const [fitting, setFitting] = useState(false);

  useEffect(() => {
    if (!fitting) return;
    const to = setTimeout(() => { setFitting(false); onAdapt(); }, 1500);
    return () => clearTimeout(to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitting]);

  const startFit = () => {
    if (!hasBody) {
      toast('请先完成体型采集');
      onClose();
      navigate('/profile/body');
      return;
    }
    setFitting(true);
  };

  const stats: [string, string][] = [
    ['身高', `${body.height}cm`], ['胸围', `${body.bust}cm`], ['腰围', `${body.waist}cm`], ['臀围', `${body.hip}cm`],
  ];

  return (
    <Sheet open={open} onClose={onClose} title="AI 一人一版">
      {!fitting ? (
        !hasBody ? (
          <div style={{ paddingBottom: 28, textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, margin: '10px auto 18px', borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={38} color="var(--text-3)" />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700 }}>还没有你的体型数据</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '8px 0 22px', lineHeight: 1.7 }}>
              采集身高 / 三围后，AI 会按你的体型微调版型比例，<br />实现真正的「一人一版」定制体验。
            </div>
            <button onClick={startFit} className="btn btn-primary btn-block">
              <Icon name="ruler" size={17} />去采集体型
            </button>
          </div>
        ) : (
          <div style={{ paddingBottom: 26 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 8 }}>我的体型（{body.updatedAt ? '最近更新' : ''}）</div>
            <div style={{ display: 'flex', background: 'var(--bg)', borderRadius: 14, padding: '12px 2px', marginBottom: 10 }}>
              {stats.map(([k, v]) => (
                <div key={k} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{k}</div>
                </div>
              ))}
            </div>
            <div className="row" style={{ gap: 6, marginBottom: 10 }}>
              <span className="tag tag-primary"><Icon name="check-circle" size={11} />推荐码数 {recommendSize(body)}</span>
              <span className="tag tag-gold"><Icon name="sparkle" size={11} />{body.waist <= 70 ? '建议高腰更显腿长' : '常规中腰更舒适'}</span>
            </div>
            <div style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--brand-soft)', fontSize: 12, color: 'var(--brand-deep)', lineHeight: 1.7, marginBottom: 16 }}>
              <Icon name="ruler" size={13} /> 适配后，3D 画布将按你的身高 / 三围微调版型比例与腰线位置，效果实时可见。
            </div>
            <button onClick={startFit} className="btn btn-primary btn-block">
              <Icon name="user" size={16} />{adapted ? '重新适配' : '开始适配'}
            </button>
            {adapted && (
              <button onClick={onCancelAdapt} className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>
                取消适配，恢复通用版型
              </button>
            )}
          </div>
        )
      ) : (
        <div style={{ paddingBottom: 20 }}>
          <AiBusy text="正在按你的体型微调版型…" />
        </div>
      )}
    </Sheet>
  );
}

/* =========================================================
 * 主页面
 * ========================================================= */
export default function StudioPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [body] = useBody();
  const { works, save, update } = useDesignWorks();

  /* ---- 参数 + 撤销/重做历史（单状态原子更新，上限 30） ---- */
  const [hs, setHs] = useState<{ params: DesignParams; undo: DesignParams[]; redo: DesignParams[] }>(() => ({
    params: { ...DEFAULT_PARAMS.dress },
    undo: [], redo: [],
  }));
  const params = hs.params;

  const pushChange = (patch: Partial<DesignParams>) => {
    setHs((s) => ({
      params: { ...s.params, ...patch },
      undo: [...s.undo, s.params].slice(-HISTORY_LIMIT),
      redo: [],
    }));
  };
  const undo = () => setHs((s) => (s.undo.length
    ? { params: s.undo[s.undo.length - 1], undo: s.undo.slice(0, -1), redo: [...s.redo, s.params] }
    : s));
  const redo = () => setHs((s) => (s.redo.length
    ? { params: s.redo[s.redo.length - 1], redo: s.redo.slice(0, -1), undo: [...s.undo, s.params].slice(-HISTORY_LIMIT) }
    : s));

  /** 切换品类：结构参数换为该品类默认，保留用户面料 / 配色选择 */
  const changeCategory = (c: DesignParams['category']) => {
    setHs((s) => {
      const d = DEFAULT_PARAMS[c];
      return {
        params: {
          ...d,
          fabric: s.params.fabric, drape: s.params.drape, gloss: s.params.gloss, stretch: s.params.stretch,
          color: s.params.color, pattern: s.params.pattern, accent: s.params.accent,
        },
        undo: [...s.undo, s.params].slice(-HISTORY_LIMIT),
        redo: [],
      };
    });
  };

  /* ---- UI 状态 ---- */
  const [title, setTitle] = useState('未命名设计');
  const [titleDraft, setTitleDraft] = useState('');
  const [titleOpen, setTitleOpen] = useState(false);
  const [tab, setTab] = useState<PanelTab>('style');
  const [adapted, setAdapted] = useLocalState<boolean>('zm_studio_adapted', false);

  const [genOpen, setGenOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [fusionOpen, setFusionOpen] = useState(false);
  const [fitOpen, setFitOpen] = useState(false);

  const openTitleSheet = () => { setTitleDraft(title); setTitleOpen(true); };
  const confirmTitle = () => {
    const t = titleDraft.trim() || '未命名设计';
    if (t !== title) { setTitle(t); toast('标题已更新', 'check'); }
    setTitleOpen(false);
  };

  /* ---- 保存 / 同步（useDesignWorks） ---- */
  const savedSnap = useRef<{ title: string; params: DesignParams } | null>(null);
  const savedId = useRef<number | null>(null);
  const [syncedFlag, setSyncedFlag] = useState(false);
  const [syncTip, setSyncTip] = useState(false);
  const dirty = !savedSnap.current
    || savedSnap.current.title !== title
    || JSON.stringify(savedSnap.current.params) !== JSON.stringify(params);
  const isSynced = syncedFlag && !dirty;

  const nextId = works.length ? Math.max(...works.map((w) => w.id)) + 1 : 1;

  const doSave = () => {
    const t = title.trim() || '未命名设计';
    if (!dirty && savedId.current != null) { toast('当前设计已是最新，无需重复保存'); return; }
    if (savedId.current == null) {
      save(t, params);
      savedId.current = nextId;
    } else {
      update(savedId.current, { title: t, params });
    }
    savedSnap.current = { title: t, params };
    toast('设计稿已保存到我的作品', 'check');
  };

  const doSync = () => {
    const t = title.trim() || '未命名设计';
    if (isSynced) { toast('该设计已是最新同步，可继续编辑后再次同步'); return; }
    let id = savedId.current;
    if (id == null) {
      save(t, params);
      id = savedId.current = nextId;
    }
    update(id, { title: t, params, status: 'synced', syncedWorkId: 9000 + id });
    savedSnap.current = { title: t, params };
    setSyncedFlag(true);
    setSyncTip(true);
    toast('已同步至官方App个人作品页', 'check');
  };

  useEffect(() => {
    if (!syncTip) return;
    const to = setTimeout(() => setSyncTip(false), 8000);
    return () => clearTimeout(to);
  }, [syncTip]);

  /* ---- AI 应用（都走 undo 栈） ---- */
  const pickCandidate = (c: AiCandidate) => {
    pushChange(applyCandidate(c));
    toast(`已应用「${c.title}」到工作台`, 'check');
    setGenOpen(false);
    setTab('style');
  };
  const applySketchResult = () => {
    pushChange(applyCandidate(AI_CANDIDATES[0]));
    toast('已应用优化稿 · 法式泡泡袖连衣裙参数', 'check');
    setSketchOpen(false);
    setTab('style');
  };
  const applyFusionPatch = (p: Partial<DesignParams>) => pushChange(p);

  const adaptToBody = () => { setAdapted(true); setFitOpen(false); toast('已按你的体型数据微调版型，实现一人一版', 'check'); };
  const cancelAdapt = () => { setAdapted(false); setFitOpen(false); toast('已取消体型适配，恢复通用版型'); };

  const hasBody = hasBodyData(body);

  /* ---- 画布：拖动旋转 + 缩放 ---- */
  const [drag, setDrag] = useState(false);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const onStageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    setDrag(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onStageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setRot({ y: clamp(dx * 0.14, -14, 14), x: clamp(-dy * 0.05, -5, 5) });
  };
  const endDrag = () => { setDrag(false); setRot({ x: 0, y: 0 }); };
  const zoomBy = (d: number) => setZoom((z) => clamp(Math.round((z + d) * 100) / 100, 0.8, 1.6));

  /* ---- 摘要与面料提示 ---- */
  const fab = fabricById(params.fabric);
  const drapeTxt = params.drape >= 0.7 ? '垂坠飘逸' : params.drape >= 0.4 ? '垂坠适中' : '挺括';
  const glossTxt = params.gloss >= 0.6 ? '缎面光泽' : params.gloss >= 0.3 ? '微光泽' : '哑光';
  const bits: string[] = [CATEGORY_LABELS[params.category]];
  if (params.category !== 'skirt' && params.category !== 'pants') {
    bits.push(labelOf('collar', params.collar));
    if (params.sleeve !== 'none') bits.push(labelOf('sleeve', params.sleeve));
  } else if (params.waist !== 'mid') {
    bits.push(labelOf('waist', params.waist));
  }
  bits.push(labelOf('fit', params.fit), `${params.lengthCm}cm`);
  const tagLine = bits.join(' · ');

  const canvasTransform = `perspective(1100px) rotateX(${drag ? rot.x : 0}deg) rotateY(${drag ? rot.y : 0}deg) scale(${zoom})`;

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#F7F4F8', overflow: 'hidden' }}>
      <style>{KEYFRAMES}</style>

      {/* ================= 顶部工具栏 ================= */}
      <header style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2,
        padding: 'calc(env(safe-area-inset-top, 0px) + 6px) 8px 6px',
        background: 'rgba(255,255,255,.93)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(232,224,230,.7)', zIndex: 20,
      }}>
        <button onClick={() => navigate('/design')} aria-label="返回设计首页" title="返回设计首页"
          style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="arrow-left" size={18} />
        </button>

        <button onClick={openTitleSheet} title="点击修改标题" style={{ flex: 1, minWidth: 0, padding: '2px 6px' }}>
          <div className="row" style={{ justifyContent: 'center', gap: 4, maxWidth: '100%' }}>
            <span className="ellipsis" style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</span>
            <Icon name="edit" size={11} color="var(--text-3)" />
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 4, marginTop: 1 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: dirty ? '#E8A23F' : '#34A36F',
              boxShadow: `0 0 0 2px ${dirty ? 'rgba(232,162,63,.2)' : 'rgba(52,163,111,.2)'}`,
            }} />
            <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
              {dirty ? '未保存' : '已保存'}{isSynced ? ' · 已同步官方App' : ''}
            </span>
          </div>
        </button>

        <div className="row" style={{ gap: 4, flexShrink: 0 }}>
          <HeadIcon title="撤销" disabled={!hs.undo.length} onClick={undo}><Icon name="rotate" size={17} /></HeadIcon>
          <HeadIcon title="重做" disabled={!hs.redo.length} onClick={redo} flip><Icon name="rotate" size={17} /></HeadIcon>
          <button onClick={doSave} className="row" title="保存到我的作品"
            style={{ gap: 3, height: 30, padding: '0 12px', borderRadius: 99, background: 'var(--brand-grad)', color: '#fff', fontSize: 12.5, fontWeight: 700, boxShadow: '0 4px 12px rgba(232,92,135,.35)' }}>
            <Icon name="check" size={13} />保存
          </button>
          <button onClick={doSync} className="row" title="同步至官方App"
            style={{
              gap: 3, height: 30, padding: '0 11px', borderRadius: 99, fontSize: 12.5, fontWeight: 700,
              color: isSynced ? '#fff' : 'var(--brand)', background: isSynced ? 'var(--gold)' : 'var(--gold-soft)',
              border: isSynced ? 'none' : '1px solid rgba(201,162,63,.5)',
            }}>
            <Icon name="send" size={12} />{isSynced ? '已同步' : '同步'}
          </button>
        </div>
      </header>

      {/* ================= 3D 画布区 ================= */}
      <section
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
          background: 'linear-gradient(178deg, #F0EBF4 0%, #F7F4F8 48%, #FFFFFF 100%)',
          cursor: drag ? 'grabbing' : 'grab',
        }}
      >
        {/* 顶部氛围光斑 */}
        <div aria-hidden style={{ position: 'absolute', top: -70, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(243,187,203,.5), transparent 65%)', pointerEvents: 'none' }} />
        <div aria-hidden style={{ position: 'absolute', bottom: -30, left: -90, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,92,135,.14), transparent 65%)', pointerEvents: 'none' }} />

        {/* 当前款式 Tag 摘要（可点 → 款式页） */}
        <button onClick={() => setTab('style')} title="点击定位到款式参数"
          style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 99,
            background: 'rgba(255,255,255,.9)', border: '1px solid rgba(232,92,135,.28)',
            boxShadow: '0 4px 14px rgba(90,60,100,.12)', fontSize: 11.5, color: 'var(--text-2)',
            maxWidth: '78%',
          }}>
          <Icon name="dress" size={13} color="var(--brand)" />
          <span className="ellipsis" style={{ fontWeight: 700 }}>{tagLine}</span>
          <Icon name="chevron-right" size={12} color="var(--text-3)" />
        </button>

        {/* 一人一版 · 金标（适配后常驻，可点重开/取消） */}
        {adapted && hasBody && (
          <div onClick={() => setFitOpen(true)}
            style={{
              position: 'absolute', top: 46, left: '50%', transform: 'translateX(-50%)', zIndex: 6,
              display: 'flex', alignItems: 'center', gap: 5, padding: '3px 5px 3px 10px', borderRadius: 99,
              background: 'linear-gradient(135deg, #FBF4E2, #F6E7C2)', border: '1px solid rgba(201,162,63,.55)',
              color: '#8A5A00', fontSize: 10.5, fontWeight: 700, boxShadow: '0 4px 12px rgba(201,162,63,.3)', cursor: 'pointer',
            }}>
            <Icon name="award" size={12} />一人一版 · 体型已适配
            <button onClick={(e) => { e.stopPropagation(); cancelAdapt(); }} aria-label="取消适配" title="取消适配"
              style={{ width: 17, height: 17, borderRadius: '50%', background: 'rgba(201,162,63,.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A5A00' }}>
              <Icon name="close" size={10} />
            </button>
          </div>
        )}

        {/* 中央服装 */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 12px 34px', pointerEvents: 'none' }}>
          <div style={{
            height: '82%', aspectRatio: '360 / 560', pointerEvents: 'auto',
            transform: canvasTransform,
            transition: drag ? 'transform .05s linear' : 'transform .55s cubic-bezier(.22,1,.36,1)',
            filter: 'drop-shadow(0 20px 26px rgba(90,60,110,.18))',
          }}>
            <DressCanvas
              uid="studio"
              params={params}
              body={adapted && hasBody ? { height: body.height, bust: body.bust, waist: body.waist, hip: body.hip } : null}
              showModel={adapted && hasBody}
              showGrid
            />
          </div>
        </div>

        {/* 同步成功提示（官方App作品页入口） */}
        {syncTip && (
          <div className="fade-in" style={{
            position: 'absolute', left: 10, bottom: 52, zIndex: 7,
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,.95)', boxShadow: '0 8px 22px rgba(90,60,100,.16)',
            border: '1px solid rgba(201,162,63,.45)', fontSize: 11.5, color: 'var(--text-2)',
          }}>
            <Icon name="check-circle" size={15} color="#C9A23F" />
            <span>已同步 · 可在官方App「我的作品集」查看</span>
            <button onClick={() => navigate('/profile/works')} style={{ padding: '4px 9px', borderRadius: 99, background: 'var(--gold-soft)', color: '#9A7A1E', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>去看看</button>
          </div>
        )}

        {/* 缩放控件（右下） */}
        <div style={{ position: 'absolute', right: 10, bottom: 54, zIndex: 6, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <button onClick={() => setZoom(1)} title="重置缩放" style={{ height: 20, padding: '0 8px', borderRadius: 99, background: 'rgba(255,255,255,.9)', border: '1px solid var(--line)', fontSize: 10, color: 'var(--text-2)', fontWeight: 700 }}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => zoomBy(0.15)} aria-label="放大" title="放大"
            style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1px solid rgba(232,224,230,.9)', boxShadow: '0 6px 16px rgba(90,60,100,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
            <Icon name="zoom-in" size={19} />
          </button>
          <button onClick={() => zoomBy(-0.15)} aria-label="缩小" title="缩小"
            style={{ width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1px solid rgba(232,224,230,.9)', boxShadow: '0 6px 16px rgba(90,60,100,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
            <Icon name="zoom-out" size={19} />
          </button>
        </div>

        {/* 底部面料质感提示条 */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 12, zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 13px', borderRadius: 99, whiteSpace: 'nowrap',
          background: 'rgba(255,255,255,.92)', border: '1px solid rgba(232,224,230,.9)',
          boxShadow: '0 4px 14px rgba(90,60,100,.12)', fontSize: 11, color: 'var(--text-2)',
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 2.5, background: params.color, border: '1px solid rgba(0,0,0,.14)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)' }} />
          <b style={{ fontSize: 11.5 }}>{fab.name}</b>
          <span style={{ color: 'var(--text-3)' }}>· {drapeTxt} · {glossTxt}</span>
        </div>
      </section>

      {/* ================= 底部参数面板区 ================= */}
      <section style={{
        flexShrink: 0, height: '46vh', minHeight: 252, display: 'flex', flexDirection: 'column',
        background: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22,
        boxShadow: '0 -10px 30px rgba(90,60,100,.12)', overflow: 'hidden', position: 'relative', zIndex: 4,
      }}>
        {/* 拖动指示条 */}
        <div style={{ paddingTop: 7, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--line)' }} />
        </div>

        {/* AI 工具箱（常驻） */}
        <div style={{ display: 'flex', gap: 6, padding: '8px 12px 4px', flexShrink: 0 }}>
          {AI_TOOLS.map((t) => {
            const active = t.key === 'fit' && adapted;
            return (
              <button key={t.key}
                onClick={() => {
                  if (t.key === 'gen') setGenOpen(true);
                  else if (t.key === 'sketch') setSketchOpen(true);
                  else if (t.key === 'fusion') setFusionOpen(true);
                  else setFitOpen(true);
                }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '6px 2px', borderRadius: 12, position: 'relative',
                  background: 'linear-gradient(180deg, #FDF7F9, #FBF1F5)', border: '1px solid rgba(232,92,135,.18)',
                }}>
                <span style={{
                  width: 30, height: 30, borderRadius: 10, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: active ? 'linear-gradient(135deg,#D9B45C,#C9A23F)' : 'var(--brand-grad)',
                  boxShadow: active ? '0 4px 10px rgba(201,162,63,.4)' : '0 4px 10px rgba(232,92,135,.35)',
                }}>
                  <Icon name={t.icon} size={16} />
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>{t.label}</span>
                {/* 状态小点：适配后打勾 / 有体型可适配 */}
                {t.key === 'fit' && (
                  adapted
                    ? <span style={{ position: 'absolute', top: 2, right: 3, color: '#C9A23F' }}><Icon name="check-circle" size={11} /></span>
                    : (hasBody && <span style={{ position: 'absolute', top: 4, right: 5, width: 6, height: 6, borderRadius: '50%', background: 'var(--info)', opacity: 0.85 }} />)
                )}
              </button>
            );
          })}
        </div>

        {/* 款式页顶部的品类快捷 chips */}
        {tab === 'style' && (
          <div style={{ padding: '2px 12px 0', flexShrink: 0 }}>
            <CategoryRow value={params.category} onChange={changeCategory} />
          </div>
        )}

        {/* 参数面板（四 Tab 自带滚动） */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <ParamPanel params={params} onChange={pushChange} tab={tab} onTab={setTab} compact />
        </div>
      </section>

      {/* ================= 各类 Sheet ================= */}
      <Sheet open={titleOpen} onClose={() => setTitleOpen(false)} title="设计稿标题">
        <div style={{ paddingBottom: 26 }}>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value.slice(0, 20))}
            autoFocus
            placeholder="输入作品标题"
            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', fontSize: 15, outline: 'none', background: '#FBF9FA' }}
          />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>20 字以内 · 保存后可在「我的作品」中查看</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{titleDraft.length}/20</span>
          </div>
          <button onClick={confirmTitle} className="btn btn-primary btn-block" style={{ marginTop: 14 }}>确认标题</button>
        </div>
      </Sheet>

      <AiGenSheet open={genOpen} onClose={() => setGenOpen(false)} onPick={pickCandidate} />
      <AiSketchSheet open={sketchOpen} onClose={() => setSketchOpen(false)} onApply={applySketchResult} />
      <AiFusionSheet open={fusionOpen} onClose={() => setFusionOpen(false)} onApplyPatch={applyFusionPatch} />
      <AiFitSheet
        open={fitOpen}
        onClose={() => setFitOpen(false)}
        hasBody={hasBody}
        adapted={adapted}
        onAdapt={adaptToBody}
        onCancelAdapt={cancelAdapt}
      />
    </div>
  );
}
