/* ============================================================================
 * /c/window 创作者中心 · 橱窗材料（移动版）
 * 状态 tabs（全部/草稿/审核中/已通过/被拒 带数量）；行卡 + 按状态操作；
 * 新建/编辑整页表单：选作品→带入品类/标签/素材；真人穿搭图（图片素材/素材封面/URL 点选）、
 * 各部件面料动态行、规格尺码表（复用 SIZE_OPTIONS/DIM_FIELDS 动态表格）、风格标签；
 * 不含原价/基础费用（定价由平台按品类自动生成）；提交走 submit/patch/submitId；
 * 结果弹窗提示审核通过/缺失清单；?workId= 直达新建/编辑
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { SpecSizeChartRow, WindowMaterial, Work } from '../../api/types';
import { PRODUCT_CATEGORIES } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { MaterialBadge } from '../../components/shared/MaterialBadge';
import {
  useAsync, Modal, Confirm, Field, TagInput, MaterialPickModal,
  WindowBadge, fmtDT, SIZE_OPTIONS, DIM_FIELDS, Loading,
} from './bits';
import { MEmpty, MCardHd, MTabs } from './bits';

const TAB_TXT: Record<string, string> = { all: '全部', draft: '草稿', submitted: '审核中', approved: '已通过', rejected: '被拒' };
const TMP_IMG = ['/images/style-01.jpg', '/images/style-02.jpg', '/images/style-03.jpg', '/images/style-04.jpg', '/images/style-05.jpg', '/images/dress-01.jpg', '/images/dress-03.jpg', '/images/dress-18.jpg', '/images/blouse-02.jpg'];

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
  patternMatIds: number[];
  modelMatIds: number[];
}

export default function MWindowPage() {
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

  const [tab, setTab] = React.useState('all');
  const [editor, setEditor] = React.useState<WForm | null>(null);
  const [pick, setPick] = React.useState<'pattern' | 'model' | null>(null);
  const [urlDraft, setUrlDraft] = React.useState('');
  const [saving, setSaving] = React.useState<'draft' | 'submit' | null>(null);
  const [result, setResult] = React.useState<WindowMaterial | null>(null);
  const [approveEditWarn, setApproveEditWarn] = React.useState<WindowMaterial | null>(null);
  const [delTarget, setDelTarget] = React.useState<WindowMaterial | null>(null);
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
      patternMatIds: [...(work.patternMatIds || [])],
      modelMatIds: [...(work.modelMatIds || [])],
    };
  }
  const num = (v?: number | null) => (v == null || Number.isNaN(Number(v)) ? '' : String(v));
  function rowToStr(r: SpecSizeChartRow): Row {
    return { size: r.size, bust: num(r.bust), waist: num(r.waist), hip: num(r.hip), shoulder: num(r.shoulder), sleeve: num(r.sleeve), length: num(r.length) };
  }
  function openEdit(w: WindowMaterial) {
    setEditor({
      id: w.id,
      workId: w.workId,
      productName: w.productName || '',
      category: w.category || '连衣裙',
      styleTags: [...(w.styleTags || [])],
      photos: [...(w.photos || [])],
      partsFabric: (w.partsFabric || []).map((p) => ({ part: p.part, fabric: p.fabric, note: p.note || '' })),
      specLabel: w.spec?.label || '标准版型',
      specNote: w.spec?.note || '',
      rows: (w.spec?.sizeChart || []).map((r) => rowToStr(r)),
      patternMatIds: [...(w.patternMatIds || [])],
      modelMatIds: [...(w.modelMatIds || [])],
    });
  }
  const closeEdit = () => { if (!saving) { setEditor(null); setResult(null); } };

  /** 完整性自检（与后端一致；原价/基础费用由平台定价，不再要求表单填写） */
  const completeness = (f: WForm): string[] => {
    const missing: string[] = [];
    if (!(f.photos || []).length) missing.push('真人穿搭实景图 ≥1');
    if (!(f.partsFabric || []).length || f.partsFabric.some((p) => !p.part || !p.fabric)) missing.push('各部件面料需填写完整');
    if ((f.rows || []).length < 2) missing.push('规格尺码表 ≥ 2 档');
    if (!(f.patternMatIds || []).length) missing.push('打版文件 ≥1');
    if (!(f.modelMatIds || []).length) missing.push('3D 文件 ≥1');
    return missing;
  };

  const payloadOf = (f: WForm): Record<string, unknown> => ({
    workId: f.workId,
    productName: f.productName,
    category: f.category,
    styleTags: f.styleTags,
    photos: f.photos,
    partsFabric: f.partsFabric.map((p) => ({ part: p.part, fabric: p.fabric, ...(p.note ? { note: p.note } : {}) })),
    spec: {
      label: f.specLabel || '标准版型',
      sizeChart: f.rows.map((r) => rowToNum(r)).filter((r) => r.size),
      ...(f.specNote ? { note: f.specNote } : {}),
    },
    patternMatIds: f.patternMatIds,
    modelMatIds: f.modelMatIds,
  });
  const rowToNum = (r: Row): SpecSizeChartRow => {
    const o: SpecSizeChartRow = { size: r.size };
    for (const d of DIM_FIELDS) {
      const v = Number((r as unknown as Record<string, string>)[d.key]);
      if (v > 0) (o as unknown as Record<string, number>)[d.key] = v;
    }
    return o;
  };

  const save = async (action: 'draft' | 'submit') => {
    if (!editor) return;
    if (!editor.workId) { toast('请选择作品'); return; }
    setSaving(action);
    try {
      const res = editor.id
        ? await api.window.patch(editor.id, { ...payloadOf(editor), action })
        : await api.window.submit({ ...payloadOf(editor), action });
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

  /** 草稿/被拒列表行的“提交审核”快捷操作（按行内现有数据直接补交） */
  const quickSubmit = async (w: WindowMaterial) => {
    setSaving('submit');
    try {
      const res = await api.window.patch(w.id, { ...payloadOf(fromWindow(w)), action: 'submit' });
      setResult(res);
      reload();
    } catch (e) {
      toast((e as Error).message || '提交失败');
    } finally {
      setSaving(null);
    }
  };
  function fromWindow(w: WindowMaterial): WForm {
    return {
      id: w.id, workId: w.workId, productName: w.productName || '', category: w.category || '连衣裙',
      styleTags: [...(w.styleTags || [])], photos: [...(w.photos || [])],
      partsFabric: (w.partsFabric || []).map((p) => ({ part: p.part, fabric: p.fabric, note: p.note || '' })),
      specLabel: w.spec?.label || '标准版型', specNote: w.spec?.note || '',
      rows: (w.spec?.sizeChart || []).map((r) => rowToStr(r)),
      patternMatIds: [...(w.patternMatIds || [])], modelMatIds: [...(w.modelMatIds || [])],
    };
  }

  const edited = editor;
  const editWork = edited ? works.find((w) => w.id === edited.workId) : undefined;
  const visible = windows.filter((w) => tab === 'all' || w.status === tab);
  const countOf = (s: string) => (s === 'all' ? windows.length : windows.filter((w) => w.status === s).length);

  const togglePhoto = (p: string) => {
    if (!edited) return;
    setEditor({ ...edited, photos: edited.photos.includes(p) ? edited.photos.filter((x) => x !== p) : [...edited.photos, p] });
  };
  const addPhotoUrl = () => {
    const v = urlDraft.trim();
    if (!v) return;
    if (edited && !edited.photos.includes(v)) setEditor({ ...edited, photos: [...edited.photos, v] });
    setUrlDraft('');
  };
  const startNew = () => {
    setEditor({
      id: null, workId: '', productName: '', category: '连衣裙', styleTags: [], photos: [],
      partsFabric: [], specLabel: '标准版型', specNote: '', rows: [], patternMatIds: [], modelMatIds: [],
    });
  };

  return (
    <div>
      {/* 顶部说明 + 新建 */}
      <div className="mc-card">
        <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mc-hd" style={{ marginBottom: 4 }}><div className="mc-hd-title">橱窗材料</div></div>
            <div className="mc-sub">上传真人穿搭图 / 部件面料 / 规格尺码表 / 3D 与打版文件 → 提交后<b>系统自动审核</b>：通过即 AI 生成商品详情上架商城；缺失项会列明便于补齐重提。</div>
          </div>
          {!edited && (
            <button className="c-btn c-btn-primary" style={{ height: 38, borderRadius: 12 }} onClick={startNew}>
              <Icon name="plus" size={15} />新建
            </button>
          )}
        </div>
      </div>

      {/* ===== 编辑器（整页卡片） ===== */}
      {edited && (
        <div className="mc-card" style={{ marginTop: 10, border: '1.5px solid #E8B9CB' }}>
          <MCardHd icon="store" title={edited.id ? `编辑橱窗材料 #${edited.id}` : '新建橱窗材料'}
            right={
              <div className="row" style={{ gap: 6 }}>
                {edited.id && (windows.find((w) => w.id === edited.id)?.status === 'rejected') && <span className="c-badge c-badge-red">上次被拒·已转草稿</span>}
                {edited.id && (windows.find((w) => w.id === edited.id)?.status === 'approved') && <span className="c-badge c-badge-gold">已通过·改材料需重审</span>}
                <button className="c-btn c-btn-sm c-btn-outline" onClick={closeEdit}><Icon name="close" size={13} />关闭</button>
              </div>
            } />

          <div className="mc-form">
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

            <div className="row" style={{ gap: 8 }}>
              <Field label="商品名称" required><input className="c-input" value={edited.productName} onChange={(e) => setEditor({ ...edited, productName: e.target.value })} /></Field>
              <Field label="品类" required>
                <select className="c-select" value={edited.category} onChange={(e) => setEditor({ ...edited, category: e.target.value })}>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>

            {/* 真人穿搭图 */}
            <Field label={`真人模特穿搭实景图（${edited.photos.length}）`} required hint="用于商城详情页展示上身效果；可从图片素材 / 素材封面 / URL 点选">
              {edited.photos.length > 0 && (
                <div className="c-chips" style={{ marginBottom: 8 }}>
                  {edited.photos.map((p) => (
                    <span key={p} className="c-chip" style={{ gap: 6, paddingLeft: 3 }}>
                      <img src={imgSafe(p)} alt="" onError={hideBadImg} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                      <span className="ellipsis" style={{ maxWidth: 110 }}>{p.replace('/images/', '')}</span>
                      <button onClick={() => togglePhoto(p)} style={{ color: '#B03A3F' }}><Icon name="close" size={11} /></button>
                    </span>
                  ))}
                </div>
              )}
              {(() => {
                const groups: { title: string; items: { src: string; cover?: string; label: string }[] }[] = [];
                const workImgs = (editWork?.mediaImages || []).slice(0, 6);
                if (workImgs.length) groups.push({ title: '该作品自带图', items: workImgs.map((s) => ({ src: s, label: s.replace('/images/', '') })) });
                if (photoMats.length) groups.push({ title: '图片素材（我的素材库）', items: photoMats.map((m) => ({ src: m.cover || '', cover: m.cover, label: m.title || m.fileName })) });
                if (coverMats.length) groups.push({ title: '其他素材封面', items: coverMats.slice(0, 9).map((m) => ({ src: m.cover || '', cover: m.cover, label: m.title || m.fileName })) });
                return groups.filter((g) => g.items.length).map((g, gi) => (
                  <React.Fragment key={gi}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7180', margin: '6px 0 5px' }}>{g.title}</div>
                    <div className="mc-pick-grid">
                      {g.items.map((it) => {
                        const on = !!it.src && edited.photos.includes(it.src);
                        return (
                          <div key={it.src} className={`mc-pick-cell ${on ? 'on' : ''}`} onClick={() => it.src && togglePhoto(it.src)}>
                            {it.cover ? <img src={imgSafe(it.cover)} alt="" onError={hideBadImg} loading="lazy" />
                              : <div className="ph"><Icon name="image" size={17} color="#B7BCC6" /></div>}
                            <span className="ck">{on ? <Icon name="check" size={11} /> : <Icon name="plus" size={11} />}</span>
                          </div>
                        );
                      })}
                    </div>
                  </React.Fragment>
                ));
              })()}
              <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <input className="c-input" style={{ flex: 1, minWidth: 150 }} value={urlDraft} placeholder="/images/dress-03.jpg"
                  onChange={(e) => setUrlDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(); }} />
                <button className="c-btn c-btn-sm c-btn-outline" onClick={addPhotoUrl}>添加 URL</button>
              </div>
              <div className="c-chips" style={{ marginTop: 6 }}>
                {TMP_IMG.slice(0, 6).map((s) => (
                  <button key={s} className="c-pill" style={{ cursor: 'pointer' }} onClick={() => togglePhoto(s)}>{s.replace('/images/', '')}</button>
                ))}
              </div>
            </Field>

            {/* 部件面料 */}
            <Field label={`各部件面料（${edited.partsFabric.length} 行）`} required hint="例：前片/后片/袖/里布，标注面料与备注">
              {edited.partsFabric.map((p, i) => (
                <div key={i} className="row" style={{ gap: 5, marginBottom: 6 }}>
                  <input className="c-input" style={{ width: '26%' }} placeholder="部件(前片)" value={p.part}
                    onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, part: e.target.value } : x)) })} />
                  <input className="c-input flex-1" placeholder="面料（高支棉…）" value={p.fabric}
                    onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, fabric: e.target.value } : x)) })} />
                  <input className="c-input" style={{ width: '26%' }} placeholder="备注(可选)" value={p.note}
                    onChange={(e) => setEditor({ ...edited, partsFabric: edited.partsFabric.map((x, xi) => (xi === i ? { ...x, note: e.target.value } : x)) })} />
                  <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setEditor({ ...edited, partsFabric: edited.partsFabric.filter((_, xi) => xi !== i) })}><Icon name="trash" size={12} /></button>
                </div>
              ))}
              <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, partsFabric: [...edited.partsFabric, { part: '', fabric: '', note: '' }] })}>
                <Icon name="plus" size={13} />添加部件
              </button>
            </Field>

            {/* 规格尺码表 */}
            <Field label={`规格尺码表（${edited.rows.length} 档，需 ≥2）`} required>
              <div className="row" style={{ gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                <input className="c-input" style={{ flex: 1, minWidth: 130 }} placeholder="版型标签（标准版型）" value={edited.specLabel}
                  onChange={(e) => setEditor({ ...edited, specLabel: e.target.value })} />
                <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, rows: sampleRows() })}>示例尺码表</button>
                <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditor({ ...edited, rows: [...edited.rows, { size: 'M', bust: '', waist: '', hip: '', shoulder: '', sleeve: '', length: '' }] })}>
                  <Icon name="plus" size={13} />加一档
                </button>
              </div>
              <div className="mc-hscroll">
                <table className="c-table" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>尺码</th>
                      {DIM_FIELDS.map((d) => <th key={d.key}>{d.label}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {edited.rows.map((r, ri) => (
                      <tr key={ri}>
                        <td>
                          <select className="c-select" style={{ width: 70, padding: '6px 22px 6px 6px' }} value={r.size}
                            onChange={(e) => setEditor({ ...edited, rows: edited.rows.map((x, xi) => (xi === ri ? { ...x, size: e.target.value } : x)) })}>
                            {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        {DIM_FIELDS.map((d) => (
                          <td key={d.key}>
                            <input className="c-input" style={{ width: 56, padding: '6px 6px' }} value={(r as unknown as Record<string, string>)[d.key]}
                              onChange={(e) => setEditor({ ...edited, rows: edited.rows.map((x, xi) => (xi === ri ? { ...x, [d.key]: e.target.value } : x)) })} />
                          </td>
                        ))}
                        <td><button className="c-btn c-btn-sm c-btn-danger" onClick={() => setEditor({ ...edited, rows: edited.rows.filter((_, xi) => xi !== ri) })}><Icon name="trash" size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Field>

            {/* 风格标签 */}
            <Field label="风格标签" hint="定价由平台按品类参考价自动生成（可在「商品」页查看），表单不再填写原价/基础费用">
              <TagInput value={edited.styleTags} onChange={(styleTags) => setEditor({ ...edited, styleTags })} suggest={['法式', '碎花', '通勤', '复古', '缎面', '极简']} />
            </Field>

            {/* 3D / 打版 */}
            <div className="row" style={{ gap: 8 }}>
              <Field label={`3D 文件 ${edited.modelMatIds.length ? `×${edited.modelMatIds.length}` : ''}`} required hint="OBJ/GLB" inline>
                <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setPick('model')}><Icon name="layers" size={13} color="#3B82F6" />选择</button>
              </Field>
              <Field label={`打版文件 ${edited.patternMatIds.length ? `×${edited.patternMatIds.length}` : ''}`} required hint="DXF/SVG" inline>
                <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setPick('pattern')}><Icon name="pen-tool" size={13} color="#B4547A" />选择</button>
              </Field>
            </div>
            {materials.filter((m) => edited.modelMatIds.includes(m.id) || edited.patternMatIds.includes(m.id)).length > 0 && (
              <div className="c-chips" style={{ marginBottom: 10 }}>
                {materials.filter((m) => edited.modelMatIds.includes(m.id) || edited.patternMatIds.includes(m.id)).map((m) => (
                  <button key={m.id} className="c-chip" onClick={() => setPick(m.kind === 'obj' || m.kind === 'glb' ? 'model' : 'pattern')}>
                    <MaterialBadge kind={m.kind} /><span className="ellipsis" style={{ maxWidth: 110 }}>{m.title || m.fileName}</span>
                  </button>
                ))}
              </div>
            )}

            {(() => { const miss = completeness(edited); return miss.length ? (
              <div className="mc-note warn"><Icon name="bell" size={15} /><span>提交前自检未通过（{miss.length} 项）：{miss.join('；')}。补齐后提交才会通过系统审核。</span></div>
            ) : null; })()}

            <div className="row" style={{ gap: 8, marginTop: 10 }}>
              <button className="c-btn c-btn-outline" style={{ flex: 1, height: 42 }} disabled={!!saving} onClick={() => save('draft')}>
                <Icon name="edit" size={15} />{saving === 'draft' ? '保存中…' : '保存草稿'}
              </button>
              <button className="c-btn c-btn-primary" style={{ flex: 1.4, height: 42 }} disabled={!!saving} onClick={() => save('submit')}>
                <Icon name="shield" size={15} />{saving === 'submit' ? '审核中…' : '提交系统审核'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 结果弹层 ===== */}
      {result && (
        <Modal onClose={() => setResult(null)} narrow
          title={result.audit?.pass ? '🎉 审核通过，商品已上架' : '⚠️ 审核未通过，请补齐材料'}
          foot={<>
            <button className="c-btn c-btn-outline" onClick={() => { setResult(null); if (result.audit?.pass) setEditor(null); }}>
              {result.audit?.pass ? '继续' : '知道了'}
            </button>
            {result.audit?.pass && (
              <button className="c-btn c-btn-primary" onClick={() => { setResult(null); setEditor(null); navigate('/c/products'); }}>查看商品</button>
            )}
          </>}
        >
          {result.audit?.pass ? (
            <div className="mc-note ok">
              <Icon name="check-circle" size={16} />
              <span><b>「{result.productName}」材料完整，已自动生成 AI 商品详情并上架商城。</b><br />{result.audit?.note}</span>
            </div>
          ) : (
            <div>
              <div className="mc-note err"><Icon name="close" size={15} /><span>材料缺失：{result.audit?.missing?.join('；') || '未达标'}</span></div>
              <div className="mc-sub" style={{ marginTop: 8 }}>补齐后点「提交系统审核」重新提交。</div>
            </div>
          )}
          {result.offShelf && <div className="mc-note warn" style={{ marginTop: 8 }}><Icon name="bell" size={14} />材料变更：原关联商品已自动下架（需重新审核后再上架）。</div>}
        </Modal>
      )}

      {/* ===== 列表 ===== */}
      {!edited && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <div className="mc-hd" style={{ marginBottom: 10 }}>
            <div className="mc-hd-title" style={{ flex: 1 }}>我的橱窗材料</div>
          </div>
          <MTabs items={Object.keys(TAB_TXT).map((k) => ({ key: k, label: TAB_TXT[k], count: countOf(k) }))} value={tab} onChange={setTab} />

          {wl && <Loading text="加载橱窗材料…" />}
          {!wl && error && (
            <MEmpty icon="store" title="橱窗加载失败" desc={error}
              action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重试</button>} />
          )}
          {!wl && !error && !windows.length && (
            <MEmpty icon="store" title="还没有橱窗材料" desc="资源池里的达标作品会提醒你上橱窗；也可以直接新建（先到「作品」创建作品）"
              action={<button className="c-btn c-btn-primary" onClick={startNew}><Icon name="plus" size={14} />新建橱窗材料</button>} />
          )}
          {!wl && !error && windows.length > 0 && visible.length === 0 && (
            <MEmpty icon="filter" title={`「${TAB_TXT[tab]}」暂无材料`} desc="切换其他状态查看" />
          )}

          {visible.map((w) => {
            const log = [...(w.auditLog || [])].reverse();
            const latest = log[0];
            const lastAuditMissing = w.auditMissing || (w.status === 'rejected' && latest ? latest.note?.replace('缺少：', '').split('；').map((s) => s.trim()) : undefined);
            return (
              <div key={w.id} className="mc-row">
                <div style={{ flexShrink: 0, position: 'relative' }}>
                  {w.work?.cover ? (
                    <img src={imgSafe((w.work as { cover?: string }).cover)} alt="" onError={hideBadImg} style={{ width: 64, height: 80, objectFit: 'cover', borderRadius: 10 }} />
                  ) : (
                    <div style={{ width: 64, height: 80, borderRadius: 10, background: '#F1F2F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B7BCC6' }}><Icon name="tshirt" size={24} /></div>
                  )}
                  <span style={{ position: 'absolute', left: -4, top: -4 }}><WindowBadge status={w.status} /></span>
                </div>
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: 13.5 }} className="ellipsis">#{w.id} {w.productName}</b>
                    <span className="c-badge c-badge-gray">{w.category}</span>
                  </div>
                  <div className="mc-sub" style={{ marginTop: 3 }}>
                    {Number(w.price) > 0 ? <>平台参考价 ¥{Number(w.price).toLocaleString()} · 基础费 ¥{Number(w.baseFee).toLocaleString()} · </> : '定价由平台自动生成 · '}
                    图 {w.photos?.length || 0} · 面料 {w.partsFabric?.length || 0} · 尺码 {w.spec?.sizeChart?.length || 0} 档
                    {w.work?.id ? ` · 作品「${(w.work as { title?: string }).title || ''}」` : ''}
                  </div>
                  {latest && (
                    <div className="row" style={{ gap: 5, marginTop: 4, fontSize: 11, color: '#6B7180', alignItems: 'flex-start' }}>
                      <Icon name={latest.passed ? 'check-circle' : 'close'} size={12} color={latest.passed ? 'var(--success)' : 'var(--danger)'} style={{ marginTop: 1 }} />
                      <span style={{ lineHeight: 1.55 }}>{latest.passed ? '通过' : '驳回'}：{latest.note}（{fmtDT(latest.at)}）</span>
                    </div>
                  )}
                  {lastAuditMissing && w.status === 'rejected' && (
                    <div className="mc-note err" style={{ marginTop: 5, fontSize: 11 }}>
                      <Icon name="bell" size={13} /><span>缺失：{(Array.isArray(lastAuditMissing) ? lastAuditMissing : []).join('、')}</span>
                    </div>
                  )}
                  {w.product && (
                    <div className="row" style={{ gap: 5, marginTop: 5, fontSize: 11, color: '#237A54', background: 'var(--success-soft)', borderRadius: 8, padding: '4px 8px', width: 'fit-content' }}>
                      <Icon name="bag" size={12} />商品 #{w.product.id}「{w.product.title}」
                      {(w.product as { status?: string }).status === 'onSale' ? <span className="c-badge c-badge-green">在售</span> : <span className="c-badge c-badge-gray">已下架</span>}
                    </div>
                  )}
                  <div className="mc-tagline" style={{ marginTop: 4 }}>更新 {fmtDT(w.updatedAt || w.createdAt)}</div>

                  {/* 状态操作 */}
                  <div className="row" style={{ gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                    {w.status === 'submitted' && <span className="c-pill"><Icon name="clock" size={11} />系统审核中</span>}
                    {w.status === 'approved' && w.product?.id && (
                      <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate('/c/products')}><Icon name="bag" size={12} />查看商品</button>
                    )}
                    {(w.status === 'draft' || w.status === 'rejected') && (
                      <button className="c-btn c-btn-sm c-btn-outline" onClick={() => openEdit(w)}>
                        <Icon name="edit" size={12} />{w.status === 'rejected' ? '补齐重提' : '继续编辑'}
                      </button>
                    )}
                    {w.status === 'draft' && (
                      <button className="c-btn c-btn-sm c-btn-primary" disabled={!!saving} onClick={() => quickSubmit(w)}>
                        <Icon name="shield" size={12} />提交审核
                      </button>
                    )}
                    {(w.status === 'draft' || w.status === 'rejected') && (
                      <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setDelTarget(w)}><Icon name="trash" size={12} />删除</button>
                    )}
                    {w.status === 'approved' && (
                      <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setApproveEditWarn(w)}>
                        <Icon name="edit" size={12} />修改材料（将重新审核）
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 素材多选 */}
      {pick === 'pattern' && edited && (
        <MaterialPickModal title="选择打版素材（DXF/SVG，至少 1 个）" mats={patternMats} value={edited.patternMatIds}
          onChange={(ids) => setEditor({ ...edited, patternMatIds: ids })} onClose={() => setPick(null)} preview={false} />
      )}
      {pick === 'model' && edited && (
        <MaterialPickModal title="选择 3D 素材（OBJ/GLB，至少 1 个）" mats={modelMats} value={edited.modelMatIds}
          onChange={(ids) => setEditor({ ...edited, modelMatIds: ids })} onClose={() => setPick(null)} preview={false} />
      )}

      {/* 已通过材料变更确认 */}
      <Confirm open={!!approveEditWarn} title="修改已通过的材料？" danger
        body={approveEditWarn ? <>「{approveEditWarn.productName}」已审核上架。修改<b>任何材料字段</b>都会：① 状态转回草稿 ② <b>原商品自动下架</b> ③ 需重新提交审核通过后再上架。仅修改非材料文案请走桌面版「商品管理 → 编辑详情」。</> : null}
        okText="继续修改材料" onOk={() => { if (approveEditWarn) openEdit(approveEditWarn); setApproveEditWarn(null); }} onClose={() => setApproveEditWarn(null)} />

      {/* 删除草稿/被拒材料确认 */}
      <Confirm open={!!delTarget} title="删除这组橱窗材料？" danger
        body={delTarget ? <>「{delTarget.productName}」（状态：{delTarget.status === 'rejected' ? '被拒' : '草稿'}）删除后不可恢复。审核通过的材料需先到商品管理处理后再删除。</> : null}
        okText="确认删除"
        onOk={async () => {
          if (!delTarget) return;
          try {
            await api.window.remove(delTarget.id);
            toast('橱窗材料已删除', 'check');
            if (editor?.id === delTarget.id) closeEdit();
            reload();
          } catch (e) {
            toast((e as Error).message || '删除失败');
          } finally {
            setDelTarget(null);
          }
        }}
        onClose={() => setDelTarget(null)} />
    </div>
  );
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
