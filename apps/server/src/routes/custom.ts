/** custom 私人定制路由：context / adapt / chat / variant / preview */
import { Router } from 'express';
import { db } from '../db/store';
import type { BodyMeasurement } from '../types';
import { bad, notFound, ok, wrap } from '../utils/resp';
import { adaptToProduct, customChat, genVariantSvg, easeFor } from '../engine/custom';
import { toUserPublic } from './dto';

export const customRouter = Router();

function getProduct(id: number) {
  const p = db.products.find((x) => x.id === id);
  if (!p) notFound('商品不存在');
  return p;
}

function bodyFromInput(b: unknown): BodyMeasurement {
  const x = (b || {}) as Partial<BodyMeasurement>;
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const body: BodyMeasurement = {
    height: num(x.height, 165), weight: num(x.weight, 55),
    bust: num(x.bust, 84), underBust: num(x.underBust, 74), waist: num(x.waist, 64), hip: num(x.hip, 90),
    shoulderWidth: num(x.shoulderWidth, 38), armLength: num(x.armLength, 54),
    thigh: num(x.thigh, 51), calf: num(x.calf, 34), neck: num(x.neck, 33), backLength: num(x.backLength, 39),
    source: x.source === 'ai' ? 'ai' : 'manual',
    updatedAt: new Date().toISOString(),
  };
  return body;
}

customRouter.get('/custom/product/:id/context', wrap(async (req, res) => {
  const uid = Number((req as { userId?: number }).userId);
  const p = getProduct(Number(req.params.id));
  const chart = p.aiDetail?.sizeChart || [];
  const categories = { '连衣裙': { bust: 8, waist: 6, hip: 8 }, '衬衫': { bust: 12, shoulder: 1.5 }, '外套': { bust: 12, shoulder: 1.5 }, '半裙': { waist: 4, hip: 6 }, '裤装': { waist: 4, hip: 8 }, '套装': { bust: 8, waist: 6, hip: 8 } };
  const user = db.users.find((u) => u.id === uid);
  res.json(ok({
    product: { id: p.id, title: p.title, cover: p.cover, category: p.category, price: p.price, baseFee: p.baseFee, styleTags: p.styleTags },
    sizeChart: chart,
    easeTemplate: (categories as Record<string, Record<string, number>>)[p.category] || { bust: 8, waist: 6, hip: 8 },
    easeExplain: `松量说明（品类 ${p.category}）：${Object.keys((categories as Record<string, Record<string, number>>)[p.category] || {}).map((k) => `${k}+${((categories as Record<string, Record<string, number>>)[p.category] || {})[k]}`).join('、')}。需要成品尺寸 = 体型 + 松量。`,
    baseFeeNote: p.aiDetail?.baseFeeNote || `私人定制基础费用 ¥${p.baseFee}（加工/材料/人工），退货仅退原价。`,
    myBody: user?.body || null,
    user: user ? toUserPublic(user) : null,
  }));
}));

/** 规格调整（核心算法 §3.4） */
customRouter.post('/custom/adapt', wrap(async (req, res) => {
  const p = getProduct(Number(req.body?.productId));
  const body = bodyFromInput(req.body?.body);
  const result = adaptToProduct(p, body);
  res.json(ok(result));
}));

/** AI 交互 */
customRouter.post('/custom/chat', wrap(async (req, res) => {
  const p = getProduct(Number(req.body?.productId));
  const history: { role: string; content: string }[] = Array.isArray(req.body?.history) ? req.body.history : [];
  const uid = Number((req as { userId?: number }).userId);
  const user = db.users.find((u) => u.id === uid);
  const body: BodyMeasurement | undefined = req.body?.body && typeof req.body.body === 'object' ? bodyFromInput(req.body.body) : user?.body;
  const r = customChat(p, history);
  // 附带体型摘要便于前端展示调整建议
  res.json(ok({
    reply: r.reply,
    options: r.options,
    hasBody: !!body,
    baseEstimate: body ? adaptToProduct(p, body).totalEstimate : { price: p.price, baseFee: p.baseFee, total: p.price + p.baseFee },
  }));
}));

/** 款式变体生成图 */
customRouter.post('/custom/variant', wrap(async (req, res) => {
  const p = getProduct(Number(req.body?.productId));
  const optionKey = String(req.body?.optionKey || '');
  if (!optionKey) bad('BAD_REQUEST', '请选择 optionKey');
  const v = genVariantSvg(p, optionKey);
  res.json(ok(v));
}));

/** 汇总调整后规格图预览 */
customRouter.post('/custom/preview', wrap(async (req, res) => {
  const p = getProduct(Number(req.body?.productId));
  const body = bodyFromInput(req.body?.body);
  const options: string[] = Array.isArray(req.body?.options) ? req.body.options.map(String) : [];
  const adapt = adaptToProduct(p, body);
  const variants = options.slice(0, 3).map((k) => {
    const v = genVariantSvg(p, k);
    return { key: k, title: v.title, desc: v.desc, image: v.image };
  });
  res.json(ok({
    baseSize: adapt.baseSize,
    adjustedSpec: adapt.adjustedSpec,
    fitAlerts: adapt.fitAlerts,
    chart: adapt.chart,
    totalEstimate: adapt.totalEstimate,
    variantImages: variants,
    explain: [...adapt.explain, `已应用定制选项 ${options.length} 项（${options.join('、')}），确认后生成定制订单。`],
  }));
}));

export { easeFor };
