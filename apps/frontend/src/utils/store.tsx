/* ============================================================================
 * 织梦 · 本地状态与体型工具（consumer / mall / learn 复用；V2 版）
 * 核心数据一律走 API；此处只存 token 之外的 UI/草稿类本地数据。
 * ==========================================================================*/
import React from 'react';
import type { BodyMeasurement } from '../api/types';

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

export const K = {
  follows: 'zm_follows',
  watchProgress: 'zm_watch_progress',
  preferences: 'zm_preferences',
  learning: 'zm_learning_courses',
  body: 'zm_body',                    // 体型（本地回退缓存）
  cart: 'zm_cart_v2',                 // 商城购物车（localStorage 会话）
  collections: 'zm_collections_v2',   // 收藏快照（product/post）
  viewedProducts: 'zm_viewed_products',
  bodyBackup: 'zm_body_backup',
};

export const DEFAULT_BODY: BodyMeasurement = {
  height: 165, weight: 52, bust: 84, underBust: 72, waist: 64, hip: 90,
  shoulderWidth: 38, armLength: 54, thigh: 50, calf: 34, neck: 33, backLength: 38,
  source: 'manual', updatedAt: '',
};

export const BODY_FIELDS: { key: keyof BodyMeasurement; label: string; unit: string; min: number; max: number }[] = [
  { key: 'height', label: '身高', unit: 'cm', min: 140, max: 200 },
  { key: 'weight', label: '体重', unit: 'kg', min: 35, max: 150 },
  { key: 'bust', label: '胸围', unit: 'cm', min: 60, max: 130 },
  { key: 'underBust', label: '下胸围', unit: 'cm', min: 55, max: 110 },
  { key: 'waist', label: '腰围', unit: 'cm', min: 50, max: 120 },
  { key: 'hip', label: '臀围', unit: 'cm', min: 60, max: 140 },
  { key: 'shoulderWidth', label: '肩宽', unit: 'cm', min: 30, max: 55 },
  { key: 'armLength', label: '臂长', unit: 'cm', min: 45, max: 75 },
  { key: 'thigh', label: '大腿围', unit: 'cm', min: 35, max: 80 },
  { key: 'calf', label: '小腿围', unit: 'cm', min: 25, max: 50 },
  { key: 'neck', label: '颈围', unit: 'cm', min: 28, max: 45 },
  { key: 'backLength', label: '背长', unit: 'cm', min: 35, max: 60 },
];

/** 读取缓存体型（无则默认） */
export function readLocalBody(): BodyMeasurement {
  try {
    const raw = localStorage.getItem(K.body);
    if (raw) {
      const b = JSON.parse(raw) as Partial<BodyMeasurement>;
      if (b && typeof b.height === 'number') return { ...DEFAULT_BODY, ...b, updatedAt: b.updatedAt || new Date().toISOString() };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_BODY, updatedAt: new Date().toISOString() };
}

export function writeLocalBody(b: BodyMeasurement) {
  try { localStorage.setItem(K.body, JSON.stringify(b)); } catch { /* ignore */ }
}

/** 基础推荐尺码（无后端时演示用；真实以 /custom/adapt 为准） */
export function recommendSize(body?: BodyMeasurement | null): string {
  if (!body) return 'M';
  const m = Math.max(body.bust, body.waist, body.hip);
  if (m < 80) return 'XS';
  if (m < 88) return 'S';
  if (m < 96) return 'M';
  if (m < 104) return 'L';
  return 'XL';
}

/** 体型表单 → api payload（剔除展示字段） */
export function bodyToPayload(b: BodyMeasurement): Record<string, number | string> {
  const { source, updatedAt, ...rest } = b;
  void source; void updatedAt;
  return { ...rest, source: 'manual' };
}
