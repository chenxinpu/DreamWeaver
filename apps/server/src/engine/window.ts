/**
 * 橱窗审核引擎（SPEC §3.2）：
 * 完整性规则 → approved 自动生成 AI 商品详情页 Product(onSale) 并上架；
 * 任一缺失 → rejected + auditLog + 通知补材料。
 */
import { db, nextId, touch } from '../db/store';
import type { WindowMaterial, Product } from '../types';
import { nowIso } from '../utils/time';
import { notify } from './helpers';
import { buildProduct } from './aiProduct';

export interface AuditResult {
  pass: boolean;
  missing: string[];
  product?: Product;
  note: string;
}

const REQUIRED_CHECKS: { key: string; label: string; ok: (w: WindowMaterial) => boolean }[] = [
  { key: 'photos', label: '真人模特穿搭实景图（photos ≥ 1）', ok: (w) => (w.photos || []).length >= 1 },
  { key: 'partsFabric', label: '各部件面料说明（partsFabric）', ok: (w) => (w.partsFabric || []).every((p) => p.part && p.fabric) && (w.partsFabric || []).length > 0 },
  { key: 'sizeChart', label: '规格尺码表 ≥ 2 档（spec.sizeChart）', ok: (w) => (w.spec?.sizeChart || []).length >= 2 },
  { key: 'patternMatIds', label: '打版结果文件（patternMatIds ≥ 1）', ok: (w) => (w.patternMatIds || []).length >= 1 },
  { key: 'modelMatIds', label: '3D 结果文件（modelMatIds ≥ 1）', ok: (w) => (w.modelMatIds || []).length >= 1 },
  { key: 'price', label: '原价 price > 0', ok: (w) => w.price > 0 },
  { key: 'baseFee', label: '基础费用 baseFee > 0', ok: (w) => w.baseFee > 0 },
];

/** 完整性检查 */
export function checkCompleteness(win: WindowMaterial): { pass: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const c of REQUIRED_CHECKS) if (!c.ok(win)) missing.push(c.label);
  return { pass: missing.length === 0, missing };
}

/** 执行审核：pass → 生成 Product；fail → rejected+记录缺失 */
export function auditWindow(win: WindowMaterial): AuditResult {
  const { pass, missing } = checkCompleteness(win);
  const creator = db.users.find((u) => u.id === win.creatorId);
  const nickname = creator ? creator.nickname : `创作者${win.creatorId}`;
  const at = nowIso();

  if (!win.auditLog) win.auditLog = [];
  win.auditLog.push({ passed: pass, note: pass ? '材料完整，审核通过' : `缺少：${missing.join('、')}`, at });
  win.updatedAt = at;

  if (pass) {
    win.status = 'approved';
    const work = db.works.find((w) => w.id === win.workId);
    if (!work) {
      // 材料通过但 work 缺失（防御）
      win.status = 'rejected';
      win.auditLog.push({ passed: false, note: '关联作品不存在，请先组织作品', at });
      touch();
      return { pass: false, missing: ['作品'], note: '关联作品不存在', product: undefined };
    }
    const draft = buildProduct(win, work);
    const product: Product = { id: nextId('products'), ...draft };
    db.products.push(product);
    notify(
      win.creatorId,
      'audit',
      '✅ 橱窗审核通过，商品已上架',
      `「${win.productName}」材料审核通过，AI 已生成商品详情页并上架商城（原价 ¥${win.price}，基础费用 ¥${win.baseFee}）。可在「商品管理」中修改非材料文案，材料变更需重新提交审核。`,
      `/mall/product/${product.id}`,
    );
    notify(win.creatorId, 'product', '🛍️ 新商品上架', `「${win.productName}」已在商城开售，去数据看板查看转化表现。`, `/creator/dashboard?productId=${product.id}`);
    touch();
    return { pass: true, missing: [], product, note: `${nickname} 的橱窗材料完整，自动上架成功` };
  }

  win.status = 'rejected';
  win.auditMissing = missing;
  notify(
    win.creatorId,
    'audit',
    '⚠️ 橱窗审核未通过，请补齐材料',
    `「${win.productName || '未命名'}」审核未通过：${missing.join('；')}。材料已退回草稿状态，补齐后可重新提交（材料变更必须重新走审核）。`,
    `/creator/window?workId=${win.workId}&reject=1`,
  );
  touch();
  return { pass: false, missing, product: undefined, note: `缺少材料：${missing.join('、')}` };
}

/** 提交（含重新提交）时执行审核（§3.2：一次请求内完成，日志记录模拟 24h 内完成） */
export function submitAndAudit(win: WindowMaterial): AuditResult {
  win.status = 'submitted';
  win.updatedAt = nowIso();
  const res = auditWindow(win);
  return res;
}
