/** 通知 / 资金流水写入辅助 */
import { db, nextId, touch } from '../db/store';
import type { LedgerEvent, Notification } from '../types';
import { nowIso } from '../utils/time';
import { r2 } from '../utils/misc';

export function notify(userId: number, type: string, title: string, body: string, link?: string): Notification {
  const n: Notification = {
    id: nextId('notifications'),
    userId,
    type,
    title,
    body,
    ...(link ? { link } : {}),
    read: false,
    createdAt: nowIso(),
  };
  db.notifications.push(n);
  return n;
}

/** 记账：balance 按该用户上一笔流水累加 */
export function ledger(userId: number, kind: string, amount: number, refNo: string): LedgerEvent {
  const prev = [...db.ledger].reverse().find((l) => l.userId === userId);
  const ev: LedgerEvent = {
    id: nextId('ledger'),
    userId,
    kind,
    amount: r2(amount),
    balance: r2((prev ? prev.balance : 0) + amount),
    refNo,
    createdAt: nowIso(),
  };
  db.ledger.push(ev);
  return ev;
}

/** 用户余额（按流水推演） */
export function userBalance(userId: number): number {
  let bal = 0;
  for (const l of db.ledger) if (l.userId === userId) bal = l.balance;
  return bal;
}
