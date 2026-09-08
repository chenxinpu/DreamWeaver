/* ============================================================================
 * /creator/library 素材库 —— 左侧导航（导入入口）+ 按 kind 统计 + 筛选 + 卡片网格
 * 导入向导：选择来源(本地上传/示例文件) → 服务端解析实时预览 → 命名/标签确认入库
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Material } from '../../api/types';
import { fmtCount } from '../../components/shared/utils';
import { MaterialBadge, materialKindLabel } from '../../components/shared/MaterialBadge';
import UploadBox, { FileMetaRow } from '../../components/shared/UploadBox';

import { useAsync, Modal, MatThumb, MatPreview, CState, Field, TagInput, Confirm, Loading } from './_shared';

const KIND_ORDER = ['dxf', 'svg', 'obj', 'glb', 'png', 'jpg', 'zprj', 'ai', 'pdf'];
const KIND_ICON: Record<string, IconName> = { dxf: 'pen-tool', svg: 'scissors', obj: 'layers', glb: 'rotate', png: 'image', jpg: 'image', zprj: 'package', ai: 'pen-tool', pdf: 'note' };

/** 将本地上传文件转成导入请求所需 payload */
function payloadOf(f: { name: string; kind: string; text?: string; base64?: string }): { fileName: string; kind: string; content?: string } {
  if (['dxf', 'svg', 'obj'].includes(f.kind)) return { fileName: f.name, kind: f.kind, content: f.text };
  if (f.kind === 'png' || f.kind === 'jpg') return { fileName: f.name, kind: f.kind, content: f.base64 };
  return { fileName: f.name, kind: f.kind };
}

interface WizardCtx {
  step: 1 | 2;
  source: 'local' | 'sample' | null;
  payload: { fileName: string; kind: string; content?: string };
  tempId: number | null;      // 解析预览阶段先入库的临时素材
  parsed: Material | null;
  title: string;
  tags: string[];
  finalized: boolean;
}

export default function LibraryPage() {
  const toast = useToast();
  const { data: res, loading, error, reload } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const mats = res?.list || [];
  const group = res?.group || {};

  const [kind, setKind] = React.useState<string | null>(null);
  const [kw, setKw] = React.useState('');
  const [wizOpen, setWizOpen] = React.useState(false);
  const [help, setHelp] = React.useState<{ formats: { kind: string; desc: string; demo: string }[]; samples: { fileName: string; kind: string; size: number }[] } | null>(null);
  const [detail, setDetail] = React.useState<Material | null>(null);
  const [delTarget, setDelTarget] = React.useState<Material | null>(null);
  const [delBusy, setDelBusy] = React.useState(false);

  const [wiz, setWiz] = React.useState<WizardCtx>({ step: 1, source: null, payload: { fileName: '', kind: '' }, tempId: null, parsed: null, title: '', tags: [], finalized: false });
  const [preparing, setPreparing] = React.useState(false);

  const openHelp = async () => {
    setWizOpen(true);
    setWiz({ step: 1, source: null, payload: { fileName: '', kind: '' }, tempId: null, parsed: null, title: '', tags: [], finalized: false });
    try { const h = await api.materials.importHelp(); setHelp(h); } catch { setHelp(null); }
  };

  const cleanupTemp = React.useCallback((id: number | null) => {
    if (id != null) api.materials.remove(id).catch(() => {});
  }, []);

  React.useEffect(() => {
    // 向导中途关闭/卸载：清理已预导入的临时素材（避免残留空素材）
    if (!wizOpen && wiz.tempId != null && !wiz.finalized) cleanupTemp(wiz.tempId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizOpen]);

  /* 进入解析预览：把文件先导入（服务端真实解析）拿到解析结果 */
  const startParse = async (payload: { fileName: string; kind: string; content?: string }, source: 'local' | 'sample') => {
    setPreparing(true);
    try {
      const m = await api.materials.import(payload);
      setWiz((w) => ({ ...w, step: 2, source, payload, tempId: m.id, parsed: m, title: m.title || m.fileName.replace(/\.[^.]+$/, ''), tags: m.tags || [] }));
    } catch (e) {
      toast((e as Error).message || '解析失败');
      setWiz((w) => ({ ...w, source }));
    } finally {
      setPreparing(false);
    }
  };

  const finishImport = async () => {
    const w = wiz;
    if (!w.parsed) return;
    // 命名/标签与默认不一致：删除临时素材后按最终标题重新导入
    const changed = w.title !== w.parsed.title || w.tags.join(',') !== (w.parsed.tags || []).join(',');
    try {
      if (changed) {
        cleanupTemp(w.tempId);
        const m = await api.materials.import({ ...w.payload, title: w.title, tags: w.tags });
        setWiz((x) => ({ ...x, parsed: m, tempId: m.id }));
      }
      setWiz((x) => ({ ...x, finalized: true }));
      setWizOpen(false);
      toast(`已导入「${w.parsed.title}」`, 'check');
      reload();
    } catch (e) {
      toast((e as Error).message || '导入失败');
    }
  };

  const removeMat = async () => {
    if (!delTarget) return;
    setDelBusy(true);
    try {
      await api.materials.remove(delTarget.id);
      toast('素材已删除');
      setDelTarget(null);
      setDetail(null);
      reload();
    } catch (e) {
      toast((e as Error).message || '删除失败');
    } finally {
      setDelBusy(false);
    }
  };

  const filtered = mats.filter((m) => (!kind || m.kind === kind) && (!kw || `${m.title}${m.fileName}${m.tags.join(' ')}`.toLowerCase().includes(kw.toLowerCase())));
  const kindsPresent = KIND_ORDER.filter((k) => (group[k] || 0) > 0);

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
      {/* ============ 左侧子导航（导入入口放这里，见 iter_v2 文档） ============ */}
      <div className="c-rail">
        <button className="c-btn c-btn-primary" style={{ width: '100%', height: 40, borderRadius: 11 }} onClick={openHelp}>
          <Icon name="upload" size={16} />导入素材
        </button>
        <div style={{ marginTop: 16, fontSize: 11, fontWeight: 800, color: '#9AA0AA', padding: '0 8px 6px', letterSpacing: 1 }}>按类型浏览</div>
        <div className="c-rail-item on" onClick={() => setKind(null)}>
          <span className="row" style={{ gap: 8 }}><Icon name="layers" size={15} />全部素材</span>
          <span className="cnt">{mats.length}</span>
        </div>
        {kindsPresent.map((k) => (
          <div key={k} className="c-rail-item" onClick={() => setKind(k)}>
            <span className="row" style={{ gap: 8 }}><Icon name={KIND_ICON[k] || 'note'} size={15} />{materialKindLabel(k)}</span>
            <span className="cnt">{group[k]}</span>
          </div>
        ))}
        <button className="c-rail-item" onClick={reload} style={{ marginTop: 8 }}>
          <span className="row" style={{ gap: 8 }}><Icon name="refresh" size={15} />刷新列表</span>
        </button>
      </div>

      {/* ============ 素材列表主区 ============ */}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="c-toolbar">
          <h1 className="creator-h1" style={{ fontSize: 18, marginRight: 6 }}>素材库</h1>
          <div className="c-search">
            <Icon name="search" size={14} color="#9AA0AA" style={{ position: 'absolute', left: 11, top: 10 }} />
            <input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索文件名 / 标题 / 标签" />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {kindsPresent.map((k) => (
              <button key={k} className={`c-badge c-badge-${kind === k ? 'brand' : 'gray'}`} style={{ cursor: 'pointer', fontSize: 11.5, padding: '4px 12px' }} onClick={() => setKind(kind === k ? null : k)}>
                {materialKindLabel(k)} {group[k]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 12 }} className="c-hint">
          支持导入主流服装软件导出文件：DXF(打版)/OBJ(3D)/SVG(印花) 由服务端真实解析出打版图与 3D 网格；
          图片直接入库；GLB/ZPRJ/AI/PDF 记录元数据。导入后可在「作品组织」组装成作品。
        </div>

        {loading && <Loading text="素材加载中…" />}
        {!loading && error && (
          <div className="c-card"><CState danger icon="layers" title="素材加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重新加载</button>} /></div>
        )}
        {!loading && !error && !mats.length && (
          <div className="c-card"><CState icon="upload" title="素材库还是空的" desc="点击左侧「导入素材」，可上传 DXF/OBJ/SVG 或从示例文件快速体验" action={<button className="c-btn c-btn-primary" onClick={openHelp}><Icon name="upload" size={15} />导入第一个素材</button>} /></div>
        )}
        {!loading && !error && filtered.length === 0 && mats.length > 0 && (
          <div className="c-card"><CState icon="search" title="没有匹配的素材" desc="换个关键词或类型筛选试试" /></div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="c-grid">
            {filtered.map((m) => (
              <div className="mat-card" key={m.id} onClick={() => setDetail(m)}>
                <MatThumb m={m} />
                <div className="mat-info">
                  <div className="mat-name">
                    <MaterialBadge kind={m.kind} />
                  </div>
                  <div className="mat-name" style={{ marginTop: 5 }}><span className="ellipsis">{m.title || m.fileName}</span></div>
                  <div className="mat-meta">
                    <span className="ellipsis" style={{ maxWidth: '100%' }}>{m.fileName}</span>
                  </div>
                  <div className="mat-meta">
                    <span>{fmtCount(m.size)}B</span>
                    {typeof m.entityCount === 'number' && <span>{m.entityCount} 实体</span>}
                    {m.objPreview && <span>{m.objPreview.vertices}v</span>}
                    {m.layerNames && <span>{m.layerNames.length} 图层</span>}
                  </div>
                  <div className="row" style={{ marginTop: 8, gap: 6 }}>
                    <button className="c-btn c-btn-sm c-btn-soft" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setDetail(m); }}><Icon name="eye" size={12} />预览</button>
                    <button className="c-btn c-btn-sm c-btn-danger" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setDelTarget(m); }}><Icon name="trash" size={12} />删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============ 导入向导 ============ */}
      {wizOpen && (
        <Modal wide onClose={() => { if (!preparing) setWizOpen(false); }} title={wiz.step === 1 ? '导入素材 · ① 选择来源' : '导入素材 · ② 解析预览'} icon="upload"
          foot={wiz.step === 2 && wiz.parsed ? (
            <>
              <span className="flex-1 c-hint" style={{ fontSize: 11.5 }}>服务端已真实解析（{materialKindLabel(wiz.parsed.kind)}）· 图层/实体/网格统计见上方预览</span>
              <button className="c-btn c-btn-outline" onClick={() => setWizOpen(false)}>取消</button>
              <button className="c-btn c-btn-primary" onClick={finishImport}><Icon name="check" size={14} />完成导入</button>
            </>
          ) : undefined}
        >
          {wiz.step === 1 && (
            <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div className="flex-1" style={{ minWidth: 300 }}>
                <div className="c-field-label">① 本地上传</div>
                <UploadBox
                  acceptKinds={['dxf', 'svg', 'obj', 'glb', 'png', 'jpg', 'zprj', 'ai', 'pdf']}
                  title="点击选择或拖入设计文件"
                  hint="DXF(R12 打版) / OBJ(3D网格) / SVG(印花) 会实时解析预览；PNG/JPG 直接入库；GLB/ZPRJ/AI/PDF 记录元数据。"
                  onFiles={(fs) => {
                    const f = fs[0];
                    if (!f) return;
                    if (f.kind === 'raw') { toast('暂不支持该文件类型'); return; }
                    void startParse(payloadOf(f), 'local');
                  }}
                />
              </div>
              <div className="flex-1" style={{ minWidth: 300 }}>
                <div className="c-field-label">② 或从示例文件导入（{help ? `${help.samples.length} 个真实示例` : '加载中…'}）</div>
                {help ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {help.samples.map((s) => (
                      <button key={s.fileName} className="row tap-row" style={{ gap: 10, border: '1px solid var(--creator-line)', borderRadius: 12, padding: '10px 12px', background: '#fff', textAlign: 'left', width: '100%' }} onClick={() => {
                        setPreparing(true);
                        api.materials.sampleContent(s.fileName).then((c) => startParse({ fileName: c.fileName, kind: c.kind, content: ['dxf', 'svg', 'obj'].includes(c.kind) ? c.content : undefined }, 'sample'))
                          .catch((e) => { toast((e as Error).message || '示例读取失败'); })
                          .finally(() => setPreparing(false));
                      }}>
                        <span style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon name={KIND_ICON[s.kind] || 'note'} size={16} />
                        </span>
                        <span className="flex-1" style={{ minWidth: 0 }}>
                          <span style={{ display: 'block', fontWeight: 700, fontSize: 12.8 }} className="ellipsis">{s.fileName}</span>
                          <span style={{ fontSize: 11, color: '#9AA0AA' }}>{materialKindLabel(s.kind)} · {fmtCount(s.size)}B</span>
                        </span>
                        <MaterialBadge kind={s.kind} />
                        <Icon name="arrow-right" size={15} color="#C0C4CC" />
                      </button>
                    ))}
                  </div>
                ) : <Loading compact text="读取支持格式…" />}
              </div>
            </div>
          )}

          {wiz.step === 2 && !preparing && wiz.parsed && (
            <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div className="flex-1" style={{ minWidth: 340 }}>
                <div className="c-field-label"><Icon name="eye" size={14} color="var(--brand)" /> 服务端解析结果（实时）</div>
                <MatPreview m={wiz.parsed} height={330} />
              </div>
              <div style={{ width: 300, flexShrink: 0 }}>
                <div className="c-field-label">解析统计</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['类型', materialKindLabel(wiz.parsed.kind)],
                    ['大小', `${fmtCount(wiz.parsed.size)}B`],
                    ['图层', wiz.parsed.layerNames?.length ? String(wiz.parsed.layerNames.length) : '—'],
                    ['实体', wiz.parsed.entityCount != null ? String(wiz.parsed.entityCount) : '—'],
                    ['顶点', wiz.parsed.objPreview ? String(wiz.parsed.objPreview.vertices) : '—'],
                    ['面', wiz.parsed.objPreview ? String(wiz.parsed.objPreview.faces) : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#F7F8FA', borderRadius: 10, padding: '9px 11px' }}>
                      <div style={{ fontSize: 10.5, color: '#9AA0AA' }}>{k}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>
                {wiz.parsed.layerNames?.length ? (
                  <div style={{ marginTop: 8, fontSize: 11, color: '#6B7180', lineHeight: 1.9 }}>图层：{wiz.parsed.layerNames.join('、')}</div>
                ) : null}
                {wiz.parsed.note && <div className="c-hint" style={{ marginTop: 8, fontSize: 11.5 }}>说明：{wiz.parsed.note}</div>}
                {wiz.parsed.parseWarn && <div className="c-notice warn" style={{ marginTop: 10 }}><Icon name="bell" size={13} />解析提示：{wiz.parsed.parseWarn}</div>}

                <div style={{ marginTop: 14 }}>
                  <Field label="素材名称（入库后显示名）"><input className="c-input" value={wiz.title} onChange={(e) => setWiz((x) => ({ ...x, title: e.target.value }))} /></Field>
                  <Field label="标签">
                    <TagInput value={wiz.tags} onChange={(tags) => setWiz((x) => ({ ...x, tags }))} suggest={[wiz.parsed.kind, '打版', '3D', '印花', '连衣裙', '衬衫', '面料']} />
                  </Field>
                </div>
              </div>
            </div>
          )}
          {wiz.step === 2 && preparing && <Loading text="正在解析并生成预览…" />}
        </Modal>
      )}

      {/* ============ 详情预览 ============ */}
      {detail && (
        <Modal wide onClose={() => setDetail(null)} title={detail.title || detail.fileName} icon="eye"
          foot={<>
            <button className="c-btn c-btn-danger" onClick={() => { setDelTarget(detail); }}><Icon name="trash" size={14} />删除素材</button>
            <button className="c-btn c-btn-outline" onClick={() => setDetail(null)}>关闭</button>
          </>}
        >
          <MatPreview m={detail} height={420} />
          <div style={{ marginTop: 12 }}>
            <div className="c-field-label">素材信息</div>
            <FileMetaRow f={{ name: detail.fileName, ext: detail.ext || detail.kind, kind: detail.kind, size: detail.size }} />
          </div>
        </Modal>
      )}

      {/* 删除确认 */}
      <Confirm open={!!delTarget} danger busy={delBusy} title="删除素材？"
        body={delTarget ? <>将删除「{delTarget.title || delTarget.fileName}」。若该素材正被作品或橱窗材料引用，系统会拒绝删除。</> : null}
        okText="删除" onOk={removeMat} onClose={() => setDelTarget(null)} />
    </div>
  );
}
