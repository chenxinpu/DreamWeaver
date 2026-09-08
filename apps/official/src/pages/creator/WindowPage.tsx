/* ============================================================================
 * /creator/window 橱窗材料 —— 表单（选作品→带入品类/素材；真人穿搭图/部件面料/规格尺码表/
 * 原价/基础费用/3D与打版素材）+ 保存草稿 / 提交审核（系统自动审核→approved 生成商品 /
 * rejected 返回缺失）+ 按状态列表
 * 支持 ?workId= 直达：已有材料 → 打开编辑；否则新建并带入该作品。
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Material, SpecSizeChartRow, WindowMaterial, Work } from '../../api/types';
import { PRODUCT_CATEGORIES } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { MaterialBadge } from '../../components/shared/MaterialBadge';
import {
  useAsync, CState, Field, TagInput, Modal, MaterialPickModal,
  WindowBadge, Confirm, Loading, fmtDT, SIZE_OPTIONS, DIM_FIELDS,
} from './_shared';

interface PF { part: string; fabric: string; note: string }
interface Row { size: string; bust: string; waist: string; hip: string; shoulder: string; sleeve: string; length: string }
interface WForm {
  id: number | null;
  workId: number | '';
  productName: string;
  category: string;
  styleTags: string[];
  photos: string[];
  partsFabric: PF[];
  specLabel: string;
  specNote: string;
  rows: Row[];
  price: string;
  baseFee: string;
  patternMatIds: number[];
  modelMatIds: number[];
}

const TABS = ['all', 'draft', 'submitted', 'approved', 'rejected'] as const;
const TAB_TXT: Record<string, string> = { all: '全部', draft: '草稿', submitted: '审核中', approved: '已通过', rejected: '被拒' };
const TMP_IMG = ['/images/style-01.jpg', '/images/style-02.jpg', '/images/style-03.jpg', '/images/style-04.jpg', '/images/style-05.jpg', '/images/dress-01.jpg', '/images/dress-03.jpg', '/images/dress-18.jpg', '/images/blouse-02.jpg'];

export default function WindowPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const workParam = sp.get('workId');

  const { data: winData, loading: wl, error, reload } = useAsync(() => api.window.mine(), []);
  const { data: workData, loading: worksLoading } = useAsync(() => api.works.mine(), []);
  const { data: matsData } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const windows = winData?.list || [];
  const works = workData?.list || [];
  const materials = matsData?.list || [];

  const [tab, setTab] = React.useState<(typeof TABS)[number]>('all');
  const [editor, setEditor] = React.useState<WForm | null>(null);
  const [pick, setPick] = React.useState<'pattern' | 'model' | null>(null);
  const [urlDraft, setUrlDraft] = React.useState('');
  const [saving, setSaving] = React.useState<'draft' | 'submit' | null>(null);
  const [result, setResult] = React.useState<WindowMaterial | null>(null);
  const [approveEditWarn, setApproveEditWarn] = React.useState<WindowMaterial | null>(null);

  const deepLinked = React.useRef(false);

  /* ?workId= 直达 */
  React.useEffect(() => {
    if (!workParam || deepLinked.current || wl || worksLoading) return;
    deepLinked.current = true;
    const n = Number(workParam);
    const existed = windows.find((w) => w.workId === n);
    if (existed) {
      if (existed.status === 'submitted') {
        setTab('submitted');
        toast('该作品的橱窗材料正在审核中，可在下方列表查看');
      } else {
        openEdit(existed);
      }
    } else {
      const work = works.find((w) => w.id === n);
      if (work) setEditor(newForm(work));
      else toast('未找到该作品，请先创建');
    }
    setSp({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workParam, wl, worksLoading, windows, works]);

  const photoMats = materials.filter((m) => ['png', 'jpg'].includes(m.kind));
  const coverMats = materials.filter((m) => !!m.cover && !['png', 'jpg'].includes(m.kind));
  const patternMats = materials.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materials.filter((m) => ['obj', 'glb'].includes(m.kind));

  function newForm(work: Work): WForm {
    return {
      id: null,
      workId: work.id,
      productName: work.title,
      category: work.category,
      styleTags: [...(work.styleTags || [])],
      photos: [...(work.mediaImages || []).slice(0, 4)],
      partsFabric: [],
      specLabel: '标准版型',
      specNote: '',
      rows: [],
      price: '',
      baseFee: '',
      patternMatIds: [...(work.patternMatIds || [])],
      modelMatIds: [...(work.modelMatIds || [])],
    };
  }
  function openEdit(w: WindowMaterial) {
    setEditor({
      id: w.id,
      workId: w.workId,
      productName: w.productName || '',
      category: w.category || '',
      styleTags: [...(w.styleTags || [])],
      photos: [...(w.photos || [])],
      partsFabric: (w.partsFabric || []).map((p) => ({ part: p.part, fabric: p.fabric, note: p.note || '' })),
      specLabel: w.spec?.label || '标准版型',
      specNote: w.spec?.note || '',
      rows: (w.spec?.sizeChart || []).map((r) => rowToStr(r)),
      price: String(w.price ?? ''),
      baseFee: String(w.baseFee ?? ''),
      patternMatIds: [...(w.patternMatIds || [])],
      modelMatIds: [...(w.modelMatIds || [])],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function rowToStr(r: SpecSizeChartRow): Row {
    return { size: r.size, bust: num(r.bust), waist: num(r.waist), hip: num(r.hip), shoulder: num(r.shoulder), sleeve: num(r.sleeve), length: num(r.length) };
  }
  const num = (v?: number | null) => (v == null || Number.isNaN(Number(v)) ? '' : String(v));

  const closeEdit = () => { if (!saving) { setEditor(null); setResult(null); } };

  /** 完整性自检（与后端一致） */
  const completeness = (f: WForm): string[] => {
    const missing: string[] = [];
    if (!(f.photos || []).length) missing.push('真人穿搭实景图 ≥1');
    if (!(f.partsFabric || []).length || f.partsFabric.some((p) => !p.part || !p.fabric)) missing.push('各部件面料需填写完整');
    if ((f.rows || []).length < 2) missing.push('规格尺码表 ≥ 2 档');
    if (!(f.patternMatIds || []).length) missing.push('打版文件 ≥1');
    if (!(f.modelMatIds || []).length) missing.push('3D 文件 ≥1');
    if (!(Number(f.price) > 0)) missing.push('原价 price > 0');
    if (!(Number(f.baseFee) > 0)) missing.push('基础费用 > 0');
    return missing;
  };

  const save = async (action: 'draft' | 'submit') => {
    if (!editor) return;
    if (!editor.workId) { toast('请选择作品'); return; }
    const payload = {
      workId: editor.workId,
      productName: editor.productName,
      category: editor.category,
      styleTags: editor.styleTags,
      photos: editor.photos,
      partsFabric: editor.partsFabric.map((p) => ({ part: p.part, fabric: p.fabric, ...(p.note ? { note: p.note } : {}) })),
      spec: {
        label: editor.specLabel || '标准版型',
        sizeChart: editor.rows.map((r) => rowToNum(r)).filter((r) => r.size),
        ...(editor.specNote ? { note: editor.specNote } : {}),
      },
      price: Number(editor.price) || 0,
      baseFee: Number(editor.baseFee) || 0,
      patternMatIds: editor.patternMatIds,
      modelMatIds: editor.modelMatIds,
      action,
    };
    setSaving(action);
    try {
      const res = editor.id
        ? await api.window.patch(editor.id, payload)
        : await api.window.submit(payload);
      setResult(res);
      if (!editor.id) setEditor((f) => (f ? { ...f, id: res.id } : f));
      reload();
      if (res.offShelf) toast('材料已变更：原商品已自动下架，需重新审核后上架', undefined);
      if (action === 'draft' && !res.audit?.pass) toast('草稿已保存', 'check');
    } catch (e) {
      toast((e as Error).message || '保存失败');
    } finally {
      setSaving(null);
    }
  };
  const rowToNum = (r: Row): SpecSizeChartRow => {
    const o: SpecSizeChartRow = { size: r.size };
    for (const d of DIM_FIELDS) {
      const v = Number((r as unknown as Record<string, string>)[d.key]);
      if (v > 0) (o as unknown as Record<string, number>)[d.key] = v;
    }
    return o;
  };

  const edited = editor;
  const editWork = edited ? works.find((w) => w.id === edited.workId) : undefined;
  const visible = windows.filter((w) => tab === 'all' || w.status === tab);
  const countOf = (s: string) => (s === 'all' ? windows.length : windows.filter((w) => w.status === s).length);

  const addPhotoUrl = () => {
    const v = urlDraft.trim();
    if (!v) return;
    if (edited && !edited.photos.includes(v)) setEditor({ ...edited, photos: [...edited.photos, v] });
    setUrlDraft('');
  };
  const togglePhoto = (p: string) => {
    if (!edited) return;
    setEditor({ ...edited, photos: edited.photos.includes(p) ? edited.photos.filter((x) => x !== p) : [...edited.photos, p] });
  };

  /* 新增按钮：选作品即新建 */
  const startNew = () => setEditor({ ...newForm({ id: 0, creatorId: 0, title: '', category: '连衣裙', styleTags: [], fabric: '', desc: '', cover: '', patternMatIds: [], modelMatIds: [], mediaImages: [], createdAt: '' }), workId: '' });

  return (
    <div>
      {/* 顶部 */}
      <div className="c-card">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <div className="c-card-title" style={{ marginBottom: 6 }}>橱窗材料</div>
            <div className="c-hint">上传真人穿搭图 / 部件面料 / 规格尺码表 / 3D 与打版文件 → 提交后<b>系统自动审核</b>：通过即 AI 生成商品详情上架商城；缺失项会列明便于补齐重提。</div>
          </div>
          {!edited && <button className="c-btn c-btn-primary" onClick={startNew}><Icon name="plus" size={15} />新建橱窗材料</button>}
        </div>
      </div>

      {/* 编辑器 */}
      {edited && (
        <div className="c-card" style={{ marginTop: 12, border: '1.5px solid #E8B9CB' }}>
          <div className="c-card-hd">
            <span className="c-card-title">
              <Icon name="store" size={15} color="var(--brand)" />
              {edited.id ? `编辑橱窗材料 #${edited.id}` : '新建橱窗材料'}
              {edited.id && (windows.find((w) => w.id === edited.id)?.status === 'rejected') && <span className="c-badge c-badge-red">上次被拒·已转草稿</span>}
              {edited.id && (windows.find((w) => w.id === edited.id)?.status === 'approved') && <span className="c-badge c-badge-gold">已通过·改材料需重审</span>}
            </span>
            <button className="c-btn c-btn-outline c-btn-sm" onClick={closeEdit}><Icon name="close" size={13} />关闭</button>
          </div>

          {/* 选择作品 */}
          <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="flex-1" style={{ minWidth: 300 }}>
              <Field label="关联作品" required hint={editWork ? `已带入：${editWork.title} · ${editWork.category}` : '选择后会带入作品品类/标签/打版与 3D 素材'}>
                {worksLoading ? <Loading compact /> : (
                  <select className="c-select" value={String(edited.workId)} disabled={!!edited.id} onChange={(e) => {
                    const w = works.find((x) => x.id === Number(e.target.value));
                    if (w) setEditor({ ...newForm(w), id: edited.id });
                  }}>
                    <option value="">请选择作品…</option>
                    {works.map((w) => <option key={w.id} value={w.id}>{w.title}（{w.category}）</option>)}
                  </select>
                )}
              </Field>
            </div>
            <div className="flex-1" style={{ minWidth: 300 }}>
              <div className="form-grid">
                <Field label="商品名称" required><input className="c-input" value={edited.productName} onChange={(e) => setEditor({ ...edited, productName: e.target.value })} /></Field>
                <Field label="品类" required>
                  <select className="c-select" value={edited.category} onChange={(e) => setEditor({ ...edited, category: e.target.value })}>
                    {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </div>

          {/* 真人穿搭图 */}
          <Field label={`真人模特穿搭实景图（${edited.photos.length}）`} required hint="用于商城详情页展示上身效果；可从图片素材/素材封面选择，或输入 /images/… 快速选择">
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {edited.photos.map((p) => (
                <span key={p} className="row" style={{ gap: 4, background: '#F1F2F5', borderRadius: 99, padding: '3px 8px 3px 3px', fontSize: 11 }}>
                  <img src={imgSafe(p)} alt="" onError={hideBadImg} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                  <span className="ellipsis" style={{ maxWidth: 150 }}>{p.replace('/images/', '')}</span>
                  <button onClick={() => togglePhoto(p)} style={{ color: '#B03A3F' }}><Icon name="close" size={11} /></button>
                </span>
              ))}
            </div>
            {photoSources(photoMats, coverMats, editWork).map((g, gi) => (
              <React.Fragment key={gi}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7180', margin: '6px 0 5px' }}>{g.title}</div>
                <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
                  {g.items.map((it) => (
                    <div key={it.src} className={`pick-cell ${edited.photos.includes(it.src) ? 'on' : ''}`} onClick={() => togglePhoto(it.src)}>
                      <div className="ph">
                        {it.cover ? <img src={imgSafe(it.cover)} alt="" onError={hideBadImg} loading="lazy" />
                          : <Icon name="image" size={18} color="#B7BCC6" />}
                      </div>
                      <span className="ck">{edited.photos.includes(it.src) ? <Icon name="check" size={11} /> : <Icon name="plus" size={11} />}</span>
                      <span className="cap">{it.label}</span>
                    </div>
                  ))}
                </div>
              </React.Fragment>
            ))}
            <div className="row" style={{ gap: 6, marginTop: 8 }}>
              <input className="c-input" style={{ maxWidth: 300 }} value={urlDraft} placeholder="/images/dress-03.jpg" onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(); }} />
              <button className="c-btn c-btn-outline c-btn-sm" onClick={addPhotoUrl}>添加 URL</button>
              {TMP_IMG.slice(0, 6).map((s) => (
                <button key={s} className="c-pill" style={{ cursor: 'pointer' }} onClick={() => togglePhoto(s)}>{s.replace('/images/', '')}</button>
              ))}
            </div>
          </Field>

          {/* 部件面料 + 规格 */}
          <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div className="flex-1" style={{ minWidth: 300 }}>
              <Field label={`各部件面料（${edited.partsFabric.length} 行）`} required hint="例：前片/后片/袖/里布，标注面料与备注">
                {edited.partsFabric.map((p, i) => (
                  <div key={i} className="row" style={{ gap: 6, marginBottom: 6 }}>
                    <input className="c-input" style={{ width: 92 }} placeholder="部件(前片)" value={p.part} onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, part: e.target.value } : x)) })} />
                    <input className="c-input flex-1" placeholder="面料（高支棉…）" value={p.fabric} onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, fabric: e.target.value } : x)) })} />
                    <input className="c-input" style={{ width: 110 }} placeholder="备注(可选)" value={p.note} onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, note: e.target.value } : x)) })} />
                    <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setEditor({ ...edited, partsFabric: edited.partsFabric.filter((_, xi) => xi !== i) })}><Icon name="trash" size={13} /></button>
                  </div>
                ))}
                <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, partsFabric: [...edited.partsFabric, { part: '', fabric: '', note: '' }] })}>
                  <Icon name="plus" size={13} />添加部件
                </button>
              </Field>
            </div>
            <div className="flex-1" style={{ minWidth: 380 }}>
              <Field label={`规格尺码表（${edited.rows.length} 档，需 ≥2）`} required>
                <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                  <input className="c-input" style={{ width: 150 }} placeholder="版型标签（标准版型）" value={edited.specLabel} onChange={(e) => setEditor({ ...edited, specLabel: e.target.value })} />
                  <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, rows: sampleRows() })}>示例尺码表</button>
                  <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, rows: [...edited.rows, { size: 'M', bust: '', waist: '', hip: '', shoulder: '', sleeve: '', length: '' }] })}>
                    <Icon name="plus" size={13} />加一档
                  </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="c-table" style={{ minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th>尺码</th>
                        {DIM_FIELDS.map((d) => <th key={d.key}>{d.label}(cm)</th>)}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {edited.rows.map((r, ri) => (
                        <tr key={ri}>
                          <td>
                            <select className="c-select" style={{ width: 82, padding: '6px 24px 6px 8px' }} value={r.size} onChange={(e) => setEditor({ ...edited, rows: edited.rows.map((x, xi) => (xi === ri ? { ...x, size: e.target.value } : x)) })}>
                              {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </td>
                          {DIM_FIELDS.map((d) => (
                            <td key={d.key}>
                              <input className="c-input" style={{ width: 64, padding: '6px 8px' }} value={(r as unknown as Record<string, string>)[d.key]} onChange={(e) => setEditor({ ...edited, rows: edited.rows.map((x, xi) => (xi === ri ? { ...x, [d.key]: e.target.value } : x)) })} />
                            </td>
                          ))}
                          <td><button className="c-btn c-btn-sm c-btn-danger" onClick={() => setEditor({ ...edited, rows: edited.rows.filter((_, xi) => xi !== ri) })}><Icon name="trash" size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Field>
            </div>
          </div>

          {/* 价格 */}
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr 2fr' }}>
            <Field label="原价 price" required>
              <div className="row" style={{ gap: 6 }}><span style={{ color: '#8B919C' }}>¥</span><input className="c-input" type="number" min={0} value={edited.price} onChange={(e) => setEditor({ ...edited, price: e.target.value })} placeholder="如 328" /></div>
            </Field>
            <Field label="基础费用 baseFee" required hint="定制加工/材料/人工">
              <div className="row" style={{ gap: 6 }}><span style={{ color: '#8B919C' }}>¥</span><input className="c-input" type="number" min={0} value={edited.baseFee} onChange={(e) => setEditor({ ...edited, baseFee: e.target.value })} placeholder="如 68" /></div>
            </Field>
            <Field label="风格标签">
              <TagInput value={edited.styleTags} onChange={(styleTags) => setEditor({ ...edited, styleTags })} suggest={['法式', '碎花', '通勤', '复古', '缎面', '极简']} />
            </Field>
          </div>

          {/* 3D/打版素材 */}
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <div className="flex-1" style={{ minWidth: 240 }}>
              <Field label={`3D 结果文件 ${edited.modelMatIds.length ? `×${edited.modelMatIds.length}` : ''}`} required hint="OBJ/GLB（CLO 导出）">
                <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                  <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />选择 3D 素材</span><Icon name="chevron-right" size={14} color="#C0C4CC" />
                </button>
              </Field>
            </div>
            <div className="flex-1" style={{ minWidth: 240 }}>
              <Field label={`打版结果文件 ${edited.patternMatIds.length ? `×${edited.patternMatIds.length}` : ''}`} required hint="DXF/SVG（工厂排料用）">
                <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                  <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />选择打版素材</span><Icon name="chevron-right" size={14} color="#C0C4CC" />
                </button>
              </Field>
            </div>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            {materials.filter((m) => edited.modelMatIds.includes(m.id) || edited.patternMatIds.includes(m.id)).map((m) => (
              <button key={m.id} className="c-chip" onClick={() => setPick(m.kind === 'obj' || m.kind === 'glb' ? 'model' : 'pattern')}>
                <MaterialBadge kind={m.kind} /><span className="ellipsis" style={{ maxWidth: 150 }}>{m.title || m.fileName}</span>
              </button>
            ))}
          </div>

          {/* 自检 + 保存 */}
          {(() => { const miss = completeness(edited); return miss.length ? (
            <div className="c-notice warn" style={{ marginTop: 10 }}>
              <Icon name="bell" size={15} />
              <span>提交前自检未通过（{miss.length} 项）：{miss.join('；')}。补齐后提交才会通过系统审核。</span>
            </div>
          ) : null; })()}

          <div className="row" style={{ gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button className="c-btn c-btn-outline c-btn-lg flex-1" style={{ flex: '0 1 auto', minWidth: 150 }} disabled={!!saving} onClick={() => save('draft')}>
              <Icon name="edit" size={15} />{saving === 'draft' ? '保存中…' : '保存草稿'}
            </button>
            <button className="c-btn c-btn-primary c-btn-lg flex-1" style={{ flex: '0 1 auto', minWidth: 170 }} disabled={!!saving} onClick={() => save('submit')}>
              <Icon name="shield" size={15} />{saving === 'submit' ? '审核中…' : '提交系统审核'}
            </button>
            <span className="c-hint">提交后系统即时审核：全通过→自动上架商品；缺材料→退回草稿并列明缺失。</span>
          </div>
        </div>
      )}

      {/* 结果弹层 */}
      {result && (
        <Modal onClose={() => setResult(null)} narrow
          title={result.audit?.pass ? '🎉 审核通过，商品已上架' : '⚠️ 审核未通过，请补齐材料'}
          foot={<>
            <button className="c-btn c-btn-outline" onClick={() => { setResult(null); }}>{result.audit?.pass ? '继续' : '知道了'}</button>
            {result.audit?.pass && result.audit.product && (
              <button className="c-btn c-btn-primary" onClick={() => { setResult(null); setEditor(null); navigate('/creator/products'); }}>查看商品管理</button>
            )}
          </>}
        >
          {result.audit?.pass ? (
            <div className="c-notice ok">
              <Icon name="check-circle" size={16} />
              <span>
                <b>「{result.productName}」材料完整，已自动生成 AI 商品详情并上架商城。</b><br />
                {result.audit?.note}<br />
                {result.audit?.product && <>商品 #id{result.audit.product.id} · {result.audit.product.title}</>}
              </span>
            </div>
          ) : (
            <div>
              <div className="c-notice err">
                <Icon name="close" size={15} />
                <span>材料缺失：{result.audit?.missing?.join('；') || '未达标'}</span>
              </div>
              <ul style={{ fontSize: 12, color: '#6B7180', lineHeight: 2.1, paddingLeft: 18, marginTop: 10 }}>
                {result.audit?.missing?.map((m, i) => <li key={i}>补齐「{m}」后点右上重新提交</li>)}
              </ul>
              <button className="c-btn c-btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => setResult(null)}>修改后重新提交</button>
            </div>
          )}
          {result.offShelf && <div className="c-notice warn" style={{ marginTop: 10 }}><Icon name="bell" size={14} />材料变更：原关联商品已自动下架（需重新审核后再上架）。</div>}
        </Modal>
      )}

      {/* 列表 */}
      <div className="c-card" style={{ marginTop: 12 }}>
        <div className="c-card-hd">
          <span className="c-card-title">我的橱窗材料</span>
          <div className="c-tabs">
            {TABS.map((t) => (
              <button key={t} className={`c-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
                {TAB_TXT[t]}<span style={{ opacity: .6, fontSize: 11 }}>{countOf(t)}</span>
              </button>
            ))}
          </div>
        </div>

        {wl && <Loading text="加载橱窗材料…" />}
        {!wl && error && <CState danger icon="store" title="橱窗加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重试</button>} />}
        {!wl && !error && !windows.length && (
          <CState icon="store" title="还没有橱窗材料" desc="资源池里的达标作品会提醒你上橱窗；也可以直接新建（先到作品组织建作品）" />
        )}
        {!wl && !error && visible.length === 0 && windows.length > 0 && (
          <CState icon="filter" title={`「${TAB_TXT[tab]}」暂无材料`} desc="切换其他状态查看" />
        )}

        {visible.map((w) => {
          const log = [...(w.auditLog || [])].reverse();
          const latest = log[0];
          const isEditing = editor?.id === w.id;
          const lastAuditMissing = w.auditMissing || (w.status === 'rejected' ? latest?.note?.replace('缺少：', '').split('；').map((s) => s.trim()) : undefined);
          return (
            <div key={w.id} className="row" style={{ gap: 12, padding: '14px 2px', borderBottom: '1px solid #F0F1F4', alignItems: 'flex-start', flexWrap: 'wrap', background: isEditing ? 'var(--brand-soft)' : undefined, borderRadius: 12, margin: isEditing ? '4px 0' : 0, paddingLeft: isEditing ? 10 : 2 }}>
              <div style={{ flexShrink: 0, position: 'relative' }}>
                {w.work && <img src={imgSafe((w.work as { cover?: string }).cover)} alt="" onError={hideBadImg} style={{ width: 86, height: 110, objectFit: 'cover', borderRadius: 12 }} />}
                {!w.work?.id && <div style={{ width: 86, height: 110, borderRadius: 12, background: '#F1F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B7BCC6' }}><Icon name="tshirt" size={26} /></div>}
                <span style={{ position: 'absolute', left: -5, top: -5 }}><WindowBadge status={w.status} /></span>
              </div>
              <div className="flex-1" style={{ minWidth: 260 }}>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }}>#{w.id} {w.productName}</b>
                  <span className="c-badge c-badge-gray">{w.category}</span>
                </div>
                <div className="c-hint" style={{ fontSize: 11.5, marginTop: 4, lineHeight: 1.8 }}>
                  价格 ¥{Number(w.price).toLocaleString()} · 基础费 ¥{Number(w.baseFee).toLocaleString()} · 图 {w.photos?.length || 0} · 面料 {w.partsFabric?.length || 0} · 尺码 {w.spec?.sizeChart?.length || 0} 档
                  {w.work?.id ? ` · 作品「${(w.work as { title?: string }).title || ''}」` : ''}
                </div>
                {(w.styleTags || []).length > 0 && (
                  <div className="c-chips" style={{ marginTop: 5 }}>
                    {(w.styleTags || []).slice(0, 5).map((t) => <span key={t} className="c-pill">#{t}</span>)}
                  </div>
                )}
                {latest && (
                  <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 11.5, color: '#6B7180', alignItems: 'flex-start' }}>
                    <Icon name={latest.passed ? 'check-circle' : 'close'} size={13} color={latest.passed ? 'var(--success)' : 'var(--danger)'} />
                    <span style={{ lineHeight: 1.6 }}>{latest.passed ? '通过' : '驳回'}：{latest.note}（{fmtDT(latest.at)}）</span>
                  </div>
                )}
                {lastAuditMissing && w.status === 'rejected' && (
                  <div className="c-notice err" style={{ marginTop: 6, fontSize: 11.5 }}>
                    <Icon name="bell" size={13} />
                    <span>缺失：{(Array.isArray(lastAuditMissing) ? lastAuditMissing : []).join('、')}</span>
                  </div>
                )}
                {w.product && (
                  <div className="row" style={{ gap: 6, marginTop: 6, fontSize: 11.5, color: '#237A54', background: 'var(--success-soft)', borderRadius: 8, padding: '5px 9px', width: 'fit-content' }}>
                    <Icon name="bag" size={13} />商品 #{w.product.id}「{w.product.title}」<ProductTiny status={w.product.status} />
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#A8AEB8', marginTop: 4 }}>更新 {fmtDT(w.updatedAt || w.createdAt)}</div>
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {w.status === 'submitted' && <span className="c-pill"><Icon name="clock" size={11} />系统审核中</span>}
                {w.status === 'approved' && w.product?.id && (
                  <button className="c-btn c-btn-soft c-btn-sm" onClick={() => navigate('/creator/products')}><Icon name="bag" size={12} />查看商品</button>
                )}
                {(w.status === 'draft' || w.status === 'rejected') && (
                  <button className="c-btn c-btn-outline c-btn-sm" onClick={() => openEdit(w)}><Icon name="edit" size={12} />{w.status === 'rejected' ? '补齐重提' : '继续编辑'}</button>
                )}
                {w.status === 'approved' && (
                  <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setApproveEditWarn(w)}><Icon name="edit" size={12} />修改材料（将重新审核）</button>
                )}
                {w.status === 'draft' && (
                  <button className="c-btn c-btn-primary c-btn-sm" onClick={() => openEdit(w)}><Icon name="shield" size={12} />提交审核</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 素材选择弹层 */}
      {pick === 'pattern' && edited && <MaterialPickModal title="选择打版素材（DXF/SVG，至少 1 个）" mats={patternMats} value={edited.patternMatIds} onChange={(ids) => setEditor({ ...edited, patternMatIds: ids })} onClose={() => setPick(null)} />}
      {pick === 'model' && edited && <MaterialPickModal title="选择 3D 素材（OBJ/GLB，至少 1 个）" mats={modelMats} value={edited.modelMatIds} onChange={(ids) => setEditor({ ...edited, modelMatIds: ids })} onClose={() => setPick(null)} />}

      {/* 已通过材料变更确认 */}
      <Confirm open={!!approveEditWarn} title="修改已通过的材料？" danger
        body={approveEditWarn ? <>「{approveEditWarn.productName}」已审核上架。修改<b>任何材料字段</b>都会：① 状态转回草稿 ② <b>原商品自动下架</b> ③ 需重新提交审核通过后再上架。仅修改非材料文案请走「商品管理 → 编辑详情」。</> : null}
        okText="继续修改材料" onOk={() => { if (approveEditWarn) openEdit(approveEditWarn); setApproveEditWarn(null); }} onClose={() => setApproveEditWarn(null)} />
    </div>
  );

  function photoSources(photos: Material[], covers: Material[], w: Work | undefined): { title: string; items: { src: string; cover?: string; label: string }[] }[] {
    const out: { title: string; items: { src: string; cover?: string; label: string }[] }[] = [];
    const workImgs = (w?.mediaImages || []).slice(0, 5);
    if (workImgs.length) out.push({ title: '该作品自带图', items: workImgs.map((s) => ({ src: s, label: s.replace('/images/', '') })) });
    if (photos.length) out.push({ title: '图片素材（我的素材库）', items: photos.map((m) => ({ src: m.cover || '', cover: m.cover, label: m.title || m.fileName })) });
    if (covers.length) out.push({ title: '其他素材封面', items: covers.slice(0, 9).map((m) => ({ src: m.cover || '', cover: m.cover, label: m.title || m.fileName })) });
    return out.filter((x) => x.items.length);
  }
}

function sampleRows(): Row[] {
  const tpl: [string, number[]][] = [['S', [84, 66, 90, 38, 56, 100]], ['M', [88, 70, 94, 39, 58, 102]], ['L', [94, 76, 100, 41, 60, 104]]];
  return tpl.map(([size, v]) => {
    const o: Row = { size, bust: '', waist: '', hip: '', shoulder: '', sleeve: '', length: '' };
    const keys = ['bust', 'waist', 'hip', 'shoulder', 'sleeve', 'length'];
    keys.forEach((k, i) => { (o as unknown as Record<string, string>)[k] = String(v[i]); });
    return o;
  });
}

function ProductTiny({ status }: { status?: string }) {
  return status === 'onSale' ? <span className="c-badge c-badge-green">在售</span> : status === 'offShelf' ? <span className="c-badge c-badge-gray">已下架</span> : <span className="c-badge c-badge-gold">草稿</span>;
}
