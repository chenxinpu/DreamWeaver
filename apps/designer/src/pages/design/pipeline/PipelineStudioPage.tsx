/* =========================================================
 * 核心创作链路工作台 PipelineStudioPage（路由 /design/pipeline）
 * 一个「作品/项目」贯穿 4 步：①灵感 → ②2D版片（精确制图）→ ③3D联动（2D⇄3D 双向实时联动）→ ④交付工厂工件稿
 * 入参：?cat=dress|shirt|skirt|coat|pants|suit&id=作品id（无 id 则草稿 / 默认参数新开）
 * 联动引擎：pattern.ts（版片几何/手柄/applyHandle）⇄ DressCanvas（已消费 waistMul/hemMul）
 * ========================================================= */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { IconName } from '../../../components/Icon';
import { Sheet, useToast } from '../../../components/Sheet';
import DressCanvas from '../../../components/design/DressCanvas';
import {
  APPLICABLE, CATEGORY_LABELS, DEFAULT_PARAMS, LENGTH_LABEL, LENGTH_RANGE, OPTIONS,
} from '../../../data/design';
import type { CategoryKey, DesignParams, GroupKey } from '../../../data/design';
import { applyHandle, patternPieces, pieceSheetOf, SHEET_H, SHEET_W } from '../../../data/pattern';
import type { PatternSheet } from '../../../data/pattern';
import { buildTechpack } from '../../../data/techpack';
import { useDesignWorks } from '../../../utils/designStore';
import { DEFAULT_BODY, K, useBody, useLocalState } from '../../../utils/store';
import type { BodyMeasurement } from '../../../data/types';
import { SyncCodeSheet, makeSyncCode } from '../works/parts';
import {
  FABRIC_EST, SHEET_DIM, SHEET_PAPER, SheetSvg, TD, TH,
} from './parts';
import type { SheetNote } from './parts';

/* ================= 常量 / 工具 ================= */
const DRAFT_KEY = 'zm_pipeline_draft';
const STEP_LABELS: { n: 1 | 2 | 3 | 4; label: string; sub: string }[] = [
  { n: 1, label: '灵感', sub: 'AI/画布' },
  { n: 2, label: '2D版片', sub: '精确制图' },
  { n: 3, label: '3D联动', sub: '双向实时' },
  { n: 4, label: '交付', sub: '工厂工件稿' },
];
const GRADES = [
  { v: 'S', k: 0.92 }, { v: 'M', k: 1 }, { v: 'L', k: 1.08 }, { v: 'XL', k: 1.16 },
] as const;
const defTitle = (c: CategoryKey) => `未命名·${CATEGORY_LABELS[c]}`;
const pct = (m: number) => `${m >= 1 ? '+' : ''}${Math.round((m - 1) * 100)}%`;
const pad4 = (n: number) => String(n).padStart(4, '0');
const loadDraft = (): { title?: string; params?: DesignParams } | null => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const hasBodyData = (b: BodyMeasurement) => {
  try {
    return localStorage.getItem(K.body) !== null && JSON.stringify(b) !== JSON.stringify(DEFAULT_BODY);
  } catch { return false; }
};

type HandleParam = 'lengthCm' | 'waistMul' | 'hemMul';
type NoteMap = Record<string, SheetNote[]>;      // pieceId → notes
type NotesAll = Record<string, NoteMap>;          // workKey → NoteMap

/* ================= 小组件 ================= */
function ToolPill({ icon, label, active, danger, onClick }: {
  icon?: IconName; label: string; active?: boolean; danger?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="row"
      style={{
        gap: 5, height: 30, padding: '0 12px', borderRadius: 99, fontSize: 12.3, fontWeight: 700, whiteSpace: 'nowrap',
        color: danger ? '#E5484D' : active ? '#fff' : 'var(--text-2)',
        background: active ? 'var(--brand-grad)' : danger ? 'var(--danger-soft)' : '#fff',
        border: danger && !active ? '1px solid rgba(229,72,77,.35)' : '1px solid var(--line)',
        boxShadow: active ? '0 3px 10px rgba(232,92,135,.3)' : 'none',
        transition: 'all .15s ease',
      }}
    >
      {icon && <Icon name={icon} size={13} />}{label}
    </button>
  );
}

function GradeChip({ label, active, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: 34, height: 28, borderRadius: 9, fontSize: 12, fontWeight: 800,
        color: active ? '#fff' : 'var(--text-2)',
        background: active ? 'var(--brand-grad)' : '#fff',
        border: active ? 'none' : '1px solid var(--line)',
        boxShadow: active ? '0 3px 8px rgba(232,92,135,.3)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function SheetThumb({ sheet, uid, w = 78, active, onClick }: {
  sheet: PatternSheet; uid: string; w?: number; active?: boolean; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: w, flexShrink: 0, borderRadius: 12, overflow: 'hidden', padding: 4, background: '#fff',
        border: active ? '1.6px solid var(--brand)' : '1px solid var(--line)',
        boxShadow: active ? '0 4px 12px rgba(232,92,135,.22)' : '0 1px 2px rgba(40,25,32,.05)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <SheetSvg sheet={sheet} uid={uid} dense />
    </div>
  );
}

/* ================= 主页面 ================= */
export default function PipelineStudioPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const catQ = (sp.get('cat') || 'dress') as CategoryKey;
  const category: CategoryKey = CATEGORY_LABELS[catQ] ? catQ : 'dress';
  const qid = Number(sp.get('id') || '') || 0;

  const { save, update, find } = useDesignWorks();
  const loaded = qid ? find(qid) : undefined;
  const [body] = useBody();
  const hasBody = hasBodyData(body);
  const bodyVal = hasBody
    ? { height: body.height, bust: body.bust, waist: body.waist, hip: body.hip }
    : null;

  /* ----- 状态 ----- */
  const [title, setTitle] = useState<string>(() => loaded?.title ?? loadDraft()?.title ?? defTitle(category));
  const [params, setParams] = useState<DesignParams>(() => {
    if (loaded) {
      const c = CATEGORY_LABELS[loaded.params.category] ? loaded.params.category : category;
      return { ...DEFAULT_PARAMS[c], ...loaded.params };
    }
    const dr = loadDraft();
    if (dr?.params && dr.params.category === category) return { ...DEFAULT_PARAMS[category], ...dr.params };
    return { ...DEFAULT_PARAMS[category] };
  });
  const [savedId, setSavedId] = useState<number | undefined>(loaded?.id);
  const [savedSnap, setSavedSnap] = useState<{ title: string; params: DesignParams } | null>(
    () => (loaded ? { title: loaded.title, params: { ...loaded.params } } : null),
  );
  const [step, setStep] = useState<2 | 3 | 4>(2);
  const [selectedId, setSelectedId] = useState<string>('front');
  const [tool, setTool] = useState<'select' | 'mark'>('select');
  const [seamOn, setSeamOn] = useState(false);
  const [grade, setGrade] = useState<'S' | 'M' | 'L' | 'XL'>('M');
  const [listOpen, setListOpen] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState('');
  const [renameOpen, setRenameOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [syncOpen, setSyncOpen] = useState(false);

  const workKey = savedId != null ? String(savedId) : 'draft';
  const tpKey = savedId != null ? `zm_tp_${savedId}` : 'zm_tp_draft';
  const [tpExported, setTpExported] = useState<boolean>(() => {
    try { return localStorage.getItem(tpKey) === '1'; } catch { return false; }
  });

  /* 标注存储：zm_pipeline_notes_all  → { workKey: { pieceId: notes[] } } */
  const [notesAll, setNotesAll] = useLocalState<NotesAll>('zm_pipeline_notes_all', {});

  /* ----- 派生 ----- */
  const availDefs = useMemo(
    () => patternPieces(params.category).filter((d) => pieceSheetOf(params, d.id) !== null),
    [params],
  );
  const curId = pieceSheetOf(params, selectedId) !== null && availDefs.some((d) => d.id === selectedId)
    ? selectedId
    : (availDefs[0]?.id ?? 'front');
  const sheet = pieceSheetOf(params, curId);
  const curNotes: SheetNote[] = notesAll[workKey]?.[curId] ?? [];
  const gradeK = GRADES.find((g) => g.v === grade)?.k ?? 1;

  /* 草稿自动续画：未保存前，参数/标题变化 600ms 后写入 localStorage */
  useEffect(() => {
    if (savedId != null) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, params })); } catch { /* ignore */ }
    }, 600);
    return () => clearTimeout(t);
  }, [title, params, savedId]);

  /* 打开已存作品时不残留旧的新稿草稿 */
  useEffect(() => {
    if (!qid) return;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !savedSnap
    || savedSnap.title !== title
    || JSON.stringify(savedSnap.params) !== JSON.stringify(params);

  /* ================= 动作 ================= */
  const migrateNotes = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    setNotesAll((prev) => {
      const old = prev[oldKey];
      if (!old) return prev;
      const next = { ...prev, [newKey]: old };
      delete next[oldKey];
      return next;
    });
  };

  const doSave = (quiet = false) => {
    const t = title.trim() || defTitle(params.category);
    if (savedId != null) {
      update(savedId, { title: t, params });
      setSavedSnap({ title: t, params: { ...params } });
      if (!quiet) toast('已保存到「我的作品」', 'check');
    } else {
      const id = save(t, params);
      migrateNotes('draft', String(id));
      setSavedId(id);
      setSavedSnap({ title: t, params: { ...params } });
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
      if (!quiet) toast(`已保存为新作品 DM-${pad4(id)}`, 'check');
    }
    if (title !== t) setTitle(t);
  };

  const exportDeliver = () => {
    if (!tpExported) {
      setTpExported(true);
      try { localStorage.setItem(tpKey, '1'); } catch { /* ignore */ }
    }
    toast('工件稿已导出（含版单+BOM+版片图），可直接对接柔性工厂', 'download');
  };

  const importDone = () => {
    const t = title.trim() || defTitle(params.category);
    let id = savedId;
    if (id == null) {
      id = save(t, params);
      migrateNotes('draft', String(id));
      setSavedId(id);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    }
    update(id, { title: t, params, status: 'synced' });
    setSavedSnap({ title: t, params: { ...params } });
    setSyncOpen(false);
    toast('已确认导入官方App · 状态已更新为已同步', 'check');
  };

  const goStep = (n: 1 | 2 | 3 | 4) => {
    if (n === 1) {
      toast('手稿阶段在「画布」Tab 完成，或直接套用 AI 灵感风格', 'sparkle');
      navigate('/design/studio?ai=1');
      return;
    }
    setStep(n as 2 | 3 | 4);
  };

  /* ----- 标注 ----- */
  const patchCurNotes = (fn: (list: SheetNote[]) => SheetNote[]) => {
    setNotesAll((prev) => {
      const wk = prev[workKey] || {};
      return { ...prev, [workKey]: { ...wk, [curId]: fn(wk[curId] || []) } };
    });
  };
  const placeNote = (x: number, y: number) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    patchCurNotes((list) => {
      let l = list;
      if (editId != null) l = l.filter((n) => n.id !== editId); // 丢弃上一个未确认的空标注
      return [...l, { id, x, y, text: '' }];
    });
    setEditId(id);
    setNoteText('');
    toast('已放置标注点，输入文字后确认', 'note');
  };
  const confirmNote = () => {
    if (editId == null) return;
    patchCurNotes((list) => list.map((n) => (n.id === editId ? { ...n, text: noteText.trim() } : n)));
    setEditId(null);
    toast('标注已保存', 'check');
  };
  const cancelNote = () => {
    if (editId == null) return;
    patchCurNotes((list) => list.filter((n) => n.id !== editId));
    setEditId(null);
    toast('已取消标注', 'close');
  };
  const clearNotes = () => {
    setNotesAll((prev) => {
      const wk = prev[workKey];
      if (!wk || !wk[curId]) return prev;
      const next = { ...wk };
      delete next[curId];
      return { ...prev, [workKey]: next };
    });
    toast('已清除该版片标注', 'check');
  };

  /* ================= 手柄拖拽（像素增量 → 参数增量 → applyHandle 内 clamp） ================= */
  const dragRef = useRef<{ param: HandleParam; lastX: number; lastY: number } | null>(null);

  const onSvgDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (tool === 'mark') {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width) return;
      placeNote((e.clientX - rect.left) * (SHEET_W / rect.width), (e.clientY - rect.top) * (SHEET_H / rect.height));
      return;
    }
    /* 命中手柄：优先 event.target；合成事件(测试/触屏)下回退 elementFromPoint */
    let el = (e.target as Element).closest?.('[data-handle]') as Element | null;
    if (!el) {
      try {
        const at = document.elementFromPoint(e.clientX, e.clientY);
        el = at?.closest?.('[data-handle]') as Element | null;
      } catch { el = null; }
    }
    if (!el) return;
    e.preventDefault();
    const param = el.getAttribute('data-param') as HandleParam;
    dragRef.current = { param, lastX: e.clientX, lastY: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onSvgMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.lastX;
    const dy = e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    let delta = 0;
    if (d.param === 'lengthCm') delta = dy * 0.34;          // 竖向：≈ 45px ≈ 15cm（1 档位）
    else delta = dx * 0.004;                                 // 横向：100px ≈ 0.4 系数
    if (delta === 0) return;
    setParams((p) => ({ ...p, ...applyHandle(p, d.param, delta) }));
  };
  const onSvgUp = () => { dragRef.current = null; };

  /* ================= 交付数据 ================= */
  const styleNo = savedId != null ? `DM-${pad4(savedId)}` : 'DM-草稿';
  const tp = useMemo(
    () => buildTechpack(title.trim() || defTitle(params.category), params, hasBody ? body : null),
    [title, params, body, hasBody],
  );
  const syncCode = useMemo(() => makeSyncCode(title.trim() || defTitle(params.category), params), [title, params]);
  const isSynced = !!loaded && loaded.status === 'synced' && !dirty;

  const quickGroups: { g: GroupKey; label: string }[] = [];
  if (APPLICABLE[params.category].includes('collar')) quickGroups.push({ g: 'collar', label: '领型' });
  if (APPLICABLE[params.category].includes('sleeve')) quickGroups.push({ g: 'sleeve', label: '袖型' });
  if (APPLICABLE[params.category].includes('fit')) quickGroups.push({ g: 'fit', label: '版型' });

  const sheetFill = `${params.color}20`;

  /* =========================================================
   * 渲染
   * ========================================================= */
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ================= 顶部栏 ================= */}
      <header style={{
        flexShrink: 0, padding: 'calc(env(safe-area-inset-top, 0px) + 6px) 10px 6px',
        background: 'rgba(255,255,255,.94)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)', zIndex: 30,
      }}>
        <div className="row" style={{ gap: 4 }}>
          <button
            aria-label="返回"
            onClick={() => navigate(qid ? '/design/works' : '/design')}
            style={{ width: 32, height: 32, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="arrow-left" size={21} />
          </button>

          {/* 标题（可点改名）+ 状态点 */}
          <button
            className="row"
            onClick={() => { setTitleDraft(title); setRenameOpen(true); }}
            style={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 7, padding: '2px 4px' }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: dirty ? '#E0A458' : '#34A36F',
              boxShadow: dirty ? '0 0 0 3px rgba(224,164,88,.22)' : '0 0 0 3px rgba(52,163,111,.18)',
            }} />
            <span className="ellipsis" style={{ fontSize: 15.5, fontWeight: 800, maxWidth: '42vw' }}>{title}</span>
            <Icon name="edit" size={13} color="var(--text-3)" />
          </button>

          <button
            onClick={() => { doSave(); }}
            className="row"
            style={{
              gap: 5, height: 32, padding: '0 13px', borderRadius: 99, fontSize: 12.8, fontWeight: 700, color: '#fff',
              background: 'var(--brand-grad)', boxShadow: '0 3px 10px rgba(232,92,135,.3)', flexShrink: 0,
            }}
          >
            <Icon name="check" size={13} />保存
          </button>
          <button
            onClick={() => setSyncOpen(true)}
            className="row"
            style={{
              gap: 5, height: 32, padding: '0 12px', borderRadius: 99, fontSize: 12.8, fontWeight: 700, color: '#8A5A00',
              background: 'var(--gold-soft)', border: '1px solid rgba(201,162,63,.4)', flexShrink: 0,
            }}
          >
            <Icon name="send" size={12} />同步
          </button>
        </div>

        {/* 流程步条 */}
        <div className="row" style={{ gap: 4, marginTop: 6, padding: '0 2px' }}>
          {STEP_LABELS.map((s) => {
            const done = s.n < step;
            const current = s.n === step;
            return (
              <button
                key={s.n}
                onClick={() => goStep(s.n)}
                className="row"
                style={{
                  flex: 1, gap: 5, justifyContent: 'center', padding: '6px 2px', borderRadius: 11, minWidth: 0,
                  background: current ? 'var(--brand-grad)' : done ? '#E6F5EE' : 'transparent',
                  boxShadow: current ? '0 3px 10px rgba(232,92,135,.28)' : 'none',
                }}
              >
                <span style={{
                  width: 17, height: 17, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 800, color: current ? '#fff' : done ? 'var(--success)' : 'var(--text-3)',
                  background: current ? 'rgba(255,255,255,.24)' : done ? '#fff' : 'var(--bg-deep)',
                }}>
                  {done ? <Icon name="check" size={10} /> : s.n}
                </span>
                <span className="ellipsis" style={{
                  fontSize: 11, fontWeight: 700, color: current ? '#fff' : done ? 'var(--success)' : 'var(--text-2)',
                }}>
                  {s.label}
                </span>
                <span className="ellipsis" style={{
                  fontSize: 8.6, color: current ? 'rgba(255,255,255,.85)' : 'var(--text-3)', display: 'none',
                }}>
                  {s.sub}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ================= 滚动内容 ================= */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 12px 96px' }}>

        {/* ============ ② 2D 版片 ============ */}
        {step === 2 && (
          <section className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 联动提示 */}
            <div className="row" style={{
              gap: 8, padding: '9px 12px', borderRadius: 12, background: 'var(--brand-soft)',
              border: '1px solid rgba(232,92,135,.22)', fontSize: 11.8, color: 'var(--brand-deep)', lineHeight: 1.55,
            }}>
              <Icon name="link" size={15} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>2D版片 ⇄ 3D 同源参数</b>（长度 / 腰围松量 / 摆量）实时联动 —— 拖动手柄或滑杆，两侧同步刷新
              </div>
            </div>

            {/* 版片选择 chips */}
            <div className="row" style={{ gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
              {availDefs.map((d) => {
                const active = d.id === curId;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedId(d.id); setEditId(null); }}
                    className="row"
                    style={{
                      gap: 5, padding: '7px 13px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
                      fontSize: 12.5, fontWeight: 700,
                      color: active ? '#fff' : 'var(--text-2)',
                      background: active ? 'var(--brand-grad)' : '#fff',
                      border: active ? 'none' : '1px solid var(--line)',
                      boxShadow: active ? '0 4px 12px rgba(232,92,135,.3)' : 'none',
                    }}
                  >
                    <Icon name="scissors" size={12} />
                    {d.name}
                    <span style={{ fontSize: 10, opacity: 0.85 }}>×{d.qty}</span>
                  </button>
                );
              })}
            </div>

            {/* 版片画布卡 */}
            <div className="card" style={{ overflow: 'hidden' }}>
              {/* 卡头：片信息 + 迷你 3D 实时联动 */}
              <div className="row" style={{ gap: 10, padding: '10px 12px 0', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800 }}>{sheet?.name}</span>
                    {sheet?.fold && <span className="tag tag-gold">对折</span>}
                    <span className="tag tag-line">×{sheet?.qty ?? 1}片</span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--text-3)', lineHeight: 1.7 }}>
                    纸样单位：cm · 手柄<span style={{ color: SHEET_DIM, fontWeight: 700 }}> ⇄/↕ </span>拖动即改参数 · 尺寸标注随参数实时变
                  </div>
                  <div className="row" style={{ gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                    {sheet?.handles.map((h) => (
                      <span key={h.id} className="tag tag-primary" style={{ fontSize: 9.5 }}>
                        {h.hint}
                      </span>
                    ))}
                  </div>
                </div>
                {/* 迷你 3D（同参数，实时联动佐证） */}
                <div style={{ width: 58, height: 92, flexShrink: 0, borderRadius: 10, background: '#F7F3F6', padding: '4px 3px 2px', overflow: 'hidden', border: '1px solid var(--line)' }}>
                  <DressCanvas params={params} body={bodyVal} uid={`w2d-${curId}`} />
                </div>
              </div>

              {/* 工具行 + 放码 */}
              <div className="row" style={{ gap: 6, padding: '8px 12px 0', flexWrap: 'wrap' }}>
                <ToolPill icon="check" label="选择" active={tool === 'select'} onClick={() => setTool('select')} />
                <ToolPill icon="note" label="标注" active={tool === 'mark'} onClick={() => { setTool('mark'); toast('标注模式：点击版片空白处放置注释', 'note'); }} />
                <ToolPill icon="layers" label="缝份示意" active={seamOn} onClick={() => { setSeamOn(!seamOn); toast(seamOn ? '已关闭缝份示意' : '已显示 1cm 缝份示意', 'layers'); }} />
                <ToolPill icon="trash" label="清除标注" danger onClick={() => { if (curNotes.length) clearNotes(); else toast('当前片暂无标注', 'note'); }} />
                <div style={{ flex: 1 }} />
                <div className="row" style={{ gap: 5 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-3)', marginRight: 2 }}>放码</span>
                  {GRADES.map((g) => (
                    <GradeChip key={g.v} label={g.v} active={grade === g.v} onClick={() => { setGrade(g.v); toast(`放码预览 ${g.v}（尺寸标注 cm 不变）`, 'ruler'); }} />
                  ))}
                </div>
              </div>

              {/* 画布（暖白纸 + 网格） */}
              <div style={{
                margin: 10, borderRadius: 14, overflow: 'hidden',
                border: `1.5px solid ${tool === 'mark' ? 'rgba(232,92,135,.5)' : 'rgba(91,74,63,.18)'}`,
                background: SHEET_PAPER,
              }}>
                {sheet ? (
                  <SheetSvg
                    sheet={sheet}
                    uid={`main-${curId}`}
                    interactive
                    selected={tool === 'select'}
                    grade={gradeK}
                    seam={seamOn}
                    notes={curNotes}
                    fill={sheetFill}
                    onPointerDown={onSvgDown}
                    onPointerMove={onSvgMove}
                    onPointerUp={onSvgUp}
                    onPointerCancel={onSvgUp}
                  />
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                    该片当前无版片几何（可先在 ③3D联动 调整袖型/版型）
                  </div>
                )}
              </div>

              {/* 实时尺寸标注（DOM 文字，随参数/拖拽实时变） */}
              {sheet && sheet.dims.length > 0 && (
                <div className="row" style={{ gap: 5, flexWrap: 'wrap', padding: '8px 12px', borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>尺寸标注 ·</span>
                  {sheet.dims.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '2px 8px', borderRadius: 7, fontSize: 10.3, fontWeight: 800,
                        color: SHEET_DIM, background: 'rgba(194,85,127,.08)', border: '1px solid rgba(194,85,127,.22)',
                      }}
                    >
                      {d.label} {d.cm}cm
                    </span>
                  ))}
                </div>
              )}

              {/* 实时读数（随拖拽变化） */}
              <div className="row" style={{ gap: 0, borderTop: '1px solid var(--line)', background: '#FDFCFA' }}>
                {[
                  { l: '衣长/裙长', v: `${params.lengthCm}cm · ${LENGTH_LABEL(params.category, params.lengthCm)}` },
                  { l: '腰围松量', v: pct(params.waistMul) },
                  { l: '摆量', v: pct(params.hemMul) },
                ].map((c, i) => (
                  <div key={c.l} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--brand-deep)' }}>{c.v}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 1 }}>{c.l}</div>
                  </div>
                ))}
              </div>

              {/* 标注文字编辑行 */}
              {tool === 'mark' && (
                <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--line)', background: '#FDF9EF' }}>
                  {editId != null ? (
                    <div className="row" style={{ gap: 6 }}>
                      <input
                        value={noteText}
                        autoFocus
                        maxLength={24}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="输入版片注释…"
                        style={{
                          flex: 1, minWidth: 0, height: 34, padding: '0 10px', borderRadius: 9, outline: 'none',
                          border: '1px solid rgba(201,162,63,.55)', background: '#fff', fontSize: 12.5,
                        }}
                      />
                      <button onClick={confirmNote} className="btn btn-primary btn-sm" style={{ height: 32 }}>保存</button>
                      <button onClick={cancelNote} className="btn btn-ghost btn-sm" style={{ height: 32 }}>取消</button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#8A5A00', lineHeight: 1.7 }}>
                      <Icon name="note" size={11} /> 标注模式：点击版片空白处放置注释点；再次点击「选择」可拖动手柄
                      {curNotes.length > 0 && <b>（当前片已标注 {curNotes.length} 处）</b>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 版片清单（底部可折叠） */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <button
                onClick={() => setListOpen(!listOpen)}
                className="row"
                style={{ width: '100%', justifyContent: 'space-between', padding: '12px 14px' }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--bg-deep)', color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="layers" size={16} />
                  </span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>版片清单</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                      {availDefs.length} 片组 · {availDefs.reduce((s, d) => s + d.qty, 0)} 片 · 合计用料 {FABRIC_EST[params.category] || '≈1.4m'}
                    </div>
                  </div>
                </div>
                <Icon name={listOpen ? 'chevron-down' : 'chevron-right'} size={17} color="var(--text-3)" />
              </button>
              {listOpen && (
                <div style={{ padding: '0 14px 12px' }}>
                  {availDefs.map((d, i) => {
                    const s = pieceSheetOf(params, d.id);
                    return (
                      <div key={d.id} className="row" style={{ gap: 8, padding: '7px 0', borderTop: '1px solid var(--line)', marginTop: i === 0 ? 2 : 0 }}>
                        <span style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name="scissors" size={13} />
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row" style={{ gap: 6 }}>
                            <b style={{ fontSize: 12.5 }}>{d.name}</b>
                            <span className="tag tag-line" style={{ fontSize: 9.5 }}>×{d.qty}片</span>
                            {d.fold && <span className="tag tag-gold" style={{ fontSize: 9.5 }}>对折</span>}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                            面料·{d.fabric === 'lining' ? '里布' : '主料'}
                            {s && s.dims.length > 0 && <> · 关键尺寸：{s.dims.slice(0, 2).map((m) => `${m.label}${m.cm}`).join(' / ')}</>}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{d.fold ? '沿中线裁' : '按轮廓裁'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ============ ③ 3D 联动 ============ */}
        {step === 3 && (
          <section className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* 3D 预览 */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="row" style={{ justifyContent: 'space-between', padding: '10px 12px 0' }}>
                <div className="row" style={{ gap: 7 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 9, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="dress" size={14} />
                  </span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800 }}>3D 联动预览</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-3)' }}>同源参数渲染 · 已按体型 {hasBody ? '一人一版' : '标准体'}</div>
                  </div>
                </div>
                <span className="tag tag-primary" style={{ fontSize: 10 }}>
                  <Icon name="link" size={10} /> 2D ⇄ 3D
                </span>
              </div>
              <div style={{
                height: 'min(46vh, 440px)', padding: '6px 38px 2px', background: 'linear-gradient(178deg,#F4EEF6,#FBF9FA 62%,#fff)',
              }}>
                <DressCanvas params={params} body={bodyVal} showModel showGrid uid="w3d" />
              </div>
              <div className="row" style={{ gap: 0, borderTop: '1px solid var(--line)', background: '#FDFCFA' }}>
                {[
                  { l: '衣长/裙长', v: `${params.lengthCm}cm` },
                  { l: '腰围松量', v: `${(params.waistMul * 100).toFixed(0)}%` },
                  { l: '摆量', v: `${(params.hemMul * 100).toFixed(0)}%` },
                ].map((c, i) => (
                  <div key={c.l} style={{ flex: 1, textAlign: 'center', padding: '7px 4px', borderRight: i < 2 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--brand-deep)' }}>{c.v}</div>
                    <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 1 }}>{c.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 联动参数滑杆卡 */}
            <div className="card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6, marginBottom: 4 }}>
                <Icon name="ruler" size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>联动参数</b>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>滑杆拖动 → 2D 版片同步变</span>
              </div>

              {[
                {
                  key: 'lengthCm' as const, label: '衣长', range: LENGTH_RANGE[params.category],
                  value: params.lengthCm, fmt: (v: number) => `${v}cm`,
                },
                {
                  key: 'waistMul' as const, label: '腰围松量', range: { min: 0.8, max: 1.4, def: 1 },
                  value: params.waistMul, fmt: (v: number) => pct(v),
                },
                {
                  key: 'hemMul' as const, label: '摆量', range: { min: 0.82, max: 1.75, def: 1 },
                  value: params.hemMul, fmt: (v: number) => pct(v),
                },
              ].map((r) => (
                <div key={r.key} style={{ padding: '7px 0' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 700 }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-deep)' }}>{r.fmt(r.value)}</span>
                  </div>
                  <input
                    type="range"
                    min={r.range.min}
                    max={r.range.max}
                    step={r.key === 'lengthCm' ? 1 : 0.02}
                    value={r.value}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setParams((p) => ({ ...p, [r.key]: v }));
                    }}
                    style={{ width: '100%', accentColor: 'var(--brand)', height: 26, cursor: 'pointer' }}
                  />
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 9, color: 'var(--text-3)', marginTop: -4 }}>
                    <span>{r.range.min}{r.key === 'lengthCm' ? 'cm' : ''}</span>
                    <span>{r.range.max}{r.key === 'lengthCm' ? 'cm' : ''}</span>
                  </div>
                </div>
              ))}

              <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 10, background: 'var(--gold-soft)', fontSize: 10.8, color: '#8A5A00', lineHeight: 1.7 }}>
                <Icon name="link" size={11} /> 反向联动：去 ②2D版片 拖动手柄（⇄腰松/摆量 · ↕长度），同样实时同步到这里
              </div>
            </div>

            {/* 快捷款式 chips */}
            <div className="card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <Icon name="sparkle" size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>快捷款式</b>
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>点击即改参数，2D 版片同步联动</span>
              </div>
              {quickGroups.map((qg) => (
                <div key={qg.g} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 4 }}>{qg.label}</div>
                  <div className="row" style={{ gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
                    {(OPTIONS[qg.g] || []).map((o) => {
                      const active = String(params[qg.g as keyof DesignParams]) === o.v;
                      return (
                        <button
                          key={o.v}
                          onClick={() => {
                            setParams((p) => ({ ...p, [qg.g as 'collar' | 'sleeve' | 'fit']: o.v }));
                          }}
                          style={{
                            padding: '5px 11px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
                            fontSize: 11.5, fontWeight: active ? 800 : 600,
                            color: active ? '#fff' : 'var(--text-2)',
                            background: active ? 'var(--brand-grad)' : '#F6F4F1',
                            border: active ? 'none' : '1px solid var(--line)',
                          }}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* 2D 迷你版片栏 */}
            <div className="card" style={{ padding: '10px 12px 12px' }}>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <Icon name="scissors" size={14} color="var(--brand)" />
                <b style={{ fontSize: 13 }}>2D 版片（同源实时）</b>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>点缩略图去 ② 精确制图</span>
              </div>
              <div className="row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {availDefs.map((d) => {
                  const s = pieceSheetOf(params, d.id);
                  if (!s) return null;
                  return (
                    <div key={d.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <SheetThumb
                        sheet={s}
                        uid={`mini3-${d.id}`}
                        w={70}
                        active={d.id === curId}
                        onClick={() => {
                          setSelectedId(d.id);
                          setStep(2);
                          toast(`已跳转 ②2D版片 · 选中「${d.name}」`, 'check');
                        }}
                      />
                      <span style={{ fontSize: 9.5, color: 'var(--text-2)' }}>{d.name.replace(/（.*）/, '')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI 快捷入口 */}
            <button
              onClick={() => { toast('去 AI 灵感工作台生成新款式（可在结果页另存后回来打开）', 'sparkle'); navigate('/design/studio?ai=1'); }}
              className="row"
              style={{
                gap: 10, padding: '12px 14px', borderRadius: 14, textAlign: 'left',
                background: 'linear-gradient(135deg,#FDF1F5,#FBEDF2)', border: '1px dashed rgba(232,92,135,.45)',
              }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 11, background: 'var(--brand-grad)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="sparkle" size={17} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ fontSize: 13 }}>文生图 · AI 灵感</b>
                <div style={{ fontSize: 10.5, color: 'var(--text-2)', marginTop: 1, lineHeight: 1.6 }}>
                  AI 结果会替换当前参数——在 AI 工作台生成后另存为作品，即可在此打开继续打版
                </div>
              </div>
              <Icon name="chevron-right" size={16} color="var(--text-3)" />
            </button>
          </section>
        )}

        {/* ============ ④ 交付（工厂工件稿） ============ */}
        {step === 4 && (
          <section className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* 工艺单 */}
            <div className="card" style={{ padding: 14, border: '1px solid rgba(201,162,63,.35)', overflow: 'hidden' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--gold-soft)', color: '#9A7A1E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="receipt" size={16} />
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>工艺单 Tech Pack</div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)' }}>可直接对接织梦柔性工厂排产</div>
                  </div>
                </div>
                <button onClick={exportDeliver} className="btn btn-outline btn-sm" style={{ height: 32, fontSize: 12 }}>
                  <Icon name="download" size={13} />{tpExported ? '再次导出' : '导出工件稿'}
                </button>
              </div>

              {/* 款式信息头 */}
              <div className="row" style={{ marginTop: 12, padding: 10, background: 'var(--bg)', borderRadius: 12, gap: 10, alignItems: 'stretch' }}>
                <div style={{ width: 66, height: 104, flexShrink: 0, background: '#fff', borderRadius: 8, padding: '6px 5px 2px', overflow: 'hidden' }}>
                  <DressCanvas params={params} uid="w4-tp" />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div className="ellipsis" style={{ fontSize: 16, fontWeight: 800 }}>{tp.title}</div>
                  <div className="ellipsis" style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3 }}>{tp.categoryLabel} · {tp.styleSummary}</div>
                  <div className="row" style={{ gap: 12, marginTop: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>款号</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-deep)', letterSpacing: .5 }}>{styleNo}</span>
                    {loaded && <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{loaded.updatedAt}</span>}
                  </div>
                </div>
              </div>

              {/* BOM */}
              <div style={{ marginTop: 13 }}>
                <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                  <Icon name="layers" size={14} color="var(--brand)" /><b style={{ fontSize: 12.5 }}>物料清单 BOM</b>
                </div>
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 260 }}>
                    <thead><tr><th style={TH}>物料</th><th style={TH}>规格</th><th style={TH}>用量</th></tr></thead>
                    <tbody>
                      {tp.bom.map((b, i) => (
                        <tr key={`${b.name}-${i}`}>
                          <td style={TD}><b style={{ color: 'var(--text)' }}>{b.name}</b></td>
                          <td style={TD}>{b.spec}</td>
                          <td style={TD}>{b.qty || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 尺寸表 */}
              <div style={{ marginTop: 13 }}>
                <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                  <Icon name="ruler" size={14} color="var(--brand)" /><b style={{ fontSize: 12.5 }}>尺寸表（cm）</b>
                  {hasBody
                    ? <span className="tag tag-success" style={{ fontSize: 9.5 }}>一人一版</span>
                    : <span className="tag tag-gray" style={{ fontSize: 9.5 }}>基础码</span>}
                </div>
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
                    <thead><tr><th style={TH}>码数</th><th style={TH}>胸围</th><th style={TH}>腰围</th><th style={TH}>臀围</th><th style={TH}>备注</th></tr></thead>
                    <tbody>
                      {tp.sizes.map((s) => (
                        <tr key={s.label} style={s.label === 'M' ? { background: '#FDF9EF' } : undefined}>
                          <td style={{ ...TD, fontWeight: 800, color: s.label === 'M' ? '#9A7A1E' : 'var(--text)' }}>{s.label}</td>
                          <td style={TD}>{s.bust}</td>
                          <td style={TD}>{s.waist}</td>
                          <td style={TD}>{s.hip}</td>
                          <td style={{ ...TD, color: '#9A7A1E' }}>{s.remark || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 规格 */}
              <div style={{ marginTop: 13 }}>
                <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                  <Icon name="note" size={14} color="var(--brand)" /><b style={{ fontSize: 12.5 }}>规格说明</b>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {tp.spec.map((s) => (
                    <div key={s.label} className="row" style={{ justifyContent: 'space-between', gap: 6, padding: '6px 9px', background: 'var(--bg)', borderRadius: 8, fontSize: 11 }}>
                      <span style={{ color: 'var(--text-3)' }}>{s.label}</span>
                      <span style={{ fontWeight: 700, textAlign: 'right' }}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 工艺步骤 */}
              <div style={{ marginTop: 13 }}>
                <div className="row" style={{ gap: 6, marginBottom: 5 }}>
                  <Icon name="scissors" size={14} color="var(--brand)" /><b style={{ fontSize: 12.5 }}>工艺步骤</b>
                </div>
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '4px 12px' }}>
                  {tp.process.map((p, i) => (
                    <div key={i} className="row" style={{ gap: 9, padding: '7px 0', borderBottom: i < tp.process.length - 1 ? '1px solid var(--line)' : 'none', fontSize: 11.5, color: 'var(--text-2)' }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 800, flexShrink: 0 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span style={{ lineHeight: 1.55 }}>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '9px 11px', borderRadius: 10, background: 'var(--gold-soft)', fontSize: 11, color: '#8A5A00', lineHeight: 1.75 }}>
                <Icon name="note" size={11} /> {tp.note}
              </div>
            </div>

            {/* 版片清单（工件稿关键） */}
            <div className="card" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 7 }}>
                <span style={{ width: 30, height: 30, borderRadius: 10, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="scissors" size={15} />
                </span>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 800 }}>版片清单（工件稿）</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 1 }}>
                    {availDefs.length} 片组 · {availDefs.reduce((s, d) => s + d.qty, 0)} 片 · 合计用料 {FABRIC_EST[params.category] || '≈1.4m'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
                {availDefs.map((d) => {
                  const s = pieceSheetOf(params, d.id);
                  if (!s) return null;
                  const keys = s.dims.slice(0, 2).map((m) => `${m.label} ${m.cm}cm`).join(' · ');
                  return (
                    <div key={d.id} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                      <div style={{ background: SHEET_PAPER, padding: '5px 4px 0' }}>
                        <SheetSvg sheet={s} uid={`del-${d.id}`} dense />
                      </div>
                      <div style={{ padding: '6px 7px 7px', borderTop: '1px solid var(--line)' }}>
                        <div className="ellipsis" style={{ fontSize: 10.8, fontWeight: 800 }}>{d.name}</div>
                        <div style={{ fontSize: 8.8, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 1 }}>
                          ×{d.qty}片{d.fold ? ' · 对折' : ''}
                          {d.qty > 1 ? `（裁${d.qty}片）` : ''}
                          {keys && <div style={{ color: SHEET_DIM }}>{keys}</div>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 导出 / 同步 */}
            <div style={{ padding: '2px 2px 6px' }}>
              <div style={{ padding: '9px 11px', borderRadius: 10, background: 'var(--gold-soft)', fontSize: 10.8, color: '#8A5A00', lineHeight: 1.75, marginBottom: 10 }}>
                <Icon name="package" size={11} /> 工件稿 = 工艺单 + 版片清单 + 版片图，导出后可直接对接柔性工厂排版裁剪。
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button onClick={exportDeliver} className="btn btn-primary" style={{ flex: 1.2, fontSize: 13 }}>
                  <Icon name="download" size={15} />{tpExported ? '重新导出 PDF（模拟）' : '导出工件稿 PDF（模拟）'}
                </button>
                <button onClick={() => setSyncOpen(true)} className="btn" style={{ flex: 1, fontSize: 13, background: 'var(--gold)', color: '#fff' }}>
                  <Icon name="send" size={14} />同步官方App
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ================= 底部操作栏（fixed 等效：列布局常驻） ================= */}
      <div style={{
        flexShrink: 0, zIndex: 40,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--line)',
        padding: '8px 12px calc(var(--safe-bottom) + 8px)',
      }}>
        <div className="row" style={{ gap: 7 }}>
          {([2, 3, 4] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className="row"
              style={{
                flex: 1, justifyContent: 'center', gap: 4, height: 38, borderRadius: 11,
                fontSize: 12, fontWeight: 800, color: step === s ? '#fff' : 'var(--text-2)',
                background: step === s ? 'var(--brand-grad)' : 'var(--bg-deep)',
                boxShadow: step === s ? '0 3px 10px rgba(232,92,135,.3)' : 'none',
              }}
            >
              {STEP_LABELS[s - 1].n === 2 ? <Icon name="scissors" size={13} />
                : s === 3 ? <Icon name="dress" size={13} /> : <Icon name="package" size={13} />}
              {STEP_LABELS[s - 1].label}
            </button>
          ))}
          <button
            onClick={() => doSave()}
            className="row"
            style={{
              flex: 1.15, justifyContent: 'center', gap: 5, height: 38, borderRadius: 11,
              fontSize: 12.5, fontWeight: 800, color: '#fff', background: 'var(--gold)',
              boxShadow: '0 3px 10px rgba(201,162,63,.35)',
            }}
          >
            <Icon name={dirty ? 'clock' : 'check'} size={13} />{savedId != null ? '保存' : '保存为新作品'}
          </button>
        </div>
      </div>

      {/* ================= 改名 Sheet ================= */}
      <Sheet open={renameOpen} onClose={() => setRenameOpen(false)} title="作品标题">
        <div style={{ paddingBottom: 26 }}>
          <input
            value={titleDraft}
            autoFocus
            maxLength={20}
            onChange={(e) => setTitleDraft(e.target.value)}
            placeholder={`${defTitle(params.category)}`}
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)',
              fontSize: 15, outline: 'none', background: '#FBF9FA',
            }}
          />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>20 字以内 · 默认「未命名·品类」</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{titleDraft.length}/20</span>
          </div>
          <button
            onClick={() => {
              setTitle(titleDraft.trim() || defTitle(params.category));
              setRenameOpen(false);
              toast('标题已更新（记得保存）', 'edit');
            }}
            className="btn btn-primary btn-block"
            style={{ marginTop: 14 }}
          >
            确认标题
          </button>
        </div>
      </Sheet>

      {/* ================= 同步码 ================= */}
      <SyncCodeSheet
        open={syncOpen}
        onClose={() => setSyncOpen(false)}
        code={syncCode}
        designTitle={title.trim() || defTitle(params.category)}
        imported={isSynced}
        onImportDone={importDone}
      />
    </div>
  );
}
