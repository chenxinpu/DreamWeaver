import React from 'react';
import type { BodyMeasurement, CartItem } from '../data/types';
import { initialCart } from '../data/mock';

/* ---------- localStorage 状态 Hook ---------- */
export function useLocalState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = React.useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  const set = React.useCallback((v: T | ((p: T) => T)) => {
    setValue((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, [key]);
  return [value, set];
}

/* ---------- 点赞/收藏/投票 键名常量 ---------- */
export const K = {
  likedPosts: 'zm_liked_posts',
  collectedPosts: 'zm_collected_posts',
  likedWorks: 'zm_liked_works',
  collectedWorks: 'zm_collected_works',
  votedWorks: 'zm_voted_works',
  cart: 'zm_cart',
  body: 'zm_body',
  follows: 'zm_follows',
  preferences: 'zm_preferences',
  watchProgress: 'zm_watch_progress',
};

export const isIn = (key: string, id: number) => {
  try {
    const arr: number[] = JSON.parse(localStorage.getItem(key) || '[]');
    return arr.includes(id);
  } catch { return false; }
};

export const toggleId = (key: string, id: number): boolean => {
  let arr: number[] = [];
  try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }
  const has = arr.includes(id);
  arr = has ? arr.filter((x) => x !== id) : [...arr, id];
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* ignore */ }
  return !has;
};

/* ---------- 购物车 Context ---------- */
interface CartCtx {
  items: CartItem[];
  add: (item: CartItem) => void;
  update: (workId: number, patch: Partial<CartItem>) => void;
  remove: (workId: number) => void;
  clear: () => void;
  count: number;
}
const CartContext = React.createContext<CartCtx>(null as unknown as CartCtx);
export const useCart = () => React.useContext(CartContext);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useLocalState<CartItem[]>(K.cart, initialCart);
  const add = React.useCallback((item: CartItem) => {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.workId === item.workId && i.color === item.color && i.size === item.size);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + item.qty, checked: true };
        return next;
      }
      return [...prev, { ...item, checked: true }];
    });
  }, [setItems]);
  const update = React.useCallback((workId: number, patch: Partial<CartItem>) => {
    setItems((prev) => prev.map((i) => (i.workId === workId ? { ...i, ...patch } : i)));
  }, [setItems]);
  const remove = React.useCallback((workId: number) => {
    setItems((prev) => prev.filter((i) => i.workId !== workId));
  }, [setItems]);
  const clear = React.useCallback(() => setItems([]), [setItems]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  return (
    <CartContext.Provider value={{ items, add, update, remove, clear, count }}>{children}</CartContext.Provider>
  );
}

/* ---------- 体型数据 ---------- */
export const DEFAULT_BODY: BodyMeasurement = {
  height: 165, weight: 52, bust: 84, underBust: 72, waist: 64, hip: 90,
  shoulderWidth: 38, armLength: 54, thigh: 50, calf: 34, neck: 33, backLength: 38,
  source: 'manual', updatedAt: '2026-08-20',
};

export const BODY_FIELDS: { key: keyof BodyMeasurement; label: string; unit: string; min: number; max: number }[] = [
  { key: 'height', label: '身高', unit: 'cm', min: 140, max: 200 },
  { key: 'weight', label: '体重', unit: 'kg', min: 35, max: 150 },
  { key: 'bust', label: '胸围', unit: 'cm', min: 60, max: 130 },
  { key: 'underBust', label: '下胸围', unit: 'cm', min: 55, max: 110 },
  { key: 'waist', label: '腰围', unit: 'cm', min: 50, max: 120 },
  { key: 'hip', label: '臀围', unit: 'cm', min: 60, max: 130 },
  { key: 'shoulderWidth', label: '肩宽', unit: 'cm', min: 30, max: 55 },
  { key: 'armLength', label: '臂长', unit: 'cm', min: 45, max: 75 },
  { key: 'thigh', label: '大腿围', unit: 'cm', min: 35, max: 75 },
  { key: 'calf', label: '小腿围', unit: 'cm', min: 25, max: 50 },
  { key: 'neck', label: '颈围', unit: 'cm', min: 28, max: 45 },
  { key: 'backLength', label: '背长', unit: 'cm', min: 35, max: 55 },
];

export function useBody(): [BodyMeasurement, (b: BodyMeasurement) => void] {
  return useLocalState<BodyMeasurement>(K.body, DEFAULT_BODY);
}

/** 智能尺码推荐（简化版） */
export function recommendSize(body: BodyMeasurement): string {
  const { bust, waist, hip } = body;
  const m = Math.max(bust, waist, hip);
  if (m < 80) return 'XS';
  if (m < 88) return 'S';
  if (m < 96) return 'M';
  if (m < 104) return 'L';
  return 'XL';
}
