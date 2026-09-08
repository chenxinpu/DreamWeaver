/* ============================================================================
 * /mall/custom/:id 私人定制向导（四步：体型适配 → AI 交互 → 确认 → 结果）
 * 调用 /api/custom/adapt · /api/custom/chat · /api/custom/variant
 * 下单 kind=custom（price+baseFee）→ /api/orders/:id/pay → 结果页跳订单详情
 * ==========================================================================*/
import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useToast } from '../../components/Sheet';
import { api } from '../../api/client';
import { useMe } from '../../api/session';
import type { AdaptResult, BodyMeasurement, ChatMessage, Order, Product, SpecLine, VariantResult } from '../../api/types';
import { Loading, ErrorBox, imgSafe } from '../../components/shared/utils';
import { BODY_FIELDS, DEFAULT_BODY, readLocalBody, bodyToPayload } from '../../utils/store';

const QUICK_ASKS: { label: string; text: string; icon: IconName }[] = [
  { label: '改面料', text: '我不太喜欢这款的面料，请帮我推荐更适合春夏的替代面料', icon: 'layers' },
  { label: '改袖型', text: '想把袖子改成更利落的常规袖型，请给我调整方案', icon: 'pants' },
  { label: '改领型', text: '想要显脖长的领型，帮我调整领口设计', icon: 'tshirt' },
  { label: '换颜色', text: '请推荐 2-3 个更适合日常通勤的颜色', icon: 'heart' },
  { label: '整体建议', text: '结合我的体型，请整体评估这件衣服哪里可以优化', icon: 'sparkle' },
];

type VariantPreview = VariantResult & { optionKey: string; optionTitle: string };

export default function CustomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { user } = useMe();

  const initialProduct = (location.state as { product?: Product } | null)?.product;

  const [product, setProduct] = React.useState<Product | null>(initialProduct || null);
  const [loading, setLoading] = React.useState(!initialProduct);
  const [error, setError] = React.useState('');
  const [step, setStep] = React.useState<1 | 2 | 3 | 4>(1);

  /* Step1 体型 */
  const [body, setBody] = React.useState<BodyMeasurement>(() => {
    const b = user?.body && typeof user.body.height === 'number' ? user.body : readLocalBody();
    return { ...DEFAULT_BODY, ...b, updatedAt: b.updatedAt || new Date().toISOString() };
  });
  const [adapt, setAdapt] = React.useState<AdaptResult | null>(null);
  const [adapting, setAdapting] = React.useState(false);

  /* Step2 AI */
  const [history, setHistory] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [chatting, setChatting] = React.useState(false);
  const [preview, setPreview] = React.useState<VariantPreview | null>(null);
  const [previewing, setPreviewing] = React.useState(false);
  const [applied, setApplied] = React.useState<{ key: string; title: string }[]>([]);

  /* Step3/4 订单 */
  const [order, setOrder] = React.useState<Order | null>(null);
  const [placing, setPlacing] = React.useState(false);

  React.useEffect(() => {
    if (initialProduct) return;
    let stop = false;
    setLoading(true);
    api.products.get(id || '0').then((p) => { if (!stop) { setProduct(p); setLoading(false); } }).catch((e) => { if (!stop) { setError((e as Error).message); setLoading(false); } });
    return () => { stop = true; };
  }, [id, initialProduct]);

  React.useEffect(() => {
    setHistory([{ role: 'assistant', content: `你好！我是你的 AI 定制助手。针对「${product?.title || '这件衣服'}」，你可以告诉我想改的部位、元素或面料；也可以直接点下面的快捷诉求。` }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  if (loading) return <div className="page no-tab"><CustomNav step={step} /><Loading text="加载商品定制上下文…" /></div>;
  if (error || !product) {
    return (
      <div className="page no-tab page-bleed">
        <CustomNav step={step} />
        <div className="state-box"><ErrorBox msg={error || '商品不存在'} onRetry={() => navigate('/mall/home')} /></div>
      </div>
    );
  }

  const doAdapt = async () => {
    setAdapting(true);
    try {
      const res = await api.custom.adapt({ productId: product.id, body: bodyToPayload(body) as Record<string, unknown> });
      setAdapt(res);
    } catch (e) {
      toast((e as Error).message || '适配失败');
    } finally { setAdapting(false); }
  };

  const sendChat = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chatting) return;
    setInput('');
    setChatting(true);
    const userMsg: ChatMessage = { role: 'user', content };
    const nextHistory = [...history, userMsg];
    setHistory(nextHistory);
    try {
      const res = await api.custom.chat({ productId: product.id, history: nextHistory.map((m) => ({ role: m.role, content: m.content })), body: bodyToPayload(body) as Record<string, unknown> });
      setHistory([...nextHistory, { role: 'assistant', content: res.reply, options: res.options || [], imageUrl: res.imageUrl || undefined }]);
    } catch (e) {
      setHistory([...nextHistory, { role: 'assistant', content: `（请求失败：${(e as Error).message}）` }]);
    } finally { setChatting(false); }
  };

  const chooseOption = async (key: string, title: string) => {
    setPreviewing(true);
    try {
      const v = await api.custom.variant({ productId: product.id, optionKey: key });
      setPreview({ ...v, optionKey: key, optionTitle: title });
    } catch (e) {
      toast((e as Error).message || '生成方案失败');
    } finally { setPreviewing(false); }
  };

  const applyVariant = () => {
    if (!preview) return;
    setApplied((a) => [...a, { key: preview.optionKey, title: preview.optionTitle || preview.title || '已应用方案' }]);
    setHistory((h) => [...h, { role: 'assistant', content: `已应用定制方案：${preview.optionTitle || preview.title || ''}${preview.desc ? '\n' + preview.desc : ''}。如需继续调整可直接告诉我。` }]);
    setPreview(null);
    toast('方案已应用，可在下一步确认', 'check');
  };

  const total = adapt?.totalEstimate?.total ?? product.price + product.baseFee;

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const created = await api.orders.create({ productId: product.id, kind: 'custom', body: bodyToPayload(body) as Record<string, unknown> });
      const paid = await api.orders.pay(created.id);
      setOrder(paid);
      setStep(4);
      toast('支付成功，工厂已接单', 'check');
    } catch (e) {
      toast((e as Error).message || '下单失败，请稍后重试');
    } finally { setPlacing(false); }
  };

  const adaptRows: SpecLine[] = adapt?.adjustedSpec?.length ? adapt.adjustedSpec : (adapt?.chart || []);
  const alerts = adapt?.fitAlerts || [];

  return (
    <div className="mall-page no-tab" style={{ paddingBottom: 'calc(var(--safe-bottom) + 24px)', background: '#fff' }}>
      <CustomNav step={step} />

      {/* ===== STEP1 体型适配 ===== */}
      {step === 1 && (
        <div style={{ padding: '4px 14px 30px' }}>
          <Title icon="ruler" text="Step 1 · 告诉我你的体型" desc="系统会按品类松量自动推算所需成品尺寸，并主动提示可能不合适的部位" />
          {user?.body && (
            <button className="btn btn-outline btn-sm" style={{ marginBottom: 12 }} onClick={() => { const mb = user?.body; if (mb) { setBody({ ...DEFAULT_BODY, ...mb, source: mb.source || 'manual' }); toast('已读取你的体型档案'); } }}>
              <Icon name="refresh" size={13} />读取我的体型档案
            </button>
          )}
          {/* 12 项快速表单 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {BODY_FIELDS.map((f) => (
              <label key={f.key} style={{ background: '#F8F9FA', borderRadius: 10, padding: '6px 9px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11.5, width: 52, flexShrink: 0 }}>{f.label}</span>
                <input
                  type="number"
                  value={(body[f.key] as number) || ''}
                  onChange={(e) => setBody((b) => ({ ...b, [f.key]: Number(e.target.value) }))}
                  placeholder={`${f.min}-${f.max}`}
                  style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, textAlign: 'right' }}
                />
                <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{f.unit}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 16 }} onClick={doAdapt} disabled={adapting}>
            <Icon name="scan" size={18} />{adapting ? '正在适配…' : '按我的体型适配规格'}
          </button>

          {adapt && (
            <div style={{ marginTop: 18, animation: 'fadeIn .3s ease' }}>
              {/* fitAlerts 醒目警告 */}
              {alerts.length > 0 && (
                <div style={{ background: 'linear-gradient(120deg,#FFF0F0,#FDE4E4)', border: '1px solid #F8C4C4', borderRadius: 14, padding: '12px 14px', marginBottom: 12 }}>
                  <div className="row" style={{ gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--danger)' }}>
                    <Icon name="shield" size={16} />系统提示：以下规格可能不合适
                  </div>
                  <ul style={{ fontSize: 12, color: '#B03436', lineHeight: 1.8, marginTop: 6, paddingLeft: 18 }}>
                    {alerts.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                  <div style={{ fontSize: 11, color: '#8A3A3C', marginTop: 4 }}>建议在下一步让 AI 助手帮你调整，或接受宽松余量。</div>
                </div>
              )}
              {/* 尺寸对照 */}
              <div className="card" style={{ border: '1px solid var(--mall-line)', borderRadius: 14, padding: '4px 13px 10px' }}>
                <div className="row" style={{ justifyContent: 'space-between', padding: '10px 0 6px' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>成衣尺寸对照</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>推荐基码：<b style={{ color: 'var(--brand-deep)', fontSize: 13 }}>{adapt.baseSize || 'M'}</b></span>
                </div>
                <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 6 }}>体型 + 品类松量 = 需要成品尺寸（target）；base 为基码成品值</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 360 }}>
                    <thead>
                      <tr>
                        {['部位', '体型', '松量', '需要(目标)', '基码值', '状态'].map((h) => (
                          <th key={h} style={{ padding: '6px 4px', textAlign: 'center', background: 'var(--bg)', color: 'var(--text-2)', border: '1px solid var(--line)', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {adaptRows.map((r) => (
                        <tr key={r.part} style={{
                          background: r.flag === 'tight' ? '#FFF0F0' : r.flag === 'loose' ? '#FFF7EC' : '#fff',
                        }}>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', fontWeight: 700 }}>{r.part}</td>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', textAlign: 'center' }}>{r.body ?? '—'}</td>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', textAlign: 'center' }}>{r.ease ?? '—'}</td>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', textAlign: 'center' }}><b>{r.target ?? '—'}</b></td>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', textAlign: 'center' }}>{r.base ?? '—'}</td>
                          <td style={{ border: '1px solid var(--line)', padding: '6px 4px', textAlign: 'center' }}>
                            <FlagChip flag={r.flag} />
                            {r.advise && <div style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2 }}>{r.advise}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button className="btn btn-custom btn-block btn-lg" style={{ marginTop: 16 }} onClick={() => setStep(2)}>
                下一步：AI 交互调整 <Icon name="arrow-right" size={17} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP2 AI 交互 ===== */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 54px)', padding: '4px 0 0' }}>
          <div style={{ padding: '0 14px 8px' }}>
            <Title icon="sparkle" text="Step 2 · AI 交互定制" desc="描述你的诉求或点选快捷诉求；AI 会给出方案并可生成款式图预览" />
          </div>
          {/* 对话区 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 14px 10px', background: '#FAFAFC' }}>
            {history.map((m, i) => (
              <Bubble key={i} m={m} onPick={chooseOption} picking={previewing} />
            ))}
            {chatting && (
              <div className="row" style={{ gap: 6, color: 'var(--text-3)', fontSize: 12, padding: '8px 4px' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--brand-soft)', borderTopColor: 'var(--brand)', animation: 'zmSpin .8s linear infinite', display: 'inline-block' }} />
                AI 正在思考…
              </div>
            )}
            {/* 快捷诉求 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {QUICK_ASKS.map((q) => (
                <button key={q.label} onClick={() => sendChat(q.text)} className="row" style={{ gap: 4, background: '#fff', border: '1px solid var(--mall-line)', borderRadius: 99, padding: '6px 12px', fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>
                  <Icon name={q.icon} size={12} color="var(--brand)" />{q.label}
                </button>
              ))}
            </div>
          </div>

          {/* 方案预览 */}
          {preview && (
            <div style={{ padding: '6px 14px', borderTop: '1px solid var(--mall-line)', background: '#fff', maxHeight: '40dvh', overflowY: 'auto' }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <Icon name="image" size={15} color="var(--brand)" />
                <span style={{ fontSize: 13, fontWeight: 800 }}>生成图预览：{preview.optionTitle || preview.title}</span>
              </div>
              {preview.image && <VariantImage src={preview.image} alt={preview.optionTitle || '方案图'} />}
              {preview.desc && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.7 }}>{preview.desc}</div>}
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={() => setPreview(null)}>放弃此方案</button>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={applyVariant}><Icon name="check" size={14} />应用此方案</button>
              </div>
            </div>
          )}

          {/* 输入区 */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px calc(var(--safe-bottom) + 8px)', borderTop: '1px solid var(--mall-line)', background: '#fff' }}>
            <div className="row flex-1" style={{ background: '#F3F4F6', borderRadius: 99, height: 42, padding: '0 14px', gap: 8 }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} placeholder="告诉我想怎么改：袖子、领口、面料…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13.5 }} />
            </div>
            <button onClick={() => sendChat()} className="btn btn-custom btn-sm" style={{ width: 74, height: 42 }} disabled={chatting}><Icon name="send" size={16} /></button>
          </div>

          {/* 底部主按钮（去确认） */}
          {applied.length > 0 && (
            <button className="btn btn-primary btn-block btn-lg" style={{ borderRadius: 0 }} onClick={() => setStep(3)}>
              已应用 {applied.length} 项调整 · 去确认订单
            </button>
          )}
        </div>
      )}

      {/* ===== STEP3 确认 ===== */}
      {step === 3 && (
        <div style={{ padding: '4px 14px 30px' }}>
          <Title icon="receipt" text="Step 3 · 确认定制单" desc="全款=商品原价 + 基础费用；请阅读定制条款" />
          {/* 金额明细 */}
          <div className="card" style={{ border: '1px solid var(--mall-line)', borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <div className="img-ph" style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <img src={imgSafe(product.cover || product.images?.[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div className="flex-1" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{product.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>私人定制 · kind=custom · 推荐基码 {adapt?.baseSize || (product.aiDetail?.sizeChart?.[0]?.size || 'M')}</div>
              </div>
            </div>
            <div className="kv-row"><span className="kv-key">商品原价</span><span className="kv-val">¥{product.price}</span></div>
            <div className="kv-row"><span className="kv-key">基础费用（加工/材料/人工）</span><span className="kv-val">¥{product.baseFee}</span></div>
            <div className="kv-row" style={{ borderTop: '1.5px dashed var(--line)', marginTop: 4, paddingTop: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800 }}>应付合计</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--brand-deep)' }}>¥{total}</span>
            </div>
          </div>

          {/* 体型/调整摘要 */}
          {(adapt || applied.length > 0) && (
            <div className="card" style={{ border: '1px solid var(--mall-line)', borderRadius: 16, padding: '12px 14px', marginBottom: 12 }}>
              <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, marginBottom: 8 }}>
                <Icon name="scan" size={15} color="var(--brand)" />体型与调整摘要
              </div>
              {adaptRows.slice(0, 8).map((r) => (
                <div key={r.part} className="kv-row">
                  <span className="kv-key">{r.part}</span>
                  <span className="kv-val">{r.body} 体型 → {r.target} 成品 <FlagChip flag={r.flag} inline /></span>
                </div>
              ))}
              {applied.map((a) => (
                <div key={a.key} className="kv-row"><span className="kv-key">AI 调整</span><span className="kv-val">{a.title}</span></div>
              ))}
            </div>
          )}

          {/* 定制条款 */}
          <div style={{ background: '#FFF7EC', border: '1px solid #F3DFB6', borderRadius: 16, padding: '12px 14px', marginBottom: 16 }}>
            <div className="row" style={{ gap: 6, fontSize: 13.5, fontWeight: 800, color: '#8A6420', marginBottom: 6 }}>
              <Icon name="shield" size={15} />私人定制条款
            </div>
            <ul style={{ fontSize: 12, color: '#7A5B10', lineHeight: 1.9, paddingLeft: 18 }}>
              <li><b>退货</b>：仅退商品原价，基础费用（加工/材料/人工）不退；成衣将自动放入商城「二手集市」以原价×75% 上架（可自降）。</li>
              <li><b>换货重新定制</b>：再收取一次基础费用（原价部分已随首单支付）。</li>
              <li>确认后进入柔性智造排产，预计 {product.aiDetail?.prodDays || 10} 天（含质检与物流），过程可在订单详情查看。</li>
            </ul>
          </div>

          <button className="btn btn-custom btn-block btn-lg" onClick={placeOrder} disabled={placing}>
            <Icon name="lock" size={16} />{placing ? '正在下单支付…' : `确认并支付 ¥${total}`}
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => setStep(2)}>返回继续调整</button>
        </div>
      )}

      {/* ===== STEP4 结果 ===== */}
      {step === 4 && order && (
        <div style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ width: 88, height: 88, margin: '0 auto 20px', borderRadius: '50%', background: 'linear-gradient(135deg,#4ADE80,#22B26A)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px rgba(34,178,106,.35)' }}>
            <Icon name="check" size={44} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>定制订单已支付 🎉</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.8 }}>
            订单号：{order.no}<br />
            支付金额：¥{order.amounts?.total}（原价 ¥{order.amounts?.price} + 基础费用 ¥{order.amounts?.baseFee}）
          </div>
          <div style={{ background: 'var(--success-soft)', borderRadius: 14, padding: '12px', fontSize: 12, color: 'var(--success)', marginTop: 18, lineHeight: 1.8 }}>
            已进入智能排产：打版校验 → 柔性裁剪 → 缝制 → 质检 → 发货。<br />
            可随时在订单详情查看生产进度。
          </div>
          <div className="row" style={{ gap: 10, marginTop: 26 }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => navigate('/mall/home')}>再逛逛</button>
            <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={() => navigate(`/mall/orders/${order.id}`)}>查看订单详情</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 小组件 ---------------- */
function CustomNav({ step }: { step: 1 | 2 | 3 | 4 }) {
  const navigate = useNavigate();
  const labels = ['体型', 'AI 交互', '确认', '结果'];
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 40, background: '#fff', borderBottom: '1px solid var(--mall-line)', padding: '8px 12px' }}>
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <button onClick={() => navigate(-1)} style={{ padding: 3 }}><Icon name="arrow-left" size={20} /></button>
        <span style={{ fontSize: 15, fontWeight: 800 }}>私人定制向导</span>
      </div>
      <div className="steps">
        {labels.map((lb, i) => {
          const idx = (i + 1) as 1 | 2 | 3 | 4;
          const done = step > idx;
          const on = step === idx;
          return (
            <React.Fragment key={lb}>
              {i > 0 && <span className="step-line" style={{ background: done || on ? 'var(--brand)' : 'var(--bg-deep)' }} />}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span className="step-dot" style={{ width: 24, height: 24, fontSize: 11, background: done || on ? 'var(--brand-grad)' : 'var(--bg-deep)', color: done || on ? '#fff' : 'var(--text-3)' }}>
                  {done ? <Icon name="check" size={12} /> : idx}
                </span>
                <span className="step-label" style={{ color: on ? 'var(--brand-deep)' : 'var(--text-3)', fontWeight: on ? 700 : 500 }}>{lb}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function Title({ icon, text, desc }: { icon: IconName; text: string; desc?: string }) {
  return (
    <div style={{ padding: '12px 0 10px' }}>
      <div className="row" style={{ gap: 7, fontSize: 16, fontWeight: 800 }}><Icon name={icon} size={18} color="var(--brand)" />{text}</div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.6 }}>{desc}</div>}
    </div>
  );
}

function FlagChip({ flag, inline }: { flag?: 'ok' | 'tight' | 'loose' | string; inline?: boolean }) {
  if (flag === 'tight') return <span className="st-badge st-hot" style={inline ? { marginLeft: 6 } : {}}>偏紧</span>;
  if (flag === 'loose') return <span className="st-badge st-warn" style={inline ? { marginLeft: 6 } : {}}>偏松</span>;
  return <span className="st-badge st-ok" style={inline ? { marginLeft: 6 } : {}}>合适</span>;
}

function Bubble({ m, onPick, picking }: { m: ChatMessage; onPick: (key: string, title: string) => void; picking: boolean }) {
  const isUser = m.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div style={{
        maxWidth: '82%', background: isUser ? 'var(--brand-grad)' : '#fff', color: isUser ? '#fff' : 'var(--text)',
        borderRadius: 14, borderBottomRightRadius: isUser ? 4 : 14, borderBottomLeftRadius: isUser ? 14 : 4,
        padding: '9px 13px', fontSize: 13, lineHeight: 1.7, boxShadow: '0 1px 3px rgba(20,20,30,.06)',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {m.content}
        {m.imageUrl && <VariantImage src={m.imageUrl} alt="AI 生成图" />}
        {!isUser && m.options?.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
            {m.options.map((o) => (
              <button key={o.key} onClick={() => onPick(o.key, o.title)} disabled={picking} style={{ background: '#fff', border: '1.4px solid var(--brand)', color: 'var(--brand-deep)', borderRadius: 99, padding: '6px 13px', fontSize: 12, fontWeight: 700 }}>
                {o.title}
                {o.desc && <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-3)', marginTop: 2 }}>{o.desc}</div>}
              </button>
            ))}
            <div style={{ width: '100%', fontSize: 10.5, color: 'var(--text-3)' }}>↑ 选择感兴趣的方案，点击即生成款式预览图</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* SVG data-url / 内联 svg / 普通 url 图统一渲染 */
function VariantImage({ src, alt }: { src?: string; alt: string }) {
  if (!src) return null;
  const isSvgMarkup = src.trim().startsWith('<');
  if (isSvgMarkup) {
    return (
      <div style={{ marginTop: 9, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--mall-line)', background: '#fff' }}>
        <div dangerouslySetInnerHTML={{ __html: src }} />
      </div>
    );
  }
  return <img src={src} alt={alt} style={{ marginTop: 9, width: '100%', borderRadius: 10, border: '1px solid var(--mall-line)', maxHeight: 260, objectFit: 'contain', background: '#fff' }} />;
}
