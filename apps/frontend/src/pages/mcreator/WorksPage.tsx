/* ============================================================================
 * /c/works 创作者中心 · 作品（移动版）
 * 顶部说明 + 新建按钮；风格标签随品类联动（复制桌面 CATEGORY_TAGS 映射）；
 * 我的作品按品类横向 tabs（全部 + 各品类带数量），行卡 + 去发布/编辑/删除；
 * 新建/编辑为整页表单：名称/品类/面料/描述/风格标签/打版素材多选/3D 素材多选/封面
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { Work } from '../../api/types';
import { PRODUCT_CATEGORIES } from '../../api/types';
import { hideBadImg, imgSafe } from '../../components/shared/utils';
import { MaterialBadge } from '../../components/shared/MaterialBadge';
import { useAsync, Modal, Confirm, Field, TagInput, MaterialPickModal, fmtDT, Loading } from './bits';
import { MEmpty, MCardHd } from './bits';

/* 品类 → 推荐风格标签（与桌面一致，风格标签与品类联动） */
const CATEGORY_TAGS: Record<string, string[]> = {
  连衣裙: ['法式', '碎花', '泡泡袖', '收腰', '缎面', '吊带', '蕾丝', '波点', '方领', '复古'],
  衬衫: ['通勤', '泡泡纱', '廓形', '方领', '极简', '印花', '娃娃领', '衬衫裙', '复古'],
  半裙: ['A字', '包臀', '碎花', '牛仔', '缎面', '百褶', '伞摆', '鱼尾', '通勤'],
  外套: ['羊毛', '双面呢', '西装', '工装', 'oversize', '针织开衫', '风衣', '皮衣', '极简'],
  裤装: ['阔腿', '直筒', '高腰', '工装', '喇叭', '休闲', '锥形', '拖地裤'],
  套装: ['针织', '西装', '通勤', '极简', '学院', '度假', '小香风', '运动'],
};

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

export default function MWorksPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: mats, loading: ml } = useAsync(() => api.materials.list({ mine: true, pageSize: 200 }), []);
  const { data: list, loading, error, reload } = useAsync(() => api.works.mine(), []);
  const works = list?.list || [];
  const materialList = mats?.list || [];

  const [tab, setTab] = React.useState('all');
  const [form, setForm] = React.useState<FormState | null>(null);
  const [editId, setEditId] = React.useState<number | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [delTarget, setDelTarget] = React.useState<Work | null>(null);
  const [pick, setPick] = React.useState<'pattern' | 'model' | 'cover' | null>(null);

  const patternMats = materialList.filter((m) => ['dxf', 'svg'].includes(m.kind));
  const modelMats = materialList.filter((m) => ['obj', 'glb'].includes(m.kind));
  const coverCandidates = materialList.filter((m) => m.cover || ['png', 'jpg'].includes(m.kind));

  const openCreate = () => { setEditId(null); setForm({ ...emptyForm }); };
  const openEdit = (w: Work) => {
    setEditId(w.id);
    setForm({
      title: w.title, category: w.category || '连衣裙', fabric: w.fabric || '', desc: w.desc || '',
      styleTags: [...(w.styleTags || [])], cover: w.cover || '', coverUrl: '',
      patternIds: [...(w.patternMatIds || [])], modelIds: [...(w.modelMatIds || [])],
    });
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
      const saved = editId ? await api.works.update(editId, payload) : await api.works.create(payload);
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
  const chosenPattern = materialList.filter((m) => form?.patternIds.includes(m.id));
  const chosenModel = materialList.filter((m) => form?.modelIds.includes(m.id));
  const selCover = coverCandidates.find((m) => m.cover === form?.cover);

  return (
    <div>
      {/* 顶部说明 + 新建 */}
      <div className="mc-card">
        <div className="row" style={{ gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mc-hd" style={{ marginBottom: 4 }}><div className="mc-hd-title">作品</div></div>
            <div className="mc-sub">把素材库里的 <b>3D 结果文件</b> 与 <b>打版结果文件</b> 组装成一件「作品」：起名、选品类（风格标签随品类联动推荐）、写面料与介绍。作品是发推文与上橱窗的载体，可点下方作品「去发推文」。</div>
          </div>
          {!form && (
            <button className="c-btn c-btn-primary" style={{ height: 38, borderRadius: 12 }} onClick={openCreate}>
              <Icon name="plus" size={15} />新建作品
            </button>
          )}
        </div>
      </div>

      {/* ===== 新建/编辑表单（整页卡片） ===== */}
      {form && (
        <div className="mc-card" style={{ marginTop: 10, border: '1.5px solid #E8B9CB' }}>
          <MCardHd icon="tshirt" title={editId ? `编辑作品 #${editId}` : '新建作品'}
            right={<button className="c-btn c-btn-sm c-btn-outline" onClick={() => { if (!submitting) { setForm(null); setEditId(null); } }}><Icon name="close" size={13} />关闭</button>} />
          {ml ? <Loading compact /> : (
            <>
              <div className="mc-form">
                <Field label="作品名称" required>
                  <input className="c-input" value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="例：法式碎花泡泡袖连衣裙" />
                </Field>
                <Field label="品类" required>
                  <select className="c-select" value={form.category} onChange={(e) => patch({ category: e.target.value })}>
                    {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={`风格标签（当前品类「${form.category}」推荐）`} hint="点击下方推荐标签可直接添加，也可手动输入（回车）">
                  <TagInput value={form.styleTags} onChange={(styleTags) => patch({ styleTags })} suggest={CATEGORY_TAGS[form.category] || []} />
                </Field>
                <Field label="面料">
                  <input className="c-input" value={form.fabric} onChange={(e) => patch({ fabric: e.target.value })} placeholder="例：高支棉 / 醋酸缎面" />
                </Field>
                <Field label="描述">
                  <input className="c-input" value={form.desc} onChange={(e) => patch({ desc: e.target.value })} placeholder="一句话介绍这件作品…" />
                </Field>

                {/* 打版素材 */}
                <Field label={`打版素材（DXF/SVG）${form.patternIds.length ? `×${form.patternIds.length}` : ''}`} required>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('pattern')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="pen-tool" size={14} color="#B4547A" />选择打版图</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                  {chosenPattern.length > 0 && (
                    <div className="c-chips" style={{ marginTop: 6 }}>
                      {chosenPattern.map((m) => <span key={m.id} className="c-chip"><MaterialBadge kind={m.kind} /><span className="ellipsis" style={{ maxWidth: 130 }}>{m.title || m.fileName}</span></span>)}
                    </div>
                  )}
                </Field>
                {/* 3D 素材 */}
                <Field label={`3D 素材（OBJ/GLB）${form.modelIds.length ? `×${form.modelIds.length}` : ''}`} required>
                  <button className="c-btn c-btn-outline" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPick('model')}>
                    <span className="row" style={{ gap: 6 }}><Icon name="layers" size={14} color="#3B82F6" />选择 3D 网格</span>
                    <Icon name="chevron-right" size={14} color="#C0C4CC" />
                  </button>
                  {chosenModel.length > 0 && (
                    <div className="c-chips" style={{ marginTop: 6 }}>
                      {chosenModel.map((m) => <span key={m.id} className="c-chip"><MaterialBadge kind={m.kind} /><span className="ellipsis" style={{ maxWidth: 130 }}>{m.title || m.fileName}</span></span>)}
                    </div>
                  )}
                </Field>
                {/* 封面 */}
                <Field label="作品封面" hint="选一张图片素材作为封面；发推文不配图时自动引用它">
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setPick('cover')}>
                      <Icon name="image" size={13} />{form.cover ? '更换封面' : '从素材选封面'}
                    </button>
                    <input className="c-input" style={{ flex: 1, minWidth: 150 }} value={form.coverUrl} placeholder="或输入 /images/… 图片地址"
                      onChange={(e) => patch({ coverUrl: e.target.value })} />
                    {form.coverUrl.trim() && (
                      <button className="c-btn c-btn-sm c-btn-soft" onClick={() => { patch({ cover: form.coverUrl.trim(), coverUrl: '' }); }}>应用</button>
                    )}
                  </div>
                  {form.cover && (
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <img src={imgSafe(form.cover)} alt="" onError={hideBadImg} style={{ width: 60, height: 74, objectFit: 'cover', borderRadius: 10 }} />
                      <button className="c-btn c-btn-sm c-btn-danger" onClick={() => patch({ cover: '' })}><Icon name="close" size={12} />移除</button>
                      {selCover && <span className="c-pill">{selCover.title || selCover.fileName}</span>}
                    </div>
                  )}
                </Field>
              </div>

              <div className="row" style={{ gap: 10, marginTop: 6 }}>
                <button className="c-btn c-btn-outline" style={{ flex: 1, height: 42 }} disabled={submitting} onClick={() => { setForm(null); setEditId(null); }}>
                  <Icon name="close" size={15} />取消
                </button>
                <button className="c-btn c-btn-primary" style={{ flex: 1.5, height: 42 }} disabled={submitting} onClick={save}>
                  <Icon name="check" size={15} />{submitting ? '保存中…' : editId ? '保存修改' : '创建作品'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== 我的作品列表 ===== */}
      {!form && (
        <div className="mc-card" style={{ marginTop: 10 }}>
          <div className="mc-hd" style={{ flexWrap: 'wrap', marginBottom: 10 }}>
            <MCardHd icon="tshirt" title="我的作品" />
          </div>
          <div className="mc-tabs" style={{ marginBottom: 4 }}>
            {(['all', ...PRODUCT_CATEGORIES] as string[]).map((c) => (
              <button key={c} className={`mc-tab ${tab === c ? 'on' : ''}`} onClick={() => setTab(c)}>
                {c === 'all' ? '全部' : c}<span className="n">{countOf(c)}</span>
              </button>
            ))}
          </div>

          {loading && <Loading text="加载作品…" />}
          {!loading && error && (
            <MEmpty icon="tshirt" title="作品加载失败" desc={error}
              action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重试</button>} />
          )}
          {!loading && !error && !works.length && (
            <MEmpty icon="tshirt" title="还没有作品" desc="先导入素材（素材库），再点上方「新建作品」组装你的第一件作品"
              action={<button className="c-btn c-btn-primary" onClick={openCreate}><Icon name="plus" size={14} />新建作品</button>} />
          )}
          {!loading && !error && works.length > 0 && visible.length === 0 && (
            <MEmpty icon="filter" title={`「${tab === 'all' ? '全部' : tab}」暂无作品`} desc="切换其他品类查看，或新建该品类作品" />
          )}

          {!loading && visible.map((w) => (
            <div key={w.id} className="mc-row">
              <img src={imgSafe(w.cover || w.mediaImages?.[0])} alt="" onError={hideBadImg}
                style={{ width: 62, height: 78, objectFit: 'cover', borderRadius: 10, flexShrink: 0, background: '#F1F2F5' }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13.5 }} className="ellipsis">{w.title}</b>
                  <span className="c-badge c-badge-brand">{w.category}</span>
                  {w.fabric && <span className="c-pill">{w.fabric}</span>}
                </div>
                {w.desc && <div className="ellipsis-2" style={{ fontSize: 11.5, color: '#6B7180', marginTop: 3, lineHeight: 1.55 }}>{w.desc}</div>}
                <div className="row" style={{ gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  {w.patternMatIds?.length > 0 && <span className="mc-tagline"><Icon name="pen-tool" size={11} color="#B4547A" />打版 ×{w.patternMatIds.length}</span>}
                  {w.modelMatIds?.length > 0 && <span className="mc-tagline"><Icon name="layers" size={11} color="#3B82F6" />3D ×{w.modelMatIds.length}</span>}
                  <span className="mc-tagline">{fmtDT(w.createdAt)}</span>
                </div>
                {(w.styleTags || []).length > 0 && (
                  <div className="c-chips" style={{ marginTop: 5 }}>
                    {w.styleTags.slice(0, 6).map((t) => <span key={t} className="c-pill">#{t}</span>)}
                  </div>
                )}
                <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate(`/c/publish?workId=${w.id}`)}>
                    <Icon name="send" size={12} />去发推文
                  </button>
                  <button className="c-btn c-btn-sm c-btn-outline" onClick={() => openEdit(w)}><Icon name="edit" size={12} />编辑</button>
                  <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setDelTarget(w)}><Icon name="trash" size={12} />删除</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== 素材多选弹层 ===== */}
      {pick === 'pattern' && form && (
        <MaterialPickModal title="选择打版素材（DXF / SVG）" mats={patternMats} value={form.patternIds}
          onChange={(ids) => patch({ patternIds: ids })} onClose={() => setPick(null)} preview={false} />
      )}
      {pick === 'model' && form && (
        <MaterialPickModal title="选择 3D 素材（OBJ / GLB）" mats={modelMats} value={form.modelIds}
          onChange={(ids) => patch({ modelIds: ids })} onClose={() => setPick(null)} preview={false} />
      )}
      {pick === 'cover' && form && (
        <Modal onClose={() => setPick(null)} title="选择封面图片" icon="image">
          <div className="mc-pick-grid">
            {coverCandidates.map((m) => {
              const src = m.cover || '';
              const on = !!src && form.cover === src;
              return (
                <div key={m.id} className={`mc-pick-cell ${on ? 'on' : ''}`} onClick={() => { if (src) { patch({ cover: src }); setPick(null); } }}>
                  <div className="ph">{src ? <img src={imgSafe(src)} alt="" onError={hideBadImg} loading="lazy" /> : <Icon name="image" size={18} color="#B7BCC6" />}</div>
                  {on && <span className="ck"><Icon name="check" size={11} /></span>}
                </div>
              );
            })}
          </div>
          {!coverCandidates.length && <div className="mc-empty">暂无图片素材（png/jpg），可去素材库导入</div>}
        </Modal>
      )}

      {/* ===== 删除确认 ===== */}
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
