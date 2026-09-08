/* ============================================================================
 * /creator/works 作品组织 —— 由素材组装作品（表单）+ 已有作品列表（可跳发推文）
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Material, Work } from '../../api/types';
import { PRODUCT_CATEGORIES } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { MaterialBadge } from '../../components/shared/MaterialBadge';
import { useAsync, CState, Field, TagInput, Modal, MatPreview, MaterialPickModal, Loading, fmtDT } from './_shared';

const SUGGEST_TAGS = ['法式', '碎花', '通勤', '泡泡袖', '缎面', '波点', '新中式', '极简', '羊毛'];

export default function WorksPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: mats, loading: ml } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const { data: list, loading, error, reload } = useAsync(() => api.works.mine(), []);
  const works = list?.list || [];
  const materialList = mats?.list || [];

  const [title, setTitle] = React.useState('');
  const [category, setCategory] = React.useState<string>('连衣裙');
  const [fabric, setFabric] = React.useState('');
  const [desc, setDesc] = React.useState('');
  const [styleTags, setStyleTags] = React.useState<string[]>([]);
  const [cover, setCover] = React.useState('');
  const [patternIds, setPatternIds] = React.useState<number[]>([]);
  const [modelIds, setModelIds] = React.useState<number[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [pick, setPick] = React.useState<'pattern' | 'model' | 'cover' | null>(null);
  const [coverUrl, setCoverUrl] = React.useState('');

  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const coverCandidates = materialList.filter((m) => m.cover || ['png', 'jpg'].includes(m.kind));

  const reset = () => {
    setTitle(''); setCategory('连衣裙'); setFabric(''); setDesc(''); setStyleTags([]);
    setCover(''); setPatternIds([]); setModelIds([]);
  };

  const create = async () => {
    if (!title.trim()) { toast('请填写作品标题'); return; }
    if (!patternIds.length && !modelIds.length) { toast('请至少选择 1 个打版或 3D 素材'); return; }
    setSubmitting(true);
    try {
      const { work } = await api.works.create({
        title: title.trim(), category, fabric, desc,
        styleTags, cover,
        patternMatIds: patternIds, modelMatIds: modelIds,
        mediaImages: cover ? [cover] : [],
      });
      toast(`作品「${work.title}」已创建`, 'check');
      reset();
      reload();
    } catch (e) {
      toast((e as Error).message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const chosenPattern = materialList.filter((m) => patternIds.includes(m.id));
  const chosenModel = materialList.filter((m) => modelIds.includes(m.id));

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
      {/* ============ 左侧：新建作品表单 ============ */}
      <div className="c-card flex-1" style={{ minWidth: 420, maxWidth: 640 }}>
        <div className="c-card-hd">
          <span className="c-card-title">组装新作品</span>
          <span className="c-pill">从素材库选择打版图 + 3D 网格</span>
        </div>
        {ml ? <Loading compact /> : (
          <>
            <div className="form-grid">
              <Field label="作品名称" required>
                <input className="c-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：法式碎花泡泡袖连衣裙" />
              </Field>
              <Field label="品类" required>
                <select className="c-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <Field label="面料">
              <input className="c-input" value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="例：高支棉 / 醋酸缎面" />
            </Field>
            <Field label="描述">
              <textarea className="c-textarea" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="介绍这件作品的设计思路、卖点…" />
            </Field>
            <Field label="风格标签">
              <TagInput value={styleTags} onChange={setStyleTags} suggest={SUGGEST_TAGS} />
            </Field>

            {/* 打版素材 / 3D 素材选择 */}
            <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="flex-1" style={{ minWidth: 220 }}>
                <Field label={`打版素材（DXF/SVG）${patternIds.length ? `已选 ${patternIds.length}` : ''}`}>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />选择打版图</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                </Field>
                {chosenPattern.length > 0 && <MiniMatRow mats={chosenPattern} />}
              </div>
              <div className="flex-1" style={{ minWidth: 220 }}>
                <Field label={`3D 素材（OBJ/GLB）${modelIds.length ? `已选 ${modelIds.length}` : ''}`}>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />选择 3D 网格</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                </Field>
                {chosenModel.length > 0 && <MiniMatRow mats={chosenModel} />}
              </div>
            </div>

            {/* 封面选择 */}
            <Field label="作品封面" hint="选一张图片素材作为封面；发推文时不配图会自动引用它">
              <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setPick('cover')}>
                  <Icon name="image" size={13} />{cover ? '更换封面' : '从素材选择封面'}
                </button>
                <input className="c-input" style={{ width: 260 }} value={coverUrl} placeholder="或输入 /images/… 图片地址" onChange={(e) => setCoverUrl(e.target.value)} />
                {coverUrl.trim() && <button className="c-btn c-btn-soft c-btn-sm" onClick={() => { setCover(coverUrl.trim()); setCoverUrl(''); }}>应用</button>}
              </div>
              {cover && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <img src={imgSafe(cover)} alt="cover" onError={hideBadImg} style={{ width: 66, height: 82, objectFit: 'cover', borderRadius: 10 }} />
                  <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setCover('')}><Icon name="close" size={12} />移除</button>
                </div>
              )}
            </Field>

            <div className="row" style={{ gap: 10, marginTop: 6 }}>
              <button className="c-btn c-btn-primary c-btn-lg flex-1" disabled={submitting} onClick={create}>
                <Icon name="check" size={15} />{submitting ? '创建中…' : '创建作品'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ============ 右侧：已有作品列表 ============ */}
      <div className="flex-1" style={{ minWidth: 380 }}>
        <div className="c-card">
          <div className="c-card-hd">
            <span className="c-card-title">已有作品</span>
            <button className="c-btn c-btn-sm c-btn-outline" onClick={reload}><Icon name="refresh" size={12} />刷新</button>
          </div>
          {loading && <Loading compact />}
          {!loading && error && <CState danger icon="tshirt" title="作品加载失败" desc={error} />}
          {!loading && !error && !works.length && <CState icon="tshirt" title="还没有作品" desc="左侧组装第一个作品吧：选素材 → 起名 → 保存 → 去发推文" />}
          {!loading && works.map((w: Work) => (
            <div key={w.id} className="row" style={{ gap: 12, padding: '12px 2px', borderBottom: '1px solid #F0F1F4' }}>
              <img src={imgSafe(w.cover || w.mediaImages?.[0])} alt="" onError={hideBadImg} style={{ width: 62, height: 78, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#F1F2F5' }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 7 }}>
                  <b style={{ fontSize: 13.5 }} className="ellipsis">{w.title}</b>
                  <span className="c-badge c-badge-brand">{w.category}</span>
                </div>
                <div style={{ marginTop: 3, fontSize: 11.5 }}>
                  <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {w.patternMatIds?.length > 0 && <span className="row" style={{ gap: 3 }}><Icon name="pen-tool" size={11} color="#B4547A" />打版 ×{w.patternMatIds.length}</span>}
                    {w.modelMatIds?.length > 0 && <span className="row" style={{ gap: 3 }}><Icon name="layers" size={11} color="#3B82F6" />3D ×{w.modelMatIds.length}</span>}
                    {w.fabric && <span>面料：{w.fabric}</span>}
                  </span>
                </div>
                {(w.styleTags || []).length > 0 && (
                  <div className="c-chips" style={{ marginTop: 5 }}>
                    {w.styleTags.slice(0, 4).map((t) => <span key={t} className="c-pill">#{t}</span>)}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: '#A8AEB8', marginTop: 4 }}>{fmtDT(w.createdAt)}</div>
              </div>
              <button className="c-btn c-btn-soft c-btn-sm" onClick={() => navigate(`/creator/publish?workId=${w.id}`)}>
                <Icon name="send" size={12} />去发推文
              </button>
            </div>
          ))}
          {!loading && works.length > 0 && (
            <div className="c-hint" style={{ marginTop: 10, fontSize: 11.5 }}>演示环境暂未开放对已有作品的修改接口；如需调整请重新创建或调整所用素材后创建新作品。</div>
          )}
        </div>
      </div>

      {/* ============ 素材选择弹层 ============ */}
      {pick === 'pattern' && (
        <MaterialPickModal title="选择打版素材（DXF / SVG）" mats={patternMats} value={patternIds}
          onChange={(ids) => setPatternIds(ids)} onClose={() => setPick(null)} />
      )}
      {pick === 'model' && (
        <MaterialPickModal title="选择 3D 素材（OBJ / GLB）" mats={modelMats} value={modelIds}
          onChange={(ids) => setModelIds(ids)} onClose={() => setPick(null)} />
      )}
      {pick === 'cover' && (
        <Modal narrow onClose={() => setPick(null)} title="选择封面图片" icon="image">
          <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))' }}>
            {coverCandidates.map((m) => (
              <div key={m.id} className={`pick-cell ${cover === m.cover ? 'on' : ''}`} onClick={() => { setCover(m.cover || ''); setPick(null); }}>
                <div className="ph"><img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy" /></div>
                <span className="ck">{cover === m.cover ? <Icon name="check" size={12} /> : null}</span>
                <span className="cap">{m.title || m.fileName}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function MiniMatRow({ mats }: { mats: Material[] }) {
  const [open, setOpen] = React.useState<Material | null>(null);
  return (
    <>
      <div className="c-chips" style={{ marginTop: 4 }}>
        {mats.map((m) => (
          <button key={m.id} className="c-chip" style={{ cursor: 'pointer' }} onClick={() => setOpen(m)}>
            <MaterialBadge kind={m.kind} />
            <span className="ellipsis" style={{ maxWidth: 150 }}>{m.title || m.fileName}</span>
            <Icon name="eye" size={11} color="#8B919C" />
          </button>
        ))}
      </div>
      {open && <Modal onClose={() => setOpen(null)} title={open.title || open.fileName} icon="eye"><MatPreview m={open} height={360} /></Modal>}
    </>
  );
}
