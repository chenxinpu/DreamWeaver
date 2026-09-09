/* ============================================================================
 * 创作者平台（桌面）共享小组件
 * 模态/表单字段/状态徽标/素材预览/确认弹窗/数据 hook —— 各模块页复用
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { useMe } from '../../api/session';
import { MaterialBadge, materialKindLabel } from '../../components/shared/MaterialBadge';
import { ErrorBox, hideBadImg, imgSafe } from '../../components/shared/utils';
import PatternSvg from '../../components/shared/PatternSvg';
import ObjViewer from '../../components/shared/ObjViewer';
import type { Material } from '../../api/types';
export { Loading } from '../../components/shared/utils';

/* ------------------------------ 时间格式 ------------------------------ */
export function fmtDT(v?: string | null): string {
  if (!v) return '—';
  const t = new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}+08:00`);
  if (Number.isNaN(t.getTime())) return v;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
export function fmtD(v?: string | null): string {
  if (!v) return '—';
  const t = new Date(v.includes('T') ? v : `${v.replace(' ', 'T')}+08:00`);
  if (Number.isNaN(t.getTime())) return v.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
}

/* ------------------------------ 状态徽标 ------------------------------ */
const WINDOW_TXT: Record<string, string> = { draft: '草稿', submitted: '审核中', approved: '已通过', rejected: '被拒' };
export const windowStatusText = (s?: string | null) => (s ? WINDOW_TXT[s] || s : '—');

export function WindowBadge({ status }: { status?: string | null }) {
  const cls = status === 'approved' ? 'c-badge-green'
    : status === 'submitted' ? 'c-badge-blue'
    : status === 'rejected' ? 'c-badge-red'
    : 'c-badge-gray';
  return <span className={`c-badge ${cls}`}>{windowStatusText(status)}</span>;
}

const PRODUCT_TXT: Record<string, string> = { onSale: '在售', offShelf: '已下架', draft: '未上架' };
export function ProductBadge({ status }: { status?: string | null }) {
  const s = status || 'draft';
  const cls = s === 'onSale' ? 'c-badge-green' : s === 'offShelf' ? 'c-badge-gray' : 'c-badge-gold';
  return <span className={`c-badge ${cls}`}>{PRODUCT_TXT[s] || s}</span>;
}

export const ROLE_TXT: Record<string, string> = {
  creator: '创作者', consumer: '消费者', auditor: '审核员', admin: '管理员',
};

/* ------------------------------ 三态占位 ------------------------------ */
export function CState({ icon = 'layers', title, desc, action, danger }: {
  icon?: IconName; title: string; desc?: React.ReactNode; action?: React.ReactNode; danger?: boolean;
}) {
  return (
    <div className="c-state">
      <div className="ico" style={{ background: danger ? 'var(--danger-soft)' : '#F1F2F5', color: danger ? 'var(--danger)' : '#9AA0AA' }}>
        <Icon name={icon} size={28} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#3A3F48' }}>{title}</div>
      {desc && <div className="c-hint" style={{ marginTop: 8, maxWidth: 560, margin: '8px auto 0' }}>{desc}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function CError({ msg, onRetry }: { msg: string; onRetry?: () => void }) {
  return <ErrorBox msg={msg || '加载失败'} onRetry={onRetry}>{null}</ErrorBox>;
}

/* ------------------------------ 桌面 Modal ------------------------------ */
export function Modal({ onClose, title, children, foot, wide, narrow, icon }: {
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
  wide?: boolean;
  narrow?: boolean;
  icon?: IconName;
}) {
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="cm-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`cm-box ${wide ? 'wide' : ''} ${narrow ? 'narrow' : ''} fade-in`} onMouseDown={(e) => e.stopPropagation()}>
        <div className="cm-hd">
          <div className="t">
            {icon && <Icon name={icon} size={18} color="var(--brand)" />}
            {title}
          </div>
          <button onClick={onClose} style={{ padding: 5, color: '#8B919C' }}><Icon name="close" size={19} /></button>
        </div>
        <div className="cm-bd">{children}</div>
        {foot && <div className="cm-ft">{foot}</div>}
      </div>
    </div>
  );
}

/* ------------------------------ 确认弹窗 ------------------------------ */
export function Confirm({ open, title, body, okText = '确定', danger, busy, onOk, onClose }: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  okText?: string;
  danger?: boolean;
  busy?: boolean;
  onOk: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <Modal onClose={onClose} title={title} narrow
      foot={(
        <>
          <button className="c-btn c-btn-outline" onClick={onClose}>取消</button>
          <button className={`c-btn ${danger ? 'c-btn-danger' : 'c-btn-primary'}`} disabled={busy} onClick={onOk}>
            {busy ? '处理中…' : okText}
          </button>
        </>
      )}
    >
      <div className="c-hint" style={{ fontSize: 13 }}>{body}</div>
    </Modal>
  );
}

/* ------------------------------ 表单字段 ------------------------------ */
export function Field({ label, required, children, hint, inline }: {
  label?: React.ReactNode; required?: boolean; children: React.ReactNode; hint?: string; inline?: boolean;
}) {
  return (
    <div className="c-field" style={inline ? { display: 'flex', alignItems: 'center', gap: 10 } : undefined}>
      {label !== undefined && (
        <div className="c-field-label">
          {required && <span className="c-req">*</span>}
          {label}
        </div>
      )}
      {children}
      {hint && <div style={{ fontSize: 11, color: '#9AA0AA', marginTop: 4, lineHeight: 1.6 }}>{hint}</div>}
    </div>
  );
}

/* ------------------------------ 标签 chips 输入 ------------------------------ */
export function TagInput({ value, onChange, placeholder = '输入后回车添加', suggest }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggest?: string[];
}) {
  const [draft, setDraft] = React.useState('');
  const toast = useToast();
  const add = (t: string) => {
    const s = t.trim().replace(/^#/, '');
    if (!s) return;
    if (value.includes(s)) { toast('标签已存在'); return; }
    if (value.length >= 8) { toast('最多 8 个标签'); return; }
    onChange([...value, s]);
  };
  const pool = suggest?.filter((s) => !value.includes(s)) || [];
  return (
    <div className="c-chips">
      {value.map((t) => (
        <span key={t} className="c-chip">
          #{t}
          <button className="c-chip x" onClick={() => onChange(value.filter((x) => x !== t))} title="删除"><Icon name="close" size={10} /></button>
        </span>
      ))}
      {pool.length > 0 && pool.slice(0, 8).map((s) => (
        <button key={s} className="c-chip" style={{ cursor: 'pointer' }} onClick={() => add(s)}>+ {s}</button>
      ))}
      <span className="c-chip-add">
        <Icon name="plus" size={12} />
        <input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(draft); setDraft(''); }
            if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
          }}
        />
      </span>
    </div>
  );
}

/* ------------------------------ 素材缩略（列表用） ------------------------------ */
export function MatThumb({ m, small }: { m: Material; small?: boolean }) {
  const [zoom, setZoom] = React.useState(false);
  return (
    <>
      <div className="mat-thumb" style={{ aspectRatio: small ? undefined : '4/3', height: small ? 58 : undefined, width: small ? 58 : undefined, borderRadius: small ? 9 : 0 }} onClick={() => setZoom(true)}>
        <ThumbVisual m={m} />
        <span style={{ position: 'absolute', left: 6, top: 6, zIndex: 2 }}><MaterialBadge kind={m.kind} /></span>
      </div>
      {zoom && (
        <Modal onClose={() => setZoom(false)} title={m.title || m.fileName} icon="eye">
          <MatPreview m={m} />
        </Modal>
      )}
    </>
  );
}

function ThumbVisual({ m }: { m: Material }) {
  if (m.kind === 'png' || m.kind === 'jpg') return <img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy" className="mat-img" />;
  if ((m.kind === 'dxf' || m.kind === 'svg') && m.patternSvg) {
    return <div style={{ width: '100%', height: '100%', padding: 3, background: '#fff', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: m.patternSvg }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#8B94A3' }}>
      <Icon name={m.kind === 'obj' ? 'layers' : m.kind === 'glb' ? 'rotate' : 'package'} size={24} />
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{materialKindLabel(m.kind)}</span>
    </div>
  );
}

/** 素材内嵌预览主体：3D / 打版 / 图片 / 元数据 */
export function MatPreview({ m, height = 300 }: { m?: Material | null; height?: number }) {
  if (!m) {
    return <div style={{ textAlign: 'center', color: '#9AA0AA', padding: 30, fontSize: 12.5 }}>暂无素材数据</div>;
  }
  if (m.kind === 'obj' || m.kind === 'glb') {
    if (m.objPreview?.mesh) {
      return <ObjViewer title={m.title || m.fileName} positions={m.objPreview.mesh.positions} faces={m.objPreview.mesh.faces} height={height} />;
    }
    return <MetaCard m={m} />;
  }
  if (m.kind === 'dxf' || m.kind === 'svg') {
    if (m.patternSvg) return <PatternSvg svg={m.patternSvg} title={m.title} filename={m.fileName} height={height} />;
    return <MetaCard m={m} />;
  }
  if (m.kind === 'png' || m.kind === 'jpg') {
    return (
      <div style={{ borderRadius: 12, overflow: 'hidden', background: '#161B22' }}>
        <img src={imgSafe(m.cover)} alt={m.fileName} onError={hideBadImg} style={{ width: '100%', maxHeight: height, objectFit: 'contain', display: 'block' }} />
      </div>
    );
  }
  return <MetaCard m={m} />;
}

function MetaCard({ m }: { m: Material }) {
  const stats: [string, string][] = [
    ['格式', `${materialKindLabel(m.kind)} (.${m.ext || m.kind})`],
    ['文件名', m.fileName],
    ['大小', `${(m.size || 0).toLocaleString()} B`],
    ...(m.width && m.width < 1e7 ? [['宽 × 高', `${Math.round(m.width)} × ${Math.round(m.height || 0)}`] as [string, string]] : []),
  ];
  return (
    <div style={{ borderRadius: 14, border: '1px solid var(--creator-line)', background: '#FBFBFD', padding: '18px 20px' }}>
      <div className="row" style={{ gap: 10, marginBottom: 10 }}>
        <MaterialBadge kind={m.kind} size="md" />
        <b style={{ fontSize: 14 }}>{m.title || m.fileName}</b>
      </div>
      {stats.map(([k, v]) => (
        <div className="kv-row" key={k} style={{ fontSize: 12.5 }}>
          <span className="kv-key">{k}</span>
          <span className="kv-val">{v}</span>
        </div>
      ))}
      {m.layerNames?.length ? <div className="kv-row"><span className="kv-key">图层</span><span className="kv-val">{m.layerNames.join('、')}</span></div> : null}
      {typeof m.entityCount === 'number' ? <div className="kv-row"><span className="kv-key">实体数</span><span className="kv-val">{m.entityCount}</span></div> : null}
      {m.objPreview ? <div className="kv-row"><span className="kv-key">网格</span><span className="kv-val">顶点 {m.objPreview.vertices} · 面 {m.objPreview.faces}</span></div> : null}
      {m.note && <div className="c-hint" style={{ marginTop: 10 }}>说明：{m.note}</div>}
      {m.parseWarn && <div className="c-notice warn" style={{ marginTop: 10 }}><Icon name="bell" size={14} /><span>解析提示：{m.parseWarn}</span></div>}
      {m.tags?.length > 0 && (
        <div className="c-chips" style={{ marginTop: 10 }}>
          {m.tags.map((t) => <span key={t} className="c-pill">#{t}</span>)}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ 素材多选（works/publish/window 共用） ------------------------------ */
export function MaterialPickModal({ mats, value, onChange, onClose, title, preview = true }: {
  mats: Material[];
  value: number[];
  onChange: (ids: number[]) => void;
  onClose: () => void;
  title: string;
  preview?: boolean;
}) {
  const [previewId, setPreviewId] = React.useState<number | null>(value[0] ?? mats[0]?.id ?? null);
  const active = mats.find((m) => m.id === previewId) || null;
  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  return (
    <Modal wide onClose={onClose} title={title} icon="layers"
      foot={<><span className="flex-1" style={{ fontSize: 12, color: '#8B919C' }}>已选 {value.length} 个素材</span>
        <button className="c-btn c-btn-outline" onClick={onClose}>关闭</button></>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: preview ? 'minmax(0,1fr) 300px' : '1fr', gap: 16 }}>
        <div>
          <div className="pick-grid">
            {mats.map((m) => {
              const on = value.includes(m.id);
              return (
                <div key={m.id} className={`pick-cell ${on ? 'on' : ''}`} onClick={() => toggle(m.id)}
                  onMouseEnter={() => setPreviewId(m.id)} title={m.title || m.fileName}>
                  <div className="ph">
                    <CellVisual m={m} />
                  </div>
                  <span className="ck">{on ? <Icon name="check" size={12} /> : <Icon name="plus" size={12} />}</span>
                  <span className="cap">{m.title || m.fileName}</span>
                </div>
              );
            })}
            {!mats.length && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9AA0AA', padding: 26, fontSize: 12.5 }}>
                暂无可用素材，请先到「素材库」导入
              </div>
            )}
          </div>
        </div>
        {preview && (
          <div>
            <div className="c-card" style={{ padding: 12 }}>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                <Icon name="eye" size={14} color="var(--brand)" />
                <b style={{ fontSize: 12.5 }}>实时预览</b>
              </div>
              {active ? (
                <>
                  <MatPreview m={active} height={230} />
                  <div className="row" style={{ gap: 6, marginTop: 8 }}>
                    <MaterialBadge kind={active.kind} />
                    <span className="ellipsis" style={{ fontSize: 11.5, color: '#6B7180' }}>{active.fileName}</span>
                  </div>
                </>
              ) : <div style={{ fontSize: 12, color: '#9AA0AA' }}>悬停素材可预览</div>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** pick-cell 内的小缩略（图片 / 图案 svg 内联 / 3D 用色块标识） */
function CellVisual({ m }: { m: Material }) {
  if (m.kind === 'png' || m.kind === 'jpg') {
    return <img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy" />;
  }
  if (m.kind === 'svg' || m.kind === 'dxf') {
    return <div style={{ width: '100%', height: '100%', padding: 4, background: '#fff' }} dangerouslySetInnerHTML={{ __html: m.patternSvg || '' }} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#7B8494' }}>
      <Icon name={m.kind === 'obj' ? 'layers' : m.kind === 'glb' ? 'rotate' : 'package'} size={22} />
      <span style={{ fontSize: 10.5, fontWeight: 700 }}>{materialKindLabel(m.kind)}</span>
    </div>
  );
}

/* ------------------------------ 通用数据 hook ------------------------------ */
export function useAsync<T>(loader: () => Promise<T>, deps: React.DependencyList = []): {
  data: T | null; loading: boolean; error: string; reload: () => void; setData: React.Dispatch<React.SetStateAction<T | null>>;
} {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [ver, setVer] = React.useState(0);
  React.useEffect(() => {
    let stop = false;
    setLoading(true);
    setError('');
    loader()
      .then((d) => { if (!stop) setData(d); })
      .catch((e) => { if (!stop) setError((e as Error)?.message || '加载失败'); })
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, ver]);
  return { data, loading, error, reload: React.useCallback(() => setVer((v) => v + 1), []), setData };
}

/* 弹一个错误 toast */
export function errToast(e: unknown): string {
  return (e as Error)?.message || '操作失败，请稍后再试';
}

/* ------------------------------ 尺码维度列 ------------------------------ */
export const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const DIM_FIELDS: { key: string; label: string }[] = [
  { key: 'bust', label: '胸围' }, { key: 'waist', label: '腰围' }, { key: 'hip', label: '臀围' },
  { key: 'shoulder', label: '肩宽' }, { key: 'sleeve', label: '袖长' }, { key: 'length', label: '衣长' },
];

/* ------------------------------ 无权限提示（带切账号） ------------------------------ */
export function NoPerm({ title, desc, to }: { title?: string; desc?: React.ReactNode; to?: string }) {
  const navigate = useNavigate();
  const { user } = useMe();
  return (
    <CState danger icon="ban" title={title || '无权访问此页面'}
      desc={desc || (
        <span>当前账号为「{user?.nickname || '未知'}」（{ROLE_TXT[user?.role || ''] || user?.role}）。
          该模块需要对应角色：创作者「小织 #1」可进入全部运营/创作模块；审核员「平台审核专员 #99」可进入审核演示。</span>
      )}
      action={<button className="c-btn c-btn-primary" onClick={() => navigate(to || '/login')}><Icon name="logout" size={15} />去登录 / 切换账号</button>} />
  );
}
