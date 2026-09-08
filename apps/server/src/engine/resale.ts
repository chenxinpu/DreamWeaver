/**
 * 二手集市引擎（SPEC §3.6/§3.7）：
 * - 退货自动挂单：listPrice = 原价×0.75，platformFeeRate=8%（仓储/物流佣金）
 * - 成交：买家付 listPrice → feeCharged 归平台，netToSeller 给原买家（写流水+通知）
 * - 卖家可降价（只降不升）/取消上架
 */
import { db, nextId, touch } from '../db/store';
import type { Order, ResaleListing } from '../types';
import { nowIso } from '../utils/time';
import { r2 } from '../utils/misc';
import { notify, ledger } from './helpers';

export const DEFAULT_PLATFORM_FEE_RATE = 0.08;

/** 定制退货自动创建二手挂单 */
export function createResaleFromReturn(order: Order, originalPrice: number): ResaleListing {
  const listing: ResaleListing = {
    id: nextId('resale'),
    orderId: order.id,
    productId: order.productId,
    originalTitle: order.productTitle,
    sellerId: order.buyerId,
    photo: order.cover,
    sizeLabel: `${order.kind === 'custom' ? '私人定制' : '现货'} · 基码 ${order.specUsed.size || '-'}${order.specUsed.body ? `（含体型定制）` : ''}`,
    listPrice: r2(originalPrice * 0.75),     // 默认原价×75%
    originalPrice: r2(originalPrice),        // 保留原价，供降价后仍展示划线价
    platformFeeRate: DEFAULT_PLATFORM_FEE_RATE,
    status: 'active',
    createdAt: nowIso(),
  };
  db.resale.push(listing);
  touch();
  notify(order.buyerId, 'resale', '🏷️ 二手挂单已自动生成', `「${order.productTitle}」已按原价 75% 标价 ¥${r2(listing.listPrice)} 挂上二手集市；成交流程自动扣 8% 平台费（仓储物流），余款退还给您。可自行降价提高成交率。`, `/mall/resale/mine`);
  return listing;
}

/** 购买二手挂单 */
export function buyResale(listing: ResaleListing, buyerId: number): { listing: ResaleListing; msg: string } {
  if (listing.status !== 'active') throw Object.assign(new Error('该挂单已下架/成交'), { code: 'RESALE_STATE' });
  if (listing.sellerId === buyerId) throw Object.assign(new Error('不能购买自己挂出的商品'), { code: 'RESALE_SELF' });
  const at = nowIso();
  const listPrice = listing.listPrice;
  const feeCharged = r2(listPrice * listing.platformFeeRate);
  const netToSeller = r2(listPrice - feeCharged);
  listing.status = 'sold';
  listing.soldTo = buyerId;
  listing.soldAt = at;
  listing.feeCharged = feeCharged;
  listing.netToSeller = netToSeller;
  // 资金：平台收 fee；卖家（原退货人）收 net
  ledger(listing.sellerId, 'resale_income', netToSeller, `RS-${listing.id}`);
  // 平台费率（负向：平台收入使用 admin 用户 99 记账做展示）
  ledger(99, 'resale_fee', feeCharged, `RSF-${listing.id}`);
  touch();
  notify(listing.sellerId, 'resale', '🎉 二手商品已成交', `「${listing.originalTitle}」成交价 ¥${r2(listPrice)}：平台佣金 ¥${r2(feeCharged)}（仓储物流），净得 ¥${r2(netToSeller)} 已入账。`, `/mall/resale/mine`);
  notify(buyerId, 'resale', '🛍️ 二手商品购买成功', `你以 ¥${r2(listPrice)} 购买了「${listing.originalTitle}」（原价约 ¥${r2(listPrice / 0.75)}，立省 ¥${r2(listPrice / 3)}）。`, `/mall/resale`);
  return { listing, msg: `成交成功：净得 ¥${r2(netToSeller)}（费率 ${Math.round(listing.platformFeeRate * 100)}%）` };
}

/** 卖家改价：只降不升 */
export function changePrice(listing: ResaleListing, newPrice: number): ResaleListing {
  if (listing.status !== 'active') throw Object.assign(new Error('仅上架中的挂单可改价'), { code: 'RESALE_STATE' });
  if (newPrice <= 0) throw Object.assign(new Error('标价需大于 0'), { code: 'BAD_PRICE' });
  if (newPrice > listing.listPrice) throw Object.assign(new Error('二手集市只支持降价（促销吸单）'), { code: 'RESALE_NO_UP' });
  listing.listPrice = r2(newPrice);
  listing.sizeLabel = listing.sizeLabel; // 保持
  touch();
  return listing;
}

/** 取消上架 */
export function cancelResale(listing: ResaleListing, reason?: string): ResaleListing {
  if (listing.status !== 'active') throw Object.assign(new Error('仅上架中的挂单可取消'), { code: 'RESALE_STATE' });
  listing.status = 'cancelled';
  touch();
  notify(listing.sellerId, 'resale', '🗑️ 二手挂单已下架', `「${listing.originalTitle}」已取消上架${reason ? `：${reason}` : ''}。`, `/mall/resale/mine`);
  return listing;
}
