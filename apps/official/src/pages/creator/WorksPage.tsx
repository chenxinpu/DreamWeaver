/* ============================================================================
 * /creator/works 作品 —— 与橱窗材料一致的结构：说明文案 + 「新建作品」入口；
 * 风格标签随品类联动（切换品类后给出该品类的推荐标签）；已有作品按品类分组
 * （tabs 设计同「我的橱窗材料」），每条支持 管理（编辑 / 删除）+ 去发推文。
 * 新建/编辑复用同一套表单（素材组装：打版图 + 3D 网格 + 封面）。
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
import { useAsync, CState, Field, TagInput, Modal, Confirm, MatPreview, MaterialPickModal, Loading, fmtDT } from './_shared';

/* 品类 → 推荐风格标签（风格标签与品类联动） */
const CATEGORY_TAGS: Record<string, string[]> = {
  连衣裙: ['法式', '碎花', '泡泡袖', '收腰', '缎面', '吊带', '蕾丝', '波点', '方领', '复古'],
  衬衫: ['通勤', '泡泡纱', '廓形', '方领', '极简', '印花', '娃娃领', '衬衫裙', '复古'],
  半裙: ['A字', '包臀', '碎花', '牛仔', '缎面', '百褶', '伞摆', '鱼尾', '通勤'],
  外套: ['羊毛', '双面呢', '西装', '工装', 'oversize', '针织开衫', '风衣', '皮衣', '极简'],
  裤装: ['阔腿', '直筒', '高腰', '工装', '喇叭', '休闲', '锥形', '拖地裤'],
  套装: ['针织', '西装', '通勤', '极简', '学院', '度假', '小香风', '运动'],
};
const CAT_TABS = ['all', ...PRODUCT_CATEGORIES] as const;

interface FormState {
  title: string;
  category: string;
  fabric: string;
  desc: string;
  styleTags: string[];
  cover: string;
  coverUrl: string;
  patternIds: number[];
  modelIds: number[];
}

const emptyForm: FormState = {
  title: '', category: '连衣裙', fabric: '', desc: '', styleTags: [],
  cover: '', coverUrl: '', patternIds: [], modelIds: [],
};

export default function WorksPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: mats, loading: ml } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const { data: list, loading, error, reload } = useAsync(() => api.works.mine(), []);
  const works = list?.list || [];
  const materialList = mats?.list || [];

  const [tab, setTab] = React.useState<(typeof CAT_TABS)[number]>('all');
  const [form, setForm] = React.useState<FormState | null>(null);   // 非空 = 正在新建/编辑
  const [editId, setEditId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [delTarget, setDelTarget] = React.useState<Work | null>(null);
  const [pick, setPick] = React.useState<'pattern' | 'model' | 'cover' | null>(null);

  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const coverCandidates = materialList.filter((m) => m.cover || ['png', 'jpg'].includes(m.kind));

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const openEdit = (w: Work) => {
    setEditId(w.id);
    setForm({
      title: w.title, category: w.category, fabric: w.fabric || '', desc: w.desc || '',
      styleTags: [...(w.styleTags || [])], cover: w.cover || '',
      coverUrl: '', patternIds: [...(w.patternMatIds || [])], modelIds: [...(w.modelMatIds || [])],
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const patch = (p: Partial<FormState>) => setForm((f) => (f ? { ...f, ...p } : f));

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) { toast('请填写作品标题'); return; }
    if (!form.patternIds.length && !form.modelIds.length) { toast('请至少选择 1 个打版或 3D 素材'); return; }
    const payload = {
      title: form.title.trim(),
      category: form.category,
      fabric: form.fabric,
      desc: form.desc,
      styleTags: form.styleTags,
      cover: form.cover,
      patternMatIds: form.patternIds,
      modelMatIds: form.modelIds,
      mediaImages: form.cover ? [form.cover] : [],
    };
    setSubmitting(true);
    try {
      const saved = editId
        ? await api.works.update(editId, payload)
        : await api.works.create(payload);
      toast(editId ? `作品「${saved.title}」已更新` : `作品「${saved.title}」已创建`, 'check');
      setForm(null);
      setEditId(null);
      reload();
    } catch (e) {
      toast((e as Error).message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const countOf = (c: string) => (c === 'all' ? works.length : works.filter((w) => w.category === c).length);
  const visible = works.filter((w) => tab === 'all' || w.category === tab);
  const selectedWork = editId ? works.find((w) => w.id === editId) : undefined;
  const chosenPattern = materialList.filter((m) => form?.patternIds.includes(m.id));
  const chosenModel = materialList.filter((m) => form?.modelIds.includes(m.id));

  return (
    <div>
      {/* 顶部：说明文案 + 新建按钮（同橱窗材料） */}
      <div className="c-card">
        <div className="row" style={{ gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, maxWidth: 760 }}>
            <div className="c-card-title" style={{ marginBottom: 6 }}>作品</div>
            <div className="c-hint">把素材库里的 <b>3D 结果文件</b> 与 <b>打版结果文件</b> 组装成一件「作品」：起名、选品类（推荐风格标签随品类联动）、写面料与介绍。作品是发推文与上橱窗的载体，可在下方按品类分组管理。</div>
          </div>
          {!form && <button className="c-btn c-btn-primary" onClick={openCreate}><Icon name="plus" size={15} />新建作品</button>}
        </div>
      </div>

      {/* 新建/编辑表单 */}
      {form && (
        <div className="c-card" style={{ marginTop: 12, border: '1.5px solid #E8B9CB' }}>
          <div className="c-card-hd">
            <span className="c-card-title">
              <Icon name="tshirt" size={15} color="var(--brand)" />
              {editId ? `编辑作品 #${editId}` : '新建作品'}
              {selectedWork && <span className="c-badge c-badge-gray">{selectedWork.title}</span>}
            </span>
            <button className="c-btn c-btn-outline c-btn-sm" onClick={() => { if (!submitting) { setForm(null); setEditId(null); } }}>
              <Icon name="close" size={13} />关闭
            </button>
          </div>
          {ml ? <Loading compact /> : (
            <>
              <div className="form-grid">
                <Field label="作品名称" required>
                  <input className="c-input" value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="例：法式碎花泡泡袖连衣裙" />
                </Field>
                <Field label="品类" required>
                  <select className="c-select" value={form.category} onChange={(e) => patch({ category: e.target.value })}>
                    {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="风格标签（随品类联动推荐）" hint={`当前品类「${form.category}」的常用风格：点击下方推荐可直接添加，也可手动输入（回车）`}>
                <TagInput value={form.styleTags} onChange={(styleTags) => patch({ styleTags })} suggest={CATEGORY_TAGS[form.category] || []} />
              </Field>

              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="面料">
                  <input className="c-input" value={form.fabric} onChange={(e) => patch({ fabric: e.target.value })} placeholder="例：高支棉 / 醋酸缎面" />
                </Field>
                <Field label="描述">
                  <input className="c-input" value={form.desc} onChange={(e) => patch({ desc: e.target.value })} placeholder="一句话介绍这件作品…" />
                </Field>
              </div>

              <div className="row" style={{ gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="flex-1" style={{ minWidth: 240 }}>
                  <Field label={`打版素材（DXF/SVG）${form.patternIds.length ? `×${form.patternIds.length}` : ''}`} required>
                    <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                      <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />选择打版图</span>
                      <Icon name="chevron-right" size={14} color="#C0C4CC" />
                    </button>
                  </Field>
                  {chosenPattern.length > 0 && <MiniMatRow mats={chosenPattern} />}
                </div>
                <div className="flex-1" style={{ minWidth: 240 }}>
                  <Field label={`3D 素材（OBJ/GLB）${form.modelIds.length ? `×${form.modelIds.length}` : ''}`} required>
                    <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                      <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />选择 3D 网格</span>
                      <Icon name="chevron-right" size={14} color="#C0C4CC" />
                    </button>
                  </Field>
                  {chosenModel.length > 0 && <MiniMatRow mats={chosenModel} />}
                </div>
              </div>

              <Field label="作品封面" hint="选一张图片素材作为封面；发推文时不配图会自动引用它">
                <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
                  <button className="c-btn c-btn-outline c-btn-sm" onClick={() => setPick('cover')}>
                    <Icon name="image" size={13} />{form.cover ? '更换封面' : '从素材选择封面'}
                  </button>
                  <input className="c-input" style={{ width: 240 }} value={form.coverUrl} placeholder="或输入 /images/… 图片地址" onChange={(e) => patch({ coverUrl: e.target.value })} />
                  {form.coverUrl.trim() && <button className="c-btn c-btn-soft c-btn-sm" onClick={() => { patch({ cover: form.coverUrl.trim(), coverUrl: '' }); }}>应用</button>}
                </div>
                {form.cover && (
                  <div className="row" style={{ gap: 8, marginTop: 8 }}>
                    <img src={imgSafe(form.cover)} alt="cover" onError={hideBadImg} style={{ width: 66, height: 82, objectFit: 'cover', borderRadius: 10 }} />
                    <button className="c-btn c-btn-sm c-btn-danger" onClick={() => patch({ cover: '' })}><Icon name="close" size={12} />移除</button>
                  </div>
                )}
              </Field>

              <div className="row" style={{ gap: 10, marginTop: 8 }}>
                <button className="c-btn c-btn-outline c-btn-lg" disabled={submitting} onClick={() => { setForm(null); setEditId(null); }}>
                  <Icon name="close" size={15} />取消
                </button>
                <button className="c-btn c-btn-primary c-btn-lg flex-1" disabled={submitting} onClick={save}>
                  <Icon name="check" size={15} />{submitting ? '保存中…' : editId ? '保存修改' : '创建作品'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* 我的作品：按品类分组 */}
      <div className="c-card" style={{ marginTop: 12 }}>
        <div className="c-card-hd">
          <span className="c-card-title">我的作品</span>
          <div className="c-tabs" style={{ maxWidth: '100%', overflowX: 'auto' }}>
            {CAT_TABS.map((c) => (
              <button key={c} className={`c-tab ${tab === c ? 'on' : ''}`} onClick={() => setTab(c)}>
                {c === 'all' ? '全部' : c}<span style={{ opacity: .6, fontSize: 11 }}>{countOf(c)}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && <Loading text="加载作品…" />}
        {!loading && error && <CState danger icon="tshirt" title="作品加载失败" desc={error} action={<button className="c-btn c-btn-outline" onClick={reload}>重试</button>} />}
        {!loading && !error && !works.length && (
          <CState icon="tshirt" title="还没有作品" desc="先导入素材（素材库），再点右上角「新建作品」组装你的第一件作品" />
        )}
        {!loading && !error && works.length > 0 && visible.length === 0 && (
          <CState icon="filter" title={`「${tab}」暂无作品`} desc="切换其他品类查看，或新建该品类作品" />
        )}

        {!loading && visible.map((w) => (
          <div key={w.id} className="row" style={{ gap: 12, padding: '13px 2px', borderBottom: '1px solid #F0F1F4', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <img src={imgSafe(w.cover || w.mediaImages?.[0])} alt="" onError={hideBadImg}
              style={{ width: 62, height: 80, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#F1F2F5' }} />
            <div className="flex-1" style={{ minWidth: 240 }}>
              <div className="row" style={{ gap: 7, flexWrap: 'wrap' }}>
                <b style={{ fontSize: 13.5 }} className="ellipsis">{w.title}</b>
                <span className="c-badge c-badge-brand">{w.category}</span>
                {w.fabric && <span className="c-pill">{w.fabric}</span>}
              </div>
              {w.desc && <div className="ellipsis" style={{ fontSize: 11.5, color: '#6B7180', marginTop: 4, maxWidth: 420 }}>{w.desc}</div>}
              <div style={{ marginTop: 5, fontSize: 11.5 }}>
                <span className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  {w.patternMatIds?.length > 0 && <span className="row" style={{ gap: 3 }}><Icon name="pen-tool" size={11} color="#B4547A" />打版 ×{w.patternMatIds.length}</span>}
                  {w.modelMatIds?.length > 0 && <span className="row" style={{ gap: 3 }}><Icon name="layers" size={11} color="#3B82F6" />3D ×{w.modelMatIds.length}</span>}
                </span>
              </div>
              {(w.styleTags || []).length > 0 && (
                <div className="c-chips" style={{ marginTop: 5 }}>
                  {w.styleTags.slice(0, 6).map((t) => <span key={t} className="c-pill">#{t}</span>)}
                </div>
              )}
              <div style={{ fontSize: 10.5, color: '#A8AEB8', marginTop: 4 }}>{fmtDT(w.createdAt)}</div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button className="c-btn c-btn-soft c-btn-sm" onClick={() => navigate(`/creator/publish?workId=${w.id}`)}>
                <Icon name="send" size={12} />去发推文
              </button>
              <button className="c-btn c-btn-outline c-btn-sm" onClick={() => openEdit(w)}><Icon name="edit" size={12} />编辑</button>
              <button className="c-btn c-btn-danger c-btn-sm" onClick={() => setDelTarget(w)}><Icon name="trash" size={12} />删除</button>
            </div>
          </div>
        ))}
      </div>

      {/* 素材选择弹层 */}
      {pick === 'pattern' && form && <MaterialPickModal title="选择打版素材（DXF / SVG）" mats={patternMats} value={form.patternIds} onChange={(ids) => patch({ patternIds: ids })} onClose={() => setPick(null)} />}
      {pick === 'model' && form && <MaterialPickModal title="选择 3D 素材（OBJ / GLB）" mats={modelMats} value={form.modelIds} onChange={(ids) => patch({ modelIds: ids })} onClose={() => setPick(null)} />}
      {pick === 'cover' && form && (
        <Modal narrow onClose={() => setPick(null)} title="选择封面图片" icon="image">
          <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(86px, 1fr))' }}>
            {coverCandidates.map((m) => (
              <div key={m.id} className={`pick-cell ${form.cover === m.cover ? 'on' : ''}`} onClick={() => { patch({ cover: m.cover || '' }); setPick(null); }}>
                <div className="ph"><img src={imgSafe(m.cover)} alt="" onError={hideBadImg} loading="lazy" /></div>
                <span className="ck">{form.cover === m.cover ? <Icon name="check" size={12} /> : null}</span>
                <span className="cap">{m.title || m.fileName}</span>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 删除确认 */}
      <Confirm open={!!delTarget} title="删除该作品？" danger
        body={delTarget ? <>「{delTarget.title}」删除后不可恢复。已被橱窗材料 / 商品 / 资源池引用的作品不允许删除（会给出提示）。</> : null}
        okText="确认删除"
        onOk={async () => {
          if (!delTarget) return;
          try {
            await api.works.remove(delTarget.id);
            toast('作品已删除', 'check');
            if (editId === delTarget.id) { setForm(null); setEditId(null); }
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
