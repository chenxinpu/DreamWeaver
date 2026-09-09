/* ============================================================================
 * /mall/product/:id 商品详情
 * 轮播 / 设计材料(3D·打版弹层) / AI 详情(设计到生产) / 规格表(国际码换算)
 * / 创作人 / 定制说明 / 收藏 / 底部操作(加购·立即购买·私人定制)
 * 进入时调用 /api/products/:id/view 计数
 * ==========================================================================*/
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Avatar, Tag } from '../../components/ui';
import { Sheet, useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { Product } from '../../api/types';
import { Loading, ErrorBox, fmtCount, fmtMoney, hideBadImg, imgSafe } from '../../components/shared/utils';
import MaterialViewer from '../../components/shared/MaterialViewer';
import { SizeChartTable } from './parts';
import { useCart, toggleCollection, isCollected } from '../../utils/v2';

export default function MallProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, hasToken } = useMe();
  const cart = useCart();

  const [p, setP] = React.useState<Product | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [slide, setSlide] = React.useState(0);
  const slideRef = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState<Record<number, boolean>>({});
  const [sizeOpen, setSizeOpen] = React.useState(false);
  const [size, setSize] = React.useState('');
  const [matViewer, setMatViewer] = React.useState<'3d' | 'pattern' | null>(null);
  const [collected, setCollected] = React.useState(false);
  const [buyMode, setBuyMode] = React.useState<'cart' | 'buy' | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true); setError('');
    try {
      const prod = await api.products.get(id || '0');
      setP(prod);
      setSize(prod?.aiDetail?.sizeChart?.[0]?.size || (prod?.aiDetail?.sizeChart?.length ? prod.aiDetail.sizeChart[0].size : '') || '均码');
      setCollected(isCollected('product', prod.id));
      api.products.view(prod.id).catch(() => {});
    } catch (e) {
      setError((e as Error).message || '商品加载失败');
    } finally { setLoading(false); }
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  const needLogin = () => {
    if (!user && !hasToken) { toast('请先登录后再操作'); navigate('/login', { state: { from: location.pathname } }); return true; }
    return false;
  };

  const toggleFav = () => {
    if (!p) return;
    const res = toggleCollection({ type: 'product', id: p.id, title: p.title, cover: p.cover || p.images?.[0] || '', price: p.price });
    setCollected(res.on);
    toast(res.on ? '已收藏，可在“我的→收藏夹”查看' : '已取消收藏', res.on ? 'star' : undefined);
  };

  const openSize = (mode: 'cart' | 'buy') => {
    if (!p) return;
    if (needLogin()) return;
    setBuyMode(mode);
    setSizeOpen(true);
  };

  const confirmSize = () => {
    if (!p) return;
    setSizeOpen(false);
    if (buyMode === 'cart') {
      cart.add({ productId: p.id, title: p.title, cover: p.cover || p.images?.[0] || '', category: p.category, price: p.price, baseFee: p.baseFee, creatorId: p.creatorId, creatorName: p.creator?.nickname, size, isCustom: false });
      toast('已加入购物车', 'check');
    } else {
      // 立即购买：写入本地 direct 商品后进入结算
      try {
        localStorage.setItem('zm_direct_buy', JSON.stringify({
          productId: p.id, title: p.title, cover: p.cover || p.images?.[0] || '', price: p.price, baseFee: p.baseFee, size, at: Date.now(),
        }));
      } catch { /* ignore */ }
      navigate(`/mall/checkout?direct=1&size=${encodeURIComponent(size || '')}`);
    }
  };

  if (loading) {
    return <div className="page no-tab"><NavBack title="商品详情" /><Loading text="加载商品中…" /></div>;
  }
  if (error || !p) {
    return (
      <div className="page no-tab page-bleed">
        <NavBack title="商品详情" />
        <div className="state-box"><ErrorBox msg={error || '商品不存在或已下架'} onRetry={load} /></div>
      </div>
    );
  }

  const imgs = [...new Set([p.cover, ...(p.images || [])].filter(Boolean))];
  const detail = p.aiDetail || { intro: '', story: '', sections: [], sizeChart: [], partsFabric: [], manufacturer: '', prodDays: 0, baseFeeNote: '' };
  const sizes = (detail.sizeChart || []).map((r) => r.size);

  return (
    <div className="mall-page no-tab" style={{ paddingBottom: 'calc(var(--safe-bottom) + 92px)', background: '#fff' }}>
      {/* 顶部透明返回条 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, display: 'flex', justifyContent: 'space-between', padding: '10px 12px' }}>
        <NavCircle onClick={() => navigate(-1)}><Icon name="arrow-left" size={18} /></NavCircle>
        <NavCircle onClick={() => navigate('/mall/home')}><Icon name="close" size={17} /></NavCircle>
      </div>

      {/* 图片轮播 */}
      <div style={{ position: 'relative' }}>
        <div
          ref={slideRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setSlide(Math.round(el.scrollLeft / el.clientWidth));
          }}
          style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {imgs.map((src) => (
            <div key={src} className="img-ph" style={{ width: '100%', flex: '0 0 100%', scrollSnapAlign: 'start', aspectRatio: '1/1.05', position: 'relative' }}>
              <img src={imgSafe(src)} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={hideBadImg} loading="lazy" />
            </div>
          ))}
        </div>
        {imgs.length > 1 && (
          <>
            <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 5 }}>
              {imgs.map((_, i) => <span key={i} className={`carousel-dot ${slide === i ? 'on' : ''}`} />)}
            </div>
            <span style={{ position: 'absolute', right: 12, bottom: 10, background: 'rgba(0,0,0,.45)', color: '#fff', fontSize: 10.5, borderRadius: 99, padding: '2px 8px' }}>{slide + 1}/{imgs.length}</span>
          </>
        )}
      </div>

      <div style={{ padding: '0 14px' }}>
        {/* 标题 + 价格区 */}
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-deep)', padding: '2px 9px', background: 'var(--brand-soft)', borderRadius: 6 }}>自营工厂直发</span>
          <Tag variant="gold" icon="sparkle">{p.baseFee > 0 ? '支持私人定制' : '现货直购'}</Tag>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <div>
            <span style={{ color: '#FF2E4D', fontSize: 12, fontWeight: 800 }}>¥</span>
            <span style={{ color: '#FF2E4D', fontSize: 26, fontWeight: 800 }}>{fmtMoney(p.price)}</span>
            {p.baseFee > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 6 }}>定制需另加基础费用 ¥{fmtMoney(p.baseFee)}</span>}
          </div>
          <button onClick={toggleFav} className="row" style={{ gap: 3, color: collected ? 'var(--brand)' : 'var(--text-3)', fontSize: 11.5, fontWeight: 600, flexDirection: 'column', padding: 2 }}>
            <Icon name={collected ? 'star-filled' : 'star'} size={19} color={collected ? 'var(--brand)' : undefined} />
            收藏
          </button>
        </div>
        <h1 style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.45, marginTop: 6 }}>{p.title}</h1>
        {p.styleTags?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {p.styleTags.map((t) => <span key={t} style={{ background: '#F5F6F7', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-2)' }}>{t}</span>)}
          </div>
        )}
        <div className="row" style={{ gap: 14, marginTop: 8, color: 'var(--text-3)', fontSize: 11.5 }}>
          <span className="row" style={{ gap: 3 }}><Icon name="eye" size={13} />{fmtCount(p.views)} 次浏览</span>
          <span className="row" style={{ gap: 3 }}><Icon name="package" size={13} />已售 {fmtCount(p.sales)}</span>
          <span className="row" style={{ gap: 3 }}><Icon name="award" size={13} />AI 生成详情页</span>
        </div>
      </div>

      {/* 创作者行 */}
      <div style={{ margin: '14px', background: '#F8F9FA', borderRadius: 14, padding: '10px 12px' }}>
        <div className="row" style={{ gap: 9 }}>
          <Avatar src={p.creator?.avatar ? imgSafe(p.creator.avatar) : undefined} name={p.creator?.nickname} size={34} />
          <div className="flex-1" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.creator?.nickname || '织梦创作者'}</span>
              <span style={{ fontSize: 10, color: 'var(--success)', background: 'var(--success-soft)', borderRadius: 99, padding: '1px 7px', fontWeight: 700 }}>橱窗认证</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 2 }}>设计 → 打版 → 3D 质检，全链路公开</div>
          </div>
          <button onClick={() => toast('达人主页即将上线')} style={{ fontSize: 12, color: 'var(--brand)', fontWeight: 700 }}>进店</button>
        </div>
      </div>

      {/* 设计材料卡 */}
      {(p.patternMatIds?.length > 0 || p.modelMatIds?.length > 0) && (
        <div style={{ margin: '0 14px 14px', background: 'linear-gradient(135deg,#FFF7FB,#FDF0F5)', borderRadius: 16, border: '1px solid #F6DCE6', padding: '13px 14px' }}>
          <div className="row" style={{ gap: 6, fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
            <Icon name="layers" size={17} color="var(--brand)" />设计材料 · 透明呈现
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.7 }}>
            你可以看到这件衣服的<b>打版图</b>与<b>3D 模型</b>——从设计文件到成衣的真实轨迹。
          </div>
          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            {p.modelMatIds?.length > 0 && (
              <button onClick={() => setMatViewer('3d')} className="row" style={{ gap: 5, padding: '7px 14px', borderRadius: 99, background: 'var(--info)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                <Icon name="layers" size={14} />查看 3D 模型（{p.modelMatIds.length}）
              </button>
            )}
            {p.patternMatIds?.length > 0 && (
              <button onClick={() => setMatViewer('pattern')} className="row" style={{ gap: 5, padding: '7px 14px', borderRadius: 99, background: '#9A7A1E', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                <Icon name="pen-tool" size={14} />查看打版图（{p.patternMatIds.length}）
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI 详情区 */}
      <div style={{ margin: '0 14px 14px', borderTop: '8px solid #F2F3F5', borderRadius: 4, paddingTop: 10 }}>
        <div className="row" style={{ gap: 6, fontSize: 15, fontWeight: 800, margin: '8px 0 6px' }}>
          <Icon name="sparkle" size={18} color="var(--brand)" />AI 设计说明
        </div>
        {detail.intro && <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.85, margin: '6px 0 10px' }}>{detail.intro}</p>}
        {detail.story && (
          <div style={{ background: '#FAFAFC', borderRadius: 12, padding: '11px 13px', marginBottom: 8 }}>
            <div className="row" style={{ gap: 5, fontSize: 12.5, fontWeight: 800, marginBottom: 5 }}>
              <Icon name="history" size={14} color="#8B5CF6" />从设计到生产的故事
            </div>
            <p className="whitespace-pre" style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>{detail.story}</p>
          </div>
        )}

        {/* sections 折叠 */}
        {detail.sections?.length > 0 && (
          <div className="card" style={{ border: '1px solid var(--mall-line)', borderRadius: 14, overflow: 'hidden', marginBottom: 8 }}>
            {detail.sections.map((s, i) => {
              const open = collapsed[i] !== true;
              return (
                <div key={i} style={{ borderBottom: i < detail.sections.length - 1 ? '1px solid var(--mall-line)' : 'none' }}>
                  <button className="collapse-hd" style={{ padding: '12px 13px' }} onClick={() => setCollapsed((c) => ({ ...c, [i]: !open }))}>
                    <span className="row" style={{ gap: 7, fontSize: 13.5, fontWeight: 700 }}>
                      {s.icon ? <Icon name={(s.icon as never) || 'note'} size={15} color="var(--brand)" /> : <Icon name="note" size={15} color="var(--brand)" />}
                      {s.title}
                    </span>
                    <Icon name={open ? 'chevron-down' : 'chevron-right'} size={15} color="var(--text-3)" />
                  </button>
                  {open && <div className="whitespace-pre" style={{ padding: '0 13px 12px', fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.85 }}>{s.body}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* 部件面料 chips */}
        {detail.partsFabric?.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, margin: '8px 0 6px' }}>部件 / 面料</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {detail.partsFabric.map((f, i) => <span key={i} style={{ background: '#F5F6F7', borderRadius: 99, padding: '5px 12px', fontSize: 11.5, color: 'var(--text-2)' }}>{f}</span>)}
            </div>
          </div>
        )}

        {/* 规格尺码表 */}
        {detail.sizeChart?.length > 0 && (
          <div style={{ margin: '10px 0' }}>
            <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>
              <Icon name="ruler" size={15} color="var(--brand)" />规格尺码表（含国际码换算）
            </div>
            <SizeChartTable rows={detail.sizeChart} />
          </div>
        )}

        {/* 生产信息 */}
        <div className="card" style={{ border: '1px solid var(--mall-line)', borderRadius: 14, padding: '4px 13px', margin: '10px 0' }}>
          <div className="kv-row"><span className="kv-key">生产商</span><span className="kv-val">{detail.manufacturer || '织梦柔性智造工厂 · 华东1号'}</span></div>
          <div className="kv-row"><span className="kv-key">生产周期</span><span className="kv-val">约 {detail.prodDays || 10} 天（含质检/物流）</span></div>
          {detail.baseFeeNote && <div className="kv-row" style={{ alignItems: 'flex-start' }}><span className="kv-key">基础费用</span><span className="kv-val" style={{ maxWidth: '72%' }}>{detail.baseFeeNote}</span></div>}
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="mall-actionbar">
        <button onClick={() => navigate('/mall/cart')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: '#1F2329', width: 48, position: 'relative' }}>
          <Icon name="cart" size={22} />
          <span style={{ fontSize: 9.5, color: 'var(--text-3)' }}>购物车</span>
          {cart.count > 0 && <span className="badge-dot" style={{ position: 'absolute', top: -4, left: 28 }}>{cart.count}</span>}
        </button>
        <button className="btn btn-outline" style={{ flex: 1.1 }} onClick={() => openSize('cart')}>加入购物车</button>
        <button className="btn btn-danger-soft" style={{ flex: 1 }} onClick={() => openSize('buy')}>立即购买</button>
        {p.baseFee > 0 && (
          <button className="btn btn-custom" style={{ flex: 1.4 }} onClick={() => { if (needLogin()) return; navigate(`/mall/custom/${p.id}`, { state: { product: p } }); }}>
            私人定制
          </button>
        )}
      </div>

      {/* 尺码选择 */}
      <Sheet open={sizeOpen} onClose={() => setSizeOpen(false)} title={buyMode === 'cart' ? '选择尺码 · 加入购物车' : '选择尺码 · 立即购买'}>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 10 }}>选择商品尺码（国际码）</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(sizes.length ? sizes : ['均码']).map((s) => (
            <button key={s} className="size-pick" style={size === s ? { border: '1.6px solid var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' } : {}} onClick={() => setSize(s)}>{s}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '10px 2px 0', lineHeight: 1.7 }}>
          定制用户可在“私人定制”中按体型自动调整规格，这里仅用于现货直购。
        </div>
        <button className="btn btn-primary btn-block" style={{ marginTop: 14 }} onClick={confirmSize}>确定（¥{fmtMoney(p.price)}）</button>
      </Sheet>

      {/* 素材查看弹层 */}
      <MaterialViewer matIds={matViewer === '3d' ? (p.modelMatIds || []) : matViewer === 'pattern' ? (p.patternMatIds || []) : []} mode={matViewer === 'pattern' ? 'pattern' : '3d'} open={!!matViewer} onClose={() => setMatViewer(null)} title={p.title} />
    </div>
  );
}

function NavBack({ title }: { title: string }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', padding: '0 12px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="row" style={{ gap: 12 }}>
        <GoBack />
      </div>
      <span style={{ fontSize: 15.5, fontWeight: 800 }}>{title}</span>
      <span style={{ width: 22 }} />
    </div>
  );
}

function GoBack() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(-1)} style={{ padding: 4 }}><Icon name="arrow-left" size={21} /></button>;
}

function NavCircle({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(20,20,30,.4)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}>
      {children}
    </button>
  );
}
