/* ============================================================================
 * MaterialViewer —— 素材查看弹层（3D OBJ 预览 / 打版 SVG 预览）
 * 由 id 列表拉取素材详情：model → ObjViewer；pattern → PatternSvg。
 * 用于推文详情与商城商品详情的「素材入口」。
 * ==========================================================================*/
import React from 'react';
import Icon from '../Icon';
import { api } from '../../api/client';
import type { Material } from '../../api/types';
import { Loading } from './utils';
import { MaterialBadge } from './MaterialBadge';
import ObjViewer from './ObjViewer';
import PatternSvg from './PatternSvg';

export default function MaterialViewer({ matIds, mode, open, onClose, title }: {
  matIds: number[]; mode: '3d' | 'pattern'; open: boolean; onClose: () => void; title?: string;
}) {
  const [mats, setMats] = React.useState<Material[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState<number | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open || !matIds?.length) return;
    let stop = false;
    setLoading(true);
    setError('');
    (async () => {
      const out: Material[] = [];
      for (const id of matIds.slice(0, 12)) {
        try { out.push(await api.materials.get(id)); } catch { /* 单个失败跳过 */ }
      }
      if (stop) return;
      setMats(out);
      if (out.length) setActive(out[0].id);
      else setError('素材数据拉取失败（后端未启动或素材非公开）');
      setLoading(false);
    })();
    return () => { stop = true; };
  }, [open, matIds, mode]);

  React.useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  const activeMat = mats.find((m) => m.id === active) || null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(16,12,16,.6)' }} className="fade-in" />
      <div className="fade-in" style={{
        position: 'relative', width: '100%', maxWidth: 430, maxHeight: '90dvh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg)', borderRadius: '20px 20px 0 0', padding: '10px 12px calc(var(--safe-bottom) + 10px)',
      }}>
        <div className="row" style={{ justifyContent: 'space-between', padding: '4px 2px 8px' }}>
          <div className="row" style={{ gap: 8 }}>
            <Icon name={mode === '3d' ? 'layers' : 'pen-tool'} size={18} color="var(--brand)" />
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>{title || (mode === '3d' ? '查看 3D 模型' : '打版图预览')}</span>
          </div>
          <button onClick={onClose} style={{ padding: 5 }}><Icon name="close" size={20} color="var(--text-2)" /></button>
        </div>

        {/* 素材选择器 */}
        {mats.length > 1 && (
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 8 }}>
            {mats.map((m) => (
              <button key={m.id} onClick={() => setActive(m.id)} className="row" style={{
                gap: 6, flexShrink: 0, padding: '5px 11px', borderRadius: 99,
                background: active === m.id ? 'var(--brand)' : '#fff', color: active === m.id ? '#fff' : 'var(--text-2)',
                border: `1px solid ${active === m.id ? 'var(--brand)' : 'var(--line)'}`, fontSize: 11.5, fontWeight: 700,
              }}>
                <MaterialBadge kind={m.kind} />
                <span className="ellipsis" style={{ maxWidth: 120 }}>{m.title || m.fileName}</span>
              </button>
            ))}
          </div>
        )}

        {/* 内容区 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && <Loading text="正在加载素材…" />}
          {!loading && error && (
            <div style={{ padding: '34px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, lineHeight: 1.8 }}>
              {error}
              <div style={{ marginTop: 10 }}>
                <button className="btn btn-outline btn-sm" onClick={onClose}>知道了</button>
              </div>
            </div>
          )}
          {!loading && activeMat && mode === '3d' && (
            <div style={{ padding: '0 0 6px' }}>
              {activeMat.objPreview?.mesh ? (
                <ObjViewer
                  title={activeMat.title || activeMat.fileName}
                  positions={activeMat.objPreview.mesh.positions || []}
                  faces={activeMat.objPreview.mesh.faces || []}
                  height={420}
                />
              ) : (
                <div style={{ borderRadius: 12, background: '#16212B', color: 'rgba(255,255,255,.8)', padding: '26px 18px', textAlign: 'center', fontSize: 12.5, lineHeight: 2 }}>
                  <Icon name="layers" size={30} color="#7EB6FF" />
                  <div style={{ fontWeight: 700, marginTop: 8 }}>该素材无内嵌网格预览</div>
                  <div style={{ color: 'rgba(255,255,255,.55)', fontSize: 11.5 }}>{activeMat.fileName}（{activeMat.ext || activeMat.kind}）仅展示元数据</div>
                  {activeMat.note && <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 11, marginTop: 4 }}>说明：{activeMat.note}</div>}
                  {activeMat.parseWarn && <div style={{ color: '#FFB3B8', fontSize: 11, marginTop: 4 }}>解析提示：{activeMat.parseWarn}</div>}
                </div>
              )}
            </div>
          )}
          {!loading && activeMat && mode === 'pattern' && (
            <div style={{ padding: '0 0 6px' }}>
              {activeMat.patternSvg ? (
                <PatternSvg svg={activeMat.patternSvg} title={activeMat.title || activeMat.fileName} filename={activeMat.fileName} height={430} />
              ) : (
                <div style={{ borderRadius: 12, border: '1px dashed var(--line)', background: '#fff', padding: '30px 18px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>
                  <Icon name="pen-tool" size={28} color="var(--text-3)" />
                  <div style={{ marginTop: 10 }}>该素材暂无打版 SVG（需 .dxf / .svg 源文件解析）</div>
                  {activeMat.parseWarn && <div style={{ color: 'var(--danger)', marginTop: 6 }}>{activeMat.parseWarn}</div>}
                  {mats.length > 1 && <div style={{ marginTop: 6, color: 'var(--text-3)', fontSize: 11 }}>可切换上方其他素材查看</div>}
                </div>
              )}
            </div>
          )}
          {!loading && !mats.length && !error && <Loading text="没有可用素材" />}
        </div>
      </div>
    </div>
  );
}
