/* ============================================================================
 * V2 本地会话工具：商城购物车 + 收藏快照（购物车状态按需求存 localStorage）
 * 说明：购物车为“本地会话”，结算下单时仍调 /api/orders 创建真实订单。
 * ==========================================================================*/
import React from 'react';
import { useLocalState, K } from './store';

/* ------------------------------ 购物车 ------------------------------ */
export interface CartItem {
  key: string;               // `${productId}-${size||'FREE'}`
  productId: number;
  title: string;
  cover: string;
  category?: string;
  price: number;
  baseFee: number;           // direct 购买固定 baseFee=0，保留字段
  creatorId?: number;
  creatorName?: string;
  size?: string;             // direct 需尺码
  qty: number;
  checked: boolean;
  isCustom: boolean;         // 私人定制商品同样支持加入（size 为定制确认后记录）
  specNote?: string;         // 定制记录（自定义尺寸/体型说明）
}

export function cartKey(productId: number, size?: string) {
  return `${productId}-${size || 'FREE'}`;
}

export interface CartCtx {
  items: CartItem[];
  add: (it: Omit<CartItem, 'key' | 'qty' | 'checked'> & { qty?: number }) => void;
  patch: (key: string, patch: Partial<CartItem>) => void;
  remove: (key: string) => void;
  toggle: (key: string) => void;
  clear: () => void;
  checkedItems: CartItem[];
  count: number;
  total: number;
}

export function useCart(): CartCtx {
  const [items, setItems] = useLocalState<CartItem[]>(K.cart, []);
  const add = React.useCallback((it: Omit<CartItem, 'key' | 'qty' | 'checked'> & { qty?: number }) => {
    setItems((prev) => {
      const key = cartKey(it.productId, it.size);
      const idx = prev.findIndex((i) => i.key === key);
      const base: CartItem = { ...it, key, qty: it.qty || 1, checked: true };
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + (it.qty || 1), checked: true, price: it.price, cover: it.cover };
        return next;
      }
      return [...prev, base];
    });
  }, [setItems]);
  const patch = React.useCallback((key: string, patchObj: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patchObj } : i)));
  }, [setItems]);
  const remove = React.useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, [setItems]);
  const toggle = React.useCallback((key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, checked: !i.checked } : i)));
  }, [setItems]);
  const clear = React.useCallback(() => setItems([]), [setItems]);
  const checkedItems = React.useMemo(() => items.filter((i) => i.checked), [items]);
  const count = React.useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);
  const total = React.useMemo(() => checkedItems.reduce((s, i) => s + i.price * i.qty, 0), [checkedItems]);
  return { items, add, patch, remove, toggle, clear, checkedItems, count, total };
}

export const fmtCartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.price * i.qty, 0);

/* ------------------------------ 收藏 ------------------------------ */
export interface CollectionItem {
  type: 'product' | 'post';
  id: number;
  title: string;
  cover: string;
  price?: number;
  at: number;
}

export function readCollections(): CollectionItem[] {
  try {
    const raw = localStorage.getItem(K.collections);
    return raw ? (JSON.parse(raw) as CollectionItem[]) : [];
  } catch { return []; }
}

export function toggleCollection(item: Omit<CollectionItem, 'at'>): { on: boolean; list: CollectionItem[] } {
  const list = readCollections();
  const idx = list.findIndex((c) => c.type === item.type && c.id === item.id);
  if (idx >= 0) {
    const next = list.filter((_, i) => i !== idx);
    localStorage.setItem(K.collections, JSON.stringify(next));
    return { on: false, list: next };
  }
  const next = [{ ...item, at: Date.now() }, ...list].slice(0, 200);
  localStorage.setItem(K.collections, JSON.stringify(next));
  return { on: true, list: next };
}

export function isCollected(type: 'product' | 'post', id: number): boolean {
  return readCollections().some((c) => c.type === type && c.id === id);
}
