/* ============ 设计画布 · 绘制主界面（/design/canvas/edit） ============
 * 三种模式：
 *  - 绘制：pointer 连续画线（可平滑、可橡皮擦、可撤销/清空）
 *  - 填充：点击服装区域 → 纯色 / 面料 / 图案
 *  - 标注：点击画布添加文字/尺寸标注（引线小字）
 * 保存写 sketchStore，并同步 'zm_designer_canvas_draft' 支持续画。
 */
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../components/Icon';
import NavBar from '../../../components/NavBar';
import { Segmented, Sheet, useToast } from '../../../components/Sheet';
import { COLOR_SWATCHES, FABRICS, PATTERNS } from '../../../data/design';
import { DRAFT_KEY, TEMPLATES, templateById } from '../../../data/sketchTemplates';
import type { SketchAnnot, SketchFill, SketchStroke } from '../../../data/sketchTypes';
import { useSketchWorks } from '../../../utils/sketchStore';
import { Annots, CH, CW, GridDefs, PatternDefs, Strokes, TemplateBody, fabricTintOf } from './parts';

type Mode = 'draw' | 'fill' | 'annot';
type FillTab = 'color' | 'fabric' | 'pattern';
type HistoryAction =
  | { type: 'stroke'; stroke: SketchStroke }
  | { type: 'fill'; regionId: string; prev?: SketchFill }
  | { type: 'annot'; annot: SketchAnnot };

const SWATCH_SIZE = 26; // 色板按钮尺寸
const WIDTHS = [1.5, 3, 5];
const QUICK_ANNOTS = ['肩宽 38cm', '胸围 84cm', '腰围 64cm', '裙长 82cm', '袖长 54cm', '裤长 100cm', '开衩 18cm', '衣长 62cm'];

const MODE_OPTIONS: { value: Mode; label: React.ReactNode }[] = [
  { value: 'draw', label: <span className="row" style={{ gap: 4 }}><Icon name="pen-tool" size={13} />绘制</span> },
  { value: 'fill', label: <span className="row" style={{ gap: 4 }}><Icon name="skirt" size={13} />填充</span> },
  { value: 'annot', label: <span className="row" style={{ gap: 4 }}><Icon name="ruler" size={13} />标注</span> },
];
const FILL_TAB_OPTIONS: { value: FillTab; label: React.ReactNode }[] = [
  { value: 'color', label: '纯色' },
  { value: 'fabric', label: '面料' },
  { value: 'pattern', label: '图案' },
];

interface DraftShape { title: string; templateId: string; strokes: SketchStroke[]; fills: SketchFill[]; annots: SketchAnnot[] }

function parseDraft(): DraftShape | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<DraftShape>;
    if (!d.templateId || !Array.isArray(d.strokes) || !Array.isArray(d.fills) || !Array.isArray(d.annots)) return null;
    return {
      title: typeof d.title === 'string' && d.title ? d.title : '未命名草稿',
      templateId: d.templateId, strokes: d.strokes, fills: d.fills, annots: d.annots,
    };
  } catch { return null; }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => `${r1(n)}`;

/* 点链平滑 → SVG path（二次贝塞尔过中点） */
function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length <= 1) {
    const p = pts[0];
    return `M ${fmt(p.x)} ${fmt(p.y)} l 0.01 0`;
  }
  let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const c = pts[i]; const nx = pts[i + 1];
    d += ` Q ${fmt(c.x)} ${fmt(c.y)} ${fmt((c.x + nx.x) / 2)} ${fmt((c.y + nx.y) / 2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last.x)} ${fmt(last.y)}`;
  return d;
}

function fillValueLabel(kind: SketchFill['kind'], value: string): string {
  if (kind === 'fabric') return FABRICS.find((f) => f.id === value)?.name || value;
  if (kind === 'pattern') return PATTERNS.find((p) => p.v === value)?.label || value;
  return value;
}

function patternDefId(v: string): string {
  if (v === 'dots2') return 'fz-p-heart';
  if (v === 'polka') return 'fz-p-dot';
  if (v === 'plaid') return 'fz-p-plaid';
  if (v === 'floral') return 'fz-p-flower';
  if (v === 'stripe') return 'fz-p-stripe';
  return 'fz-p-geo';
}

const MODE_TEXT: Record<Mode, string> = { draw: '绘制', fill: '填充', annot: '标注' };

export default function CanvasEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const { find, save, update } = useSketchWorks();

  /* ---------- 启动：解析 id / template / 本地草稿 ---------- */
  const [boot] = React.useState(() => {
    const idRaw = searchParams.get('id');
    const idNum = idRaw ? Number(idRaw) : NaN;
    const tParam = searchParams.get('template');
    if (Number.isFinite(idNum) && idNum > 0) {
      const w = find(idNum);
      if (w) {
        return {
          editingId: w.id,
          templateId: w.templateId,
          title: w.title,
          strokes: w.strokes, fills: w.fills, annots: w.annots,
          notice: null as string | null,
        };
      }
      const t = templateById(tParam) || TEMPLATES[0];
      return { editingId: null, templateId: t.id, title: t.name, strokes: [], fills: [], annots: [], notice: '未找到该草稿，已新建空白画布' };
    }
    if (tParam && templateById(tParam)) {
      const t = templateById(tParam)!;
      return { editingId: null, templateId: t.id, title: t.name, strokes: [], fills: [], annots: [], notice: null };
    }
    const d = parseDraft();
    if (d && templateById(d.templateId)) {
      return { editingId: null, templateId: d.templateId, title: d.title, strokes: d.strokes, fills: d.fills, annots: d.annots, notice: '已载入上次未完成的草稿，可继续绘制' };
    }
    const t = TEMPLATES[0];
    return { editingId: null, templateId: t.id, title: t.name, strokes: [], fills: [], annots: [], notice: null };
  });

  const template = templateById(boot.templateId) || TEMPLATES[0];
  const initialSnapshot = React.useRef(JSON.stringify({ title: boot.title, strokes: boot.strokes, fills: boot.fills, annots: boot.annots }));

  const [title, setTitle] = React.useState(boot.title);
  const [strokes, setStrokes] = React.useState<SketchStroke[]>(boot.strokes);
  const [fills, setFills] = React.useState<SketchFill[]>(boot.fills);
  const [annots, setAnnots] = React.useState<SketchAnnot[]>(boot.annots);
  const [editingId, setEditingId] = React.useState<number | null>(boot.editingId);

  const [mode, setMode] = React.useState<Mode>('draw');
  const [color, setColor] = React.useState('#2A3B5C');
  const [width, setWidth] = React.useState(3);
  const [eraser, setEraser] = React.useState(false);
  const [live, setLive] = React.useState<SketchStroke | null>(null);
  const [history, setHistory] = React.useState<HistoryAction[]>([]);
  const [clearArmed, setClearArmed] = React.useState(false);

  const [activeRegion, setActiveRegion] = React.useState<string | null>(null);
  const [fillTarget, setFillTarget] = React.useState<string | null>(null);
  const [fillOpen, setFillOpen] = React.useState(false);
  const [fillTab, setFillTab] = React.useState<FillTab>('color');
  const [pendingFill, setPendingFill] = React.useState<{ kind: SketchFill['kind']; value: string } | null>(null);

  const [annotAt, setAnnotAt] = React.useState<{ x: number; y: number } | null>(null);
  const [annotText, setAnnotText] = React.useState('');
  const [titleOpen, setTitleOpen] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState('');

  /* ---------- 草稿自动保存（跳过首帧，避免覆盖旧草稿） ---------- */
  const mountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, templateId: template.id, strokes, fills, annots }));
    } catch { /* ignore */ }
  }, [title, template.id, strokes, fills, annots]);

  /* 启动提示（仅一次） */
  const noticeShown = React.useRef(false);
  React.useEffect(() => {
    if (noticeShown.current) return;
    noticeShown.current = true;
    if (boot.notice) toast(boot.notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 保存 ---------- */
  const commitSave = (back = false) => {
    const data = { title: (title.trim() || template.name), templateId: template.id, strokes, fills, annots };
    let id = editingId;
    if (id != null) update(id, data);
    else { id = save(data); setEditingId(id); }
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast('草稿已保存', 'check');
    if (back) navigate('/design/canvas');
  };

  const handleBack = () => {
    const cur = JSON.stringify({ title, strokes, fills, annots });
    if (cur === initialSnapshot.current) {
      toast('内容无变化，已返回');
      navigate('/design/canvas');
      return;
    }
    commitSave(true);
  };

  /* ---------- 撤销 ---------- */
  const undo = () => {
    const last = history[history.length - 1];
    if (!last) { toast('没有可撤销的操作'); return; }
    if (last.type === 'stroke') setStrokes((s) => s.filter((x) => x !== last.stroke));
    if (last.type === 'fill') {
      setFills((f) => (last.prev
        ? [...f.filter((x) => x.regionId !== last.regionId), last.prev]
        : f.filter((x) => x.regionId !== last.regionId)));
    }
    if (last.type === 'annot') setAnnots((a) => a.filter((x) => x !== last.annot));
    setHistory((h) => h.slice(0, -1));
    toast('已撤销一步');
  };

  /* ---------- 绘制（pointer 事件） ---------- */
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const drawRef = React.useRef<{ pts: { x: number; y: number }[]; color: string; width: number } | null>(null);
  const activePointer = React.useRef<number | null>(null);
  const longPressRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const toUser = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'draw') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    if (p.x < 0 || p.x > CW || p.y < 0 || p.y > CH) return;
    try { svgRef.current?.setPointerCapture(e.pointerId); } catch { /* noop */ }
    activePointer.current = e.pointerId;
    const w = eraser ? Math.max(8, width * 2) : width;
    const c = eraser ? '#FFFFFF' : color;
    drawRef.current = { pts: [p], color: c, width: w };
    setLive({ color: c, width: w, path: `M ${fmt(p.x)} ${fmt(p.y)} l 0.01 0` });
    if (longPressRef.current) clearTimeout(longPressRef.current);
    longPressRef.current = setTimeout(() => {
      if (drawRef.current && drawRef.current.pts.length === 1 && !e.defaultPrevented) {
        toast('长按模板 = 参考描线：浅色人体是参考线，可沿轮廓直接描画');
      }
    }, 750);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'draw' || !drawRef.current || e.pointerId !== activePointer.current) return;
    e.preventDefault();
    const p = toUser(e.clientX, e.clientY);
    if (p.x < 0 || p.x > CW || p.y < 0 || p.y > CH) return;
    const pts = drawRef.current.pts;
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 0.9) return; // 合并密集点
    pts.push(p);
    if (longPressRef.current) clearTimeout(longPressRef.current);
    let d = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${fmt(pts[i].x)} ${fmt(pts[i].y)}`;
    setLive({ color: drawRef.current.color, width: drawRef.current.width, path: d });
  };

  const finishStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (mode !== 'draw' || e.pointerId !== activePointer.current) return;
    activePointer.current = null;
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
    const d = drawRef.current;
    drawRef.current = null;
    if (!d || !d.pts.length) return;
    const stroke: SketchStroke = { color: d.color, width: d.width, path: buildSmoothPath(d.pts) };
    setStrokes((s) => [...s, stroke]);
    setHistory((h) => [...h, { type: 'stroke', stroke }]);
    setLive(null);
  };

  /* ---------- 填充 ---------- */
  const openFill = (regionId: string) => {
    const region = template.regions.find((r) => r.id === regionId);
    if (!region) return;
    const existing = fills.find((f) => f.regionId === regionId);
    setActiveRegion(regionId);
    setFillTarget(regionId);
    if (existing) {
      setFillTab(existing.kind);
      setPendingFill({ kind: existing.kind, value: existing.value });
    } else {
      setFillTab('color');
      setPendingFill(null);
    }
    setFillOpen(true);
  };

  const applyFill = () => {
    if (!fillTarget || !pendingFill) { toast('请先选择填充内容'); return; }
    const region = template.regions.find((r) => r.id === fillTarget);
    const fill: SketchFill = { regionId: fillTarget, kind: pendingFill.kind, value: pendingFill.value };
    const prev = fills.find((f) => f.regionId === fillTarget);
    setFills((f) => [...f.filter((x) => x.regionId !== fillTarget), fill]);
    setHistory((h) => [...h, { type: 'fill', regionId: fillTarget, prev }]);
    toast(`已填充「${region?.name || fillTarget}」：${fillValueLabel(fill.kind, fill.value)}`, 'check');
    setFillOpen(false);
    setPendingFill(null);
  };

  const clearRegionFill = () => {
    if (!fillTarget) return;
    const prev = fills.find((f) => f.regionId === fillTarget);
    if (!prev) return;
    setFills((f) => f.filter((x) => x.regionId !== fillTarget));
    setHistory((h) => [...h, { type: 'fill', regionId: fillTarget, prev }]);
    toast('已清除该区域填充');
  };

  const targetRegion = fillTarget ? template.regions.find((r) => r.id === fillTarget) : null;
  const targetFill = fillTarget ? fills.find((f) => f.regionId === fillTarget) : null;

  /* ---------- 标注 ---------- */
  const addAnnot = () => {
    const text = annotText.trim();
    if (!annotAt || !text) { toast('请输入标注内容'); return; }
    const annot: SketchAnnot = { x: annotAt.x, y: annotAt.y, text };
    setAnnots((a) => [...a, annot]);
    setHistory((h) => [...h, { type: 'annot', annot }]);
    setAnnotAt(null);
    setAnnotText('');
    toast('标注已添加', 'check');
  };

  /* ---------- 模式切换 ---------- */
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setActiveRegion(null);
    if (m === 'draw') toast('绘制模式：在画布上自由描线，可擦除/撤销');
    if (m === 'fill') toast('填充模式：点击服装区域 → 纯色 / 面料 / 图案');
    if (m === 'annot') toast('标注模式：点击画布添加尺寸文字');
  };

  const canvasDockH = 118;

  return (
    <div
      className="page no-tab"
      style={{ height: '100dvh', minHeight: '100dvh', overflow: 'hidden', paddingBottom: 0, display: 'flex', flexDirection: 'column' }}
    >
      <NavBar
        back
        onBack={handleBack}
        title={
          <button
            onClick={() => { setTitleDraft(title); setTitleOpen(true); }}
            className="row"
            style={{ maxWidth: '100%', margin: '0 auto', gap: 4, display: 'flex', justifyContent: 'center' }}
          >
            <span className="ellipsis" style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</span>
            <Icon name="edit" size={13} color="var(--text-3)" />
          </button>
        }
        right={
          <button className="btn btn-primary btn-sm" onClick={() => commitSave(false)} style={{ height: 30, padding: '0 13px', fontSize: 13, borderRadius: 99 }}>
            保存
          </button>
        }
      />

      {/* 绘制工具条 */}
      {mode === 'draw' && (
        <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 12px 8px' }}>
          {/* 颜色板 */}
          <div className="row" style={{ gap: 6 }}>
            <span className="text-3" style={{ fontSize: 11, width: 30, flexShrink: 0 }}>画笔</span>
            <div className="row" style={{ gap: 6, overflowX: 'auto', flex: 1, paddingBottom: 2 }}>
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => { setColor(c); setEraser(false); }}
                  style={{
                    width: SWATCH_SIZE - 4, height: SWATCH_SIZE - 4, borderRadius: '50%', flexShrink: 0, background: c,
                    border: color === c && !eraser ? '2.5px solid var(--brand)' : '1.5px solid rgba(0,0,0,.1)',
                    boxShadow: color === c && !eraser ? '0 0 0 2px #fff, 0 0 0 4px var(--brand)' : 'none',
                  }}
                />
              ))}
              <label
                style={{
                  width: SWATCH_SIZE - 4, height: SWATCH_SIZE - 4, borderRadius: '50%', flexShrink: 0, background: '#fff',
                  border: '1.5px dashed var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="自定义颜色"
              >
                <Icon name="plus" size={12} color="var(--text-3)" />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => { setColor(e.target.value); setEraser(false); }}
                  style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
                />
              </label>
            </div>
          </div>
          {/* 工具行 */}
          <div className="row" style={{ gap: 10, marginTop: 8 }}>
            <span className="text-3" style={{ fontSize: 11 }}>粗细</span>
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                style={{
                  height: 26, minWidth: 34, borderRadius: 99, padding: '0 9px', fontSize: 12,
                  fontWeight: width === w && !eraser ? 700 : 500,
                  background: width === w && !eraser ? 'var(--brand-grad)' : 'var(--bg-deep)',
                  color: width === w && !eraser ? '#fff' : 'var(--text-2)',
                }}
              >
                {w}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                setEraser((v) => !v);
                if (!eraser) toast('橡皮擦：以白色粗线覆盖，可擦掉已上色的区域');
              }}
              className="row"
              style={{
                gap: 4, height: 28, padding: '0 11px', borderRadius: 99, fontSize: 12,
                background: eraser ? 'var(--danger-soft)' : 'var(--bg-deep)',
                color: eraser ? 'var(--danger)' : 'var(--text-2)', fontWeight: eraser ? 700 : 500,
              }}
            >
              <span style={{ width: 11, height: 11, borderRadius: 3, background: '#fff', border: '1px solid var(--text-3)' }} />
              橡皮
            </button>
            <button
              onClick={undo}
              disabled={!history.length}
              className="row"
              style={{ gap: 3, height: 28, padding: '0 9px', borderRadius: 99, fontSize: 12, background: 'var(--bg-deep)', color: 'var(--text-2)', opacity: history.length ? 1 : 0.45 }}
            >
              <Icon name="rotate" size={13} />撤销
            </button>
            <button
              onClick={() => {
                if (!clearArmed) {
                  setClearArmed(true);
                  toast('再次点击确认清空笔触');
                  setTimeout(() => setClearArmed(false), 2400);
                } else {
                  setStrokes([]);
                  setClearArmed(false);
                  toast('已清空笔触', 'check');
                }
              }}
              className="row"
              style={{
                gap: 3, height: 28, padding: '0 9px', borderRadius: 99, fontSize: 12,
                background: clearArmed ? 'var(--danger)' : 'var(--bg-deep)',
                color: clearArmed ? '#fff' : 'var(--danger)', fontWeight: 600,
              }}
            >
              <Icon name="trash" size={13} />{clearArmed ? '确认?' : '清空'}
            </button>
          </div>
        </div>
      )}

      {/* 画布区 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px 14px', paddingBottom: canvasDockH + 18 }}>
        <div
          className="card"
          style={{
            width: 'fit-content', margin: '0 auto', padding: 6, borderRadius: 14,
            boxShadow: '0 10px 30px rgba(60,40,50,.14)',
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`0 0 ${CW} ${CH}`}
            style={{
              display: 'block', height: '55vh', width: 'auto', background: '#fff',
              borderRadius: 9, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
              cursor: mode === 'draw' ? 'crosshair' : 'default',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishStroke}
            onPointerCancel={finishStroke}
            onContextMenu={(e) => e.preventDefault()}
          >
            <GridDefs />
            <PatternDefs />
            <rect x="0" y="0" width={CW} height={CH} fill="#fff" />
            <rect x="0" y="0" width={CW} height={CH} fill="url(#fz-grid)" />
            <rect
              x="0" y="0" width={CW} height={CH} fill="transparent"
              style={{ pointerEvents: mode === 'fill' || mode === 'annot' ? 'all' : 'none', cursor: mode === 'annot' ? 'crosshair' : undefined }}
              onClick={(e) => {
                if (mode === 'fill') { toast('点击服装区域进行填充'); return; }
                if (mode === 'annot') {
                  const svg = svgRef.current;
                  const ctm = svg?.getScreenCTM();
                  if (!ctm) return;
                  const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
                  setAnnotAt({ x: pt.x, y: pt.y });
                  setAnnotText('');
                }
              }}
            />
            <TemplateBody
              template={template}
              fills={fills}
              showLabels
              interactive={mode === 'fill'}
              activeRegionId={activeRegion}
              onRegionClick={openFill}
            />
            <Strokes strokes={strokes} live={live} />
            <Annots
              annots={annots}
              deletable={mode === 'annot'}
              onDelete={(a) => {
                setAnnots((arr) => arr.filter((x) => x !== a));
                toast('已删除标注');
              }}
            />
          </svg>
        </div>
      </div>

      {/* 底部模式工具条 + 信息条 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430, zIndex: 90,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid var(--line)',
        padding: '10px 14px calc(var(--safe-bottom) + 8px)',
      }}>
        <Segmented
          options={MODE_OPTIONS}
          value={mode}
          onChange={switchMode}
          equal
        />
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8, fontSize: 11 }}>
          <span style={{ color: 'var(--text-2)' }}>
            {MODE_TEXT[mode]} · 笔触 {strokes.length} · 填充 {fills.length} · 标注 {annots.length}
          </span>
          <span style={{ color: 'var(--text-3)' }}>长按模板 = 参考描线</span>
        </div>
      </div>

      {/* ---------- 标题编辑 ---------- */}
      <Sheet open={titleOpen} onClose={() => setTitleOpen(false)} title="作品标题">
        <div style={{ padding: '4px 0 14px' }}>
          <input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            maxLength={30}
            placeholder="给这件作品起个名字…"
            autoFocus
            style={{
              width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: '12px 14px',
              outline: 'none', fontSize: 15, background: 'var(--bg)',
            }}
          />
          <div className="text-3" style={{ fontSize: 11.5, margin: '8px 2px 14px' }}>模板：{template.name}</div>
          <button
            className="btn btn-primary btn-block"
            onClick={() => {
              const v = titleDraft.trim();
              if (!v) { toast('标题不能为空'); return; }
              setTitle(v);
              setTitleOpen(false);
              toast('标题已更新', 'check');
            }}
          >
            确定
          </button>
        </div>
      </Sheet>

      {/* ---------- 区域填充 ---------- */}
      <Sheet
        open={fillOpen}
        onClose={() => { setFillOpen(false); setActiveRegion(null); }}
        title={targetRegion ? `填充「${targetRegion.name}」` : '区域填充'}
      >
        <div style={{ paddingBottom: 12 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <Segmented
              size="sm"
              options={FILL_TAB_OPTIONS}
              value={fillTab}
              onChange={(v) => { setFillTab(v); setPendingFill(null); }}
            />
            {targetFill && (
              <span className="tag tag-line">
                当前：{fillValueLabel(targetFill.kind, targetFill.value)}
              </span>
            )}
          </div>

          {fillTab === 'color' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 9 }}>
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setPendingFill({ kind: 'color', value: c })}
                    style={{
                      aspectRatio: '1', borderRadius: 10, background: c,
                      border: pendingFill?.kind === 'color' && pendingFill.value === c ? '3px solid var(--brand)' : '1.5px solid rgba(0,0,0,.08)',
                      boxShadow: pendingFill?.kind === 'color' && pendingFill.value === c ? '0 0 0 2px #fff' : 'none',
                    }}
                  />
                ))}
              </div>
              <div className="row" style={{ gap: 8, marginTop: 12 }}>
                <label className="row" style={{ gap: 8, flex: 1, background: 'var(--bg)', borderRadius: 12, padding: '8px 12px', cursor: 'pointer' }}>
                  <input
                    type="color"
                    value={(pendingFill?.kind === 'color' ? pendingFill.value : '#E85C87')}
                    onChange={(e) => setPendingFill({ kind: 'color', value: e.target.value })}
                    style={{ width: 26, height: 26, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>自定义颜色</span>
                </label>
                <span
                  style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid var(--line)', background: pendingFill?.kind === 'color' ? pendingFill.value : 'transparent' }}
                />
              </div>
            </div>
          )}

          {fillTab === 'fabric' && (
            <div className="col" style={{ gap: 8 }}>
              {FABRICS.map((f) => {
                const on = pendingFill?.kind === 'fabric' && pendingFill.value === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setPendingFill({ kind: 'fabric', value: f.id })}
                    className="row"
                    style={{
                      gap: 10, padding: 8, borderRadius: 12, width: '100%',
                      border: on ? '2px solid var(--brand)' : '1.5px solid var(--line)',
                      background: on ? 'var(--brand-soft)' : '#fff', textAlign: 'left',
                    }}
                  >
                    <span style={{ width: 40, height: 40, borderRadius: 9, background: fabricTintOf(f.id), border: '1px solid rgba(0,0,0,.06)', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="row" style={{ gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{f.name}</span>
                        <span className="tag tag-gray">{f.weight}</span>
                      </span>
                      <span className="text-3" style={{ display: 'block', fontSize: 11.5, marginTop: 2 }}>{f.desc}</span>
                    </span>
                    {on && <Icon name="check-circle" size={18} color="var(--brand)" />}
                  </button>
                );
              })}
            </div>
          )}

          {fillTab === 'pattern' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {PATTERNS.filter((p) => p.v !== 'none').map((p) => {
                  const on = pendingFill?.kind === 'pattern' && pendingFill.value === p.v;
                  return (
                    <button
                      key={p.v}
                      onClick={() => setPendingFill({ kind: 'pattern', value: p.v })}
                      className="col"
                      style={{
                        alignItems: 'center', gap: 6, padding: 10, borderRadius: 12,
                        border: on ? '2px solid var(--brand)' : '1.5px solid var(--line)',
                        background: on ? 'var(--brand-soft)' : '#fff',
                      }}
                    >
                      <svg width="46" height="36" viewBox="0 0 60 46">
                        <PatternDefs />
                        <rect x="1" y="1" width="58" height="44" rx="6" fill="#FAF5EE" />
                        <rect x="1" y="1" width="58" height="44" rx="6" fill={`url(#${patternDefId(p.v)})`} />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? 'var(--brand-deep)' : 'var(--text-2)' }}>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="row" style={{ gap: 10, marginTop: 16 }}>
            {targetFill && (
              <button className="btn btn-ghost" onClick={clearRegionFill} style={{ flex: 1 }}>
                清除填充
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={applyFill}
              style={{ flex: 2.2, opacity: pendingFill ? 1 : 0.5 }}
              disabled={!pendingFill}
            >
              应用到「{targetRegion?.name || ''}」
            </button>
          </div>
        </div>
      </Sheet>

      {/* ---------- 标注输入 ---------- */}
      <Sheet open={!!annotAt} onClose={() => setAnnotAt(null)} title="添加标注" height="62%">
        <div style={{ paddingBottom: 14 }}>
          <div className="text-2" style={{ fontSize: 12.5, marginBottom: 8 }}>尺寸 / 工艺说明（将带引线显示在画布上）</div>
          <textarea
            value={annotText}
            onChange={(e) => setAnnotText(e.target.value)}
            rows={2}
            autoFocus
            placeholder="示例：胸围 84cm / 腰部收省 / 后中隐形拉链"
            style={{
              width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, padding: '10px 12px',
              outline: 'none', fontSize: 14, resize: 'none', background: 'var(--bg)',
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
            {QUICK_ANNOTS.map((q) => (
              <button
                key={q}
                onClick={() => setAnnotText(q)}
                className="tag tag-line"
                style={{ height: 28, fontSize: 12, cursor: 'pointer' }}
              >
                {q}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10, marginTop: 14 }}>
            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAnnotAt(null)}>取消</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={addAnnot}>
              <Icon name="check" size={16} /> 添加标注
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
