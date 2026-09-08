/** 每日任务聚合导出（避免 scheduler 直接耦合过多） */
import { settleDueCommissions as realSettle } from './commission';
import { autoCompleteReceived } from './orderflow';

export function settleDueCommissions(): number { return realSettle(); }

export function autoCompleteReceivedOrders(): number {
  return autoCompleteReceived();
}
