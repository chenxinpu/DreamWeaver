/* ============================================================================
 * /c/library 创作者中心 · 素材库（简单版，移动版）
 * kind 统计 chips + 素材列表卡（类型徽章/文件名/图层或实体/时间）+ 点击预览弹层
 * 导入：顶部「导入素材」→ 本地上传（dxf/svg/obj 读文本，png/jpg/glb/zprj 等读 base64）
 *     或「从示例导入」（importHelp → sampleContent）→ api.materials.import
 * ==========================================================================*/
import React from 'react';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Material } from '../../api/types';
import { fmtCount, hideBadImg, imgSafe } from '../../components/shared/utils';
import { MaterialBadge, materialKindLabel } from '../../components/shared/MaterialBadge';
import { readPickedFile, type PickedFile } from '../../components/shared/UploadBox';
import { useAsync, Modal, MatPreview, Confirm, Loading, fmtDT } from './bits';
import { MEmpty } from './bits';

const KIND_ORDER = ['dxf', 'svg', 'obj', 'glb', 'png', 'jpg', 'zprj', 'ai', 'pdf'];
const KIND_ICON: Record<string, IconName> = { dxf: 'pen-tool', svg: 'scissors', obj: 'layers', glb: 'rotate', png: 'image', jpg: 'image', zprj: 'package', ai: 'pen-tool', pdf: 'note' };

/** 将本地上传文件读成导入请求 payload（二进制类读 base64 data url） */
async function filePayload(f: File): Promise<{ fileName: string; kind: string; content?: string } | null> {
  const p: PickedFile = await readPickedFile(f);
  if (p.kind === 'raw') return null;
  if (p.text) return { fileName: p.name, kind: p.kind, content: p.text };
  let data = p.base64;
  if (!data && ['png', 'jpg', 'glb', 'zprj', 'ai', 'pdf'].includes(p.kind)) {
    data = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => resolve('');
      r.readAsDataURL(f);
    });
  }
  return { fileName: p.name, kind: p.kind, content: data || undefined };
}

export default function MLibraryPage() {
  const toast = useToast();
  const { data: res, loading, error, reload } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const mats = res?.list || [];
  const group = res?.group || {};

  const [kind, setKind] = React.useState<string | null>(null);
  const [importOpen, setImportOpen] = React.useState(false);
  const [help, setHelp] = React.useState<{ formats: { kind: string; desc: string; demo: string }[]; samples: { fileName: string; kind: string; size: number }[] } | null>(null);
  const [importing, setImporting] = React.useState(false);
  const [detail, setDetail] = React.useState<Material | null>(null);
  const [delTarget, setDelTarget] = React.useState<Material | null>(null);
  const [delBusy, setDelBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const openImport = async () => {
    setImportOpen(true);
    setHelp(null);
    try { setHelp(await api.materials.importHelp()); } catch { setHelp(null); }
  };

  const doImport = async (payload: { fileName: string; kind: string; content?: string }) => {
    try {
      await api.materials.import(payload);
      toast(`已导入「${payload.fileName}」`, 'check');
      reload();
      return true;
    } catch (e) {
      toast((e as Error).message || '导入失败');
      return false;
    }
  };

  const onLocalFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setImporting(true);
    let ok = 0;
    for (const f of Array.from(files)) {
      const payload = await filePayload(f);
      if (!payload) { toast(`不支持的文件类型：${f.name}`); continue; }
      if (await doImport(payload)) ok++;
    }
    setImporting(false);
    if (ok > 0) toast(`成功导入 ${ok} 个素材`, 'check');
  };

  const importSample = async (fileName: string) => {
    setImporting(true);
    try {
      const c = await api.materials.sampleContent(fileName);
      await doImport({ fileName: c.fileName, kind: c.kind, content: c.content });
    } catch (e) {
      toast((e as Error).message || '示例读取失败');
    } finally {
      setImporting(false);
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

  const kindsPresent = KIND_ORDER.filter((k) => (group[k] || 0) > 0);
  const visible = mats.filter((m) => !kind || m.kind === kind);

  return (
    <div>
      {/* 顶部：说明 + 导入 */}
      <div className="mc-card">
        <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mc-hd" style={{ marginBottom: 4 }}><div className="mc-hd-title">素材库</div></div>
            <div className="mc-sub">支持导入 DXF(打版) / OBJ(3D) / SVG(印花)（服务端真实解析），图片直接入库，GLB/ZPRJ/AI/PDF 记录元数据。导入后可在「作品」组装成作品。</div>
          </div>
          <button className="c-btn c-btn-primary" style={{ height: 38, borderRadius: 12 }} onClick={openImport}>
            <Icon name="upload" size={15} />导入素材
          </button>
        </div>
        <div className="mc-tabs" style={{ marginTop: 10 }}>
          <button className={`mc-tab ${!kind ? 'on' : ''}`} onClick={() => setKind(null)}>全部<span className="n">{mats.length}</span></button>
          {kindsPresent.map((k) => (
            <button key={k} className={`mc-tab ${kind === k ? 'on' : ''}`} onClick={() => setKind(kind === k ? null : k)}>
              {materialKindLabel(k)}<span className="n">{group[k]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 素材列表 */}
      {loading && <div className="mc-card" style={{ marginTop: 10 }}><Loading /></div>}
      {!loading && error && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="layers" title="素材加载失败" desc={error}
            action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重新加载</button>} />
        </div>
      )}
      {!loading && !error && !mats.length && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="upload" title="素材库还是空的" desc="点上方「导入素材」上传 DXF/OBJ/SVG，或从示例文件快速体验"
            action={<button className="c-btn c-btn-primary" onClick={openImport}><Icon name="upload" size={14} />导入第一个素材</button>} />
        </div>
      )}
      {!loading && !error && mats.length > 0 && visible.length === 0 && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <MEmpty icon="search" title={`「${kind ? materialKindLabel(kind) : ''}」暂无素材`} desc="切换其他类型，或去导入该类型文件" />
        </div>
      )}

      {!loading && visible.map((m) => (
        <div key={m.id} className="mc-card" style={{ marginTop: 10, padding: 12 }} onClick={() => setDetail(m)}>
          <div className="row" style={{ gap: 11, alignItems: 'flex-start' }}>
            {/* 缩略 */}
            <div style={{ flexShrink: 0 }}>
              {['png', 'jpg'].includes(m.kind) ? (
                <img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy"
                  style={{ width: 58, height: 58, borderRadius: 10, objectFit: 'cover', background: '#F1F2F5' }} />
              ) : ['dxf', 'svg'].includes(m.kind) ? (
                <div style={{ width: 58, height: 58, borderRadius: 10, background: '#fff', border: '1px solid #EEEFF2', padding: 3, overflow: 'hidden', display: 'flex' }}
                  dangerouslySetInnerHTML={{ __html: m.patternSvg || '' }} />
              ) : (
                <div style={{ width: 58, height: 58, borderRadius: 10, background: '#F3F4F7', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: '#7B8494' }}>
                  <Icon name={m.kind === 'obj' ? 'layers' : m.kind === 'glb' ? 'rotate' : KIND_ICON[m.kind] || 'package'} size={20} />
                </div>
              )}
            </div>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <MaterialBadge kind={m.kind} />
                <b style={{ fontSize: 13, flex: 1, minWidth: 0 }} className="ellipsis">{m.title || m.fileName}</b>
              </div>
              <div className="ellipsis" style={{ fontSize: 11, color: '#9AA0AA', marginTop: 4 }}>{m.fileName}</div>
              <div className="mc-tagline" style={{ marginTop: 3 }}>
                <span>{fmtCount(m.size)}B</span>
                {typeof m.entityCount === 'number' && <span>· {m.entityCount} 实体</span>}
                {m.objPreview && <span>· {m.objPreview.vertices}v / {m.objPreview.faces}f</span>}
                {m.layerNames?.length ? <span>· {m.layerNames.length} 图层</span> : null}
              </div>
            </div>
            <Icon name="chevron-right" size={16} color="#C7CBD2" style={{ marginTop: 4 }} />
          </div>
          <div className="row" style={{ gap: 8, marginTop: 7, justifyContent: 'space-between' }}>
            <span className="mc-tagline">导入于 {fmtDT(m.createdAt)}</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="c-btn c-btn-sm c-btn-soft" onClick={(e) => { e.stopPropagation(); setDetail(m); }}><Icon name="eye" size={12} />预览</button>
              <button className="c-btn c-btn-sm c-btn-danger" onClick={(e) => { e.stopPropagation(); setDelTarget(m); }}><Icon name="trash" size={12} />删除</button>
            </div>
          </div>
        </div>
      ))}

      {/* ===== 导入弹层 ===== */}
      {importOpen && (
        <Modal onClose={() => { if (!importing) setImportOpen(false); }} title="导入素材" icon="upload"
          foot={<>
            <button className="c-btn c-btn-outline" onClick={() => setImportOpen(false)}>关闭</button>
          </>}
        >
          <div className="c-field-label">① 本地上传</div>
          <button className="c-btn c-btn-primary" style={{ width: '100%', height: 44 }} disabled={importing} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={16} />{importing ? '导入中…' : '选择本地设计文件'}
          </button>
          <div className="mc-sub" style={{ marginTop: 6 }}>支持 DXF / SVG / OBJ（文本解析）与 PNG / JPG / GLB / ZPRJ / AI / PDF（base64 入库）。可一次多选。</div>
          <input ref={fileRef} type="file" hidden multiple accept=".dxf,.svg,.obj,.glb,.png,.jpg,.jpeg,.zprj,.ai,.pdf"
            onChange={(e) => { onLocalFiles(e.target.files); e.target.value = ''; }} />

          <div className="c-field-label" style={{ marginTop: 14 }}>② 从示例导入（{help ? `${help.samples.length} 个真实示例` : '加载中…'}）</div>
          {help ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {help.samples.map((s) => (
                <button key={s.fileName} className="row" style={{ gap: 9, border: '1px solid #ECEDF1', borderRadius: 12, padding: '9px 11px', textAlign: 'left', width: '100%' }}
                  disabled={importing} onClick={() => importSample(s.fileName)}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'var(--brand-soft)', color: 'var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={KIND_ICON[s.kind] || 'note'} size={15} />
                  </span>
                  <span className="flex-1" style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, fontSize: 12.3 }} className="ellipsis">{s.fileName}</span>
                    <span style={{ fontSize: 10.5, color: '#9AA0AA' }}>{materialKindLabel(s.kind)} · {fmtCount(s.size)}B</span>
                  </span>
                  <MaterialBadge kind={s.kind} />
                </button>
              ))}
            </div>
          ) : <Loading compact text="读取示例列表…" />}
          <div className="mc-note brand" style={{ marginTop: 10 }}><Icon name="bell" size={14} /><span>导入即由服务端真实解析（dxf/svg/obj），完成后自动刷新列表；素材被作品引用时不可删除。</span></div>
        </Modal>
      )}

      {/* ===== 详情预览 ===== */}
      {detail && (
        <Modal onClose={() => setDetail(null)} title={detail.title || detail.fileName} icon="eye"
          foot={<>
            <button className="c-btn c-btn-danger" onClick={() => setDelTarget(detail)}><Icon name="trash" size={14} />删除素材</button>
            <button className="c-btn c-btn-outline" onClick={() => setDetail(null)}>关闭</button>
          </>}
        >
          <MatPreview m={detail} height={280} />
          <div style={{ marginTop: 10, background: '#F7F8FA', borderRadius: 10, padding: '9px 11px', fontSize: 11.5, lineHeight: 1.9 }}>
            <div className="row" style={{ gap: 6 }}><MaterialBadge kind={detail.kind} /><b className="ellipsis">{detail.fileName}</b></div>
            <div>大小 {fmtCount(detail.size)}B{detail.width && detail.width < 1e7 ? ` · ${Math.round(detail.width)} × ${Math.round(detail.height || 0)}` : ''}</div>
            {detail.layerNames?.length ? <div>图层：{detail.layerNames.join('、')}</div> : null}
            {typeof detail.entityCount === 'number' ? <div>实体数：{detail.entityCount}</div> : null}
            {detail.note && <div className="c-hint" style={{ marginTop: 4 }}>说明：{detail.note}</div>}
            {detail.parseWarn && <div className="mc-note warn" style={{ marginTop: 6 }}><Icon name="bell" size={13} />{detail.parseWarn}</div>}
          </div>
        </Modal>
      )}

      <Confirm open={!!delTarget} danger busy={delBusy} title="删除素材？"
        body={delTarget ? <>将删除「{delTarget.title || delTarget.fileName}」。若该素材正被作品或橱窗材料引用，系统会拒绝删除。</> : null}
        okText="删除" onOk={removeMat} onClose={() => setDelTarget(null)} />
    </div>
  );
}
