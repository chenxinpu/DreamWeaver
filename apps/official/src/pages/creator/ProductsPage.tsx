/* ============================================================================
 * /creator/products 商品管理 —— 我的全部商品：状态/上下架/佣金率（逐条原因可折叠）/
 * 查看详情 / 编辑 AI 详情（非材料内容：intro/story/sections/manufacturer）+ 实时预览
 * ==========================================================================*/
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import type { CommissionRate, Product } from '../../api/types';
import { fmtCount, fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';
import { useAsync, CState, Modal, ProductBadge, Loading, fmtDT } from './_shared';

type Ed = { intro: string; story: string; manufacturer: string; sections: { title: string; body: string }[] };

export default function ProductsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.products.myAll({ pageSize: 200 }), []);
  const products = data?.list || [];
  const counts = data?.counts || {};

  const [rateOpen, setRateOpen] = React.useState<Record<number, boolean>>({});
  const [rates, setRates] = React.useState<Record<number, CommissionRate>>({});
  const [shelfing, setShelfing] = React.useState<number | null>(null);
  const [editing, setEditing] = React.useState<Product | null>(null);

  const loadRate = async (p: Product) => {
    if (rates[p.id]) return;
    try {
      const r = await api.creator.commissionRate(p.id);
      setRates((m) => ({ ...m, [p.id]: r }));
    } catch { /* ignore */ }
  };
  const toggleRate = (p: Product) => {
    const next = !rateOpen[p.id];
    setRateOpen((m) => ({ ...m, [p.id]: next }));
    if (next) loadRate(p);
  };

  const toggleShelf = async (p: Product) => {
    setShelfing(p.id);
    try {
      const on = p.status === 'onSale';
      await api.products.shelf(p.id, !on);
      toast(on ? '已下架（可在列表重新上架）' : '已上架商城 🎉', 'check');
      reload();
    } catch (e) {
      toast((e as Error).message || '操作失败');
    } finally {
      setShelfing(null);
    }
  };

  const orderStats: Record<string, Product[]> = { all: products };
  const tabCards = [
    { key: 'all', label: `全部 ${products.length}` },
    { key: 'onSale', label: `在售 ${counts.onSale ?? 0}` },
    { key: 'offShelf', label: `已下架 ${counts.offShelf ?? 0}` },
    { key: 'draft', label: `未上架 ${counts.draft ?? 0}` },
  ];
  const [tab, setTab] = React.useState('all');
  const visible = orderStats[tab] || [];

  return (
    <div>
      <div className="c-card">
        <div className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div className="c-card-title" style={{ marginBottom: 6 }}>商品管理</div>
            <div className="c-hint">
              橱窗材料审核通过后由 AI 自动生成商品详情页并上架。这里可<b>修改非材料文案</b>（intro/故事/章节/生产商）；
              如需换图、换版、改规格/价格等<b>材料变更，请走「橱窗材料」重新提交审核</b>。
            </div>
          </div>
          <div className="c-notice brand" style={{ maxWidth: 380, fontSize: 11.5, alignSelf: 'center' }}>
            <Icon name="bell" size={14} />
            <span>材料相关修改请走橱窗；商品佣金 2%-10%，受转化/退货率与资源池重复度影响。</span>
          </div>
        </div>
        <div className="c-tabs" style={{ marginTop: 12 }}>
          {tabCards.map((t) => (
            <button key={t.key} className={`c-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {loading && <div className="c-card" style={{ marginTop: 12 }}><Loading /></div>}
      {!loading && error && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <CState danger icon="bag" title="商品加载失败" desc={error}
            action={<button className="c-btn c-btn-outline" onClick={reload}><Icon name="refresh" size={13} />重试</button>} />
        </div>
      )}
      {!loading && !error && visible.length === 0 && (
        <div className="c-card" style={{ marginTop: 12 }}>
          <CState icon="bag" title={tab === 'all' ? '还没有商品' : '该状态下暂无商品'}
            desc={tab === 'all' ? '去「资源池」或「橱窗材料」提交材料，审核通过后 AI 会自动生成商品上架' : '可在橱窗页通过审核后再回来查看'} />
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gap: 12, marginTop: 12 }}>
        {visible.map((p) => (
          <div className="c-card" key={p.id} style={{ padding: 14 }}>
            <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
              <img src={imgSafe(p.cover || p.images?.[0])} alt="" onError={hideBadImg} onClick={() => navigate(`/mall/product/${p.id}`)}
                style={{ width: 96, height: 124, objectFit: 'cover', borderRadius: 12, cursor: 'pointer', flexShrink: 0, background: '#F1F2F5' }} />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 14 }} className="ellipsis">#{p.id} {p.title}</b>
                  <ProductBadge status={p.status} />
                  {p.windowStatus === 'approved' ? <span className="c-badge c-badge-gray">材料已审核</span>
                    : p.windowStatus === 'rejected' ? <span className="c-badge c-badge-red">橱窗被拒</span>
                    : p.windowStatus === 'submitted' ? <span className="c-badge c-badge-blue">橱窗审核中</span>
                    : null}
                </div>
                <div className="row" style={{ gap: 8, marginTop: 7, flexWrap: 'wrap', fontSize: 12.5 }}>
                  <span style={{ fontWeight: 800, color: '#E5484D', fontSize: 15 }}>¥{fmtMoney(p.price)}</span>
                  {p.baseFee > 0 && <span className="c-pill">定制基础费 ¥{fmtMoney(p.baseFee)}</span>}
                  {(p.styleTags || []).slice(0, 3).map((t) => <span key={t} className="c-pill">#{t}</span>)}
                </div>
                <div className="row" style={{ gap: 14, marginTop: 8, fontSize: 12 }}>
                  <span className="row" style={{ gap: 4 }}><Icon name="eye" size={12} color="#8B919C" />浏览 {fmtCount(p.views)}</span>
                  <span className="row" style={{ gap: 4 }}><Icon name="bag" size={12} color="#8B919C" />销量 {fmtCount(p.sales)}</span>
                  <button className="row" style={{ gap: 4 }} onClick={() => toggleRate(p)}>
                    <Icon name="chart" size={12} color="var(--brand)" />
                    佣金率 {rates[p.id]?.rate ?? '…'}% <Icon name={rateOpen[p.id] ? 'chevron-down' : 'chevron-right'} size={12} color="#9AA0AA" />
                  </button>
                </div>
                <div style={{ fontSize: 10.5, color: '#A8AEB8', marginTop: 5 }}>上架 {fmtDT(p.createdAt)} · {p.creator?.nickname || ''}</div>
              </div>
            </div>

            {/* 佣金率逐条原因（折叠） */}
            {rateOpen[p.id] && (
              <div style={{ marginTop: 10, background: '#F7F8FA', borderRadius: 10, padding: '10px 12px', fontSize: 11.8 }}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                  <b>佣金率 = {rates[p.id]?.rate ?? '—'}%（区间 2%-10%）</b>
                  <span className="c-pill">基础 6%</span>
                </div>
                {(rates[p.id]?.breaks || []).map((b, i) => (
                  <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{b.name}</span>
                    <b style={{ color: b.delta >= 6 ? '#1F2329' : b.delta > 0 ? '#237A54' : '#B03A3F' }}>{b.delta > 0 ? `+${b.delta}` : b.delta}%</b>
                  </div>
                ))}
                {(rates[p.id]?.reasons || []).map((r, i) => <div key={`r${i}`} style={{ color: '#8B919C', padding: '2px 0' }}>· {r}</div>)}
                {!rates[p.id] && <div className="c-hint">加载中…</div>}
              </div>
            )}

            <div className="row" style={{ gap: 6, marginTop: 11, flexWrap: 'wrap' }}>
              <button className="c-btn c-btn-sm c-btn-soft" onClick={() => navigate(`/mall/product/${p.id}`)}><Icon name="eye" size={13} />查看详情</button>
              <button className="c-btn c-btn-sm c-btn-outline" onClick={() => setEditing(p)}><Icon name="edit" size={13} />编辑详情（非材料）</button>
              <button className={`c-btn c-btn-sm ${p.status === 'onSale' ? 'c-btn-danger' : 'c-btn-success'}`} disabled={shelfing === p.id} onClick={() => toggleShelf(p)}>
                {p.status === 'onSale' ? <><Icon name="minus" size={13} />下架</> : <><Icon name="check" size={13} />上架</>}
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && <EditDetailModal product={editing} onClose={() => setEditing(null)} onSaved={() => { reload(); }} />}
    </div>
  );
}

/* ------------------------- 编辑 AI 详情（非材料） ------------------------- */
function EditDetailModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: (p: Product) => void }) {
  const toast = useToast();
  const d = product.aiDetail || {};
  const base: Ed = {
    intro: product.detailEdits?.intro ?? d.intro ?? '',
    story: product.detailEdits?.story ?? d.story ?? '',
    manufacturer: product.detailEdits?.manufacturer ?? d.manufacturer ?? '',
    sections: (product.detailEdits?.sections?.length ? product.detailEdits.sections : d.sections || []).map((s) => ({ title: s.title, body: s.body })),
  };
  const [ed, setEd] = React.useState<Ed>(base);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState('');

  const set = (patch: Partial<Ed>) => setEd((e) => ({ ...e, ...patch }));
  const patchSection = (i: number, patch: Partial<{ title: string; body: string }>) =>
    setEd((e) => ({ ...e, sections: e.sections.map((s, si) => (si === i ? { ...s, ...patch } : s)) }));

  const save = async () => {
    setSaving(true);
    setErr('');
    try {
      const p = await api.products.editDetail(product.id, {
        intro: ed.intro, story: ed.story, manufacturer: ed.manufacturer,
        sections: ed.sections.map((s) => ({ title: s.title, body: s.body })),
      });
      toast('商品详情已更新（材料未动）', 'check');
      onSaved(p);
      onClose();
    } catch (e) {
      setErr((e as Error).message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal wide onClose={onClose} title={`编辑商品详情 #${product.id} · ${product.title}`} icon="edit"
      foot={<>
        <span className="flex-1 c-hint" style={{ fontSize: 11.5 }}>材料相关字段（图片/面料/尺码/价格）不在此编辑，请走橱窗重新审核</span>
        {err && <span style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</span>}
        <button className="c-btn c-btn-outline" onClick={onClose}>取消</button>
        <button className="c-btn c-btn-primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存修改'}</button>
      </>}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 18 }}>
        {/* 编辑区 */}
        <div>
          <div className="c-field-label">商品介绍 intro</div>
          <textarea className="c-textarea" rows={3} value={ed.intro} onChange={(e) => set({ intro: e.target.value })} />
          <div className="c-field-label" style={{ marginTop: 12 }}>设计故事 story（从设计到生产）</div>
          <textarea className="c-textarea" rows={5} value={ed.story} onChange={(e) => set({ story: e.target.value })} />
          <div className="c-field-label" style={{ marginTop: 12 }}>生产商 manufacturer</div>
          <input className="c-input" value={ed.manufacturer} onChange={(e) => set({ manufacturer: e.target.value })} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, marginBottom: 6 }}>
            <div className="c-field-label" style={{ margin: 0 }}>详情章节 sections（标题 + 正文）</div>
            <button className="c-btn c-btn-sm c-btn-outline" onClick={() => set({ sections: [...ed.sections, { title: '', body: '' }] })}>
              <Icon name="plus" size={12} />新增章节
            </button>
          </div>
          {ed.sections.map((s, i) => (
            <div key={i} style={{ border: '1px solid var(--creator-line)', borderRadius: 11, padding: 10, marginBottom: 8 }}>
              <div className="row" style={{ gap: 6 }}>
                <input className="c-input flex-1" placeholder="章节标题（如：面料工艺）" value={s.title} onChange={(e) => patchSection(i, { title: e.target.value })} />
                <button className="c-btn c-btn-sm c-btn-danger" onClick={() => setEd((e) => ({ ...e, sections: e.sections.filter((_, si) => si !== i) }))}><Icon name="trash" size={12} /></button>
              </div>
              <textarea className="c-textarea" rows={3} style={{ marginTop: 6 }} placeholder="章节内容" value={s.body} onChange={(e) => patchSection(i, { body: e.target.value })} />
            </div>
          ))}
        </div>

        {/* 实时预览 */}
        <div style={{ border: '1px dashed #DFE0E6', borderRadius: 12, background: '#FAFAFC', padding: 12 }}>
          <div className="row" style={{ gap: 6, marginBottom: 10 }}>
            <Icon name="eye" size={14} color="var(--brand)" />
            <b style={{ fontSize: 12.5 }}>详情页实时预览</b>
            <span className="flex-1" />
            <span className="c-pill">模拟商城展示</span>
          </div>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--creator-line)' }}>
            <div style={{ position: 'relative' }}>
              <img src={imgSafe(product.cover || product.images?.[0])} alt="" onError={hideBadImg} style={{ width: '100%', height: 200, objectFit: 'cover' }} />
              <div style={{ position: 'absolute', left: 8, bottom: 8, background: 'rgba(255,255,255,.92)', borderRadius: 10, padding: '4px 9px' }}>
                <b style={{ color: '#E5484D' }}>¥{fmtMoney(product.price)}</b>
                {product.baseFee > 0 && <span style={{ fontSize: 10, marginLeft: 4, color: '#8B919C' }}>定制起</span>}
              </div>
            </div>
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{product.title}</div>
              <div style={{ fontSize: 11.5, color: '#6B7180', marginTop: 6, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{ed.intro || '（暂无介绍）'}</div>
              <div style={{ fontSize: 11, color: '#9AA0AA', marginTop: 8 }}><b style={{ color: '#6B7180' }}>设计故事</b>　{ed.story ? ed.story.slice(0, 70) + '…' : '（无）'}</div>
              {(ed.sections || []).filter((s) => s.title).slice(0, 3).map((s, i) => (
                <div key={i} style={{ marginTop: 7, fontSize: 11, color: '#6B7180' }}>
                  <b style={{ color: '#43484F' }}>{s.title}</b>　{s.body.slice(0, 50)}{s.body.length > 50 ? '…' : ''}
                </div>
              ))}
              <div style={{ fontSize: 10.5, color: '#B7BCC6', marginTop: 8 }}>生产商：{ed.manufacturer || product.aiDetail?.manufacturer || '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
