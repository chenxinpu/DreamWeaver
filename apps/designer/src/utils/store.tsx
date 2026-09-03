import React from 'react';
import type { BodyMeasurement } from '../data/types';

/* ============ 设计师App · 本地状态 ============ */
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
  body: 'zm_body',
  prefs: 'zm_designer_prefs',
  favs: 'zm_designer_favs',
  syncCode: 'zm_designer_sync_hist',
};

export const isIn = (key: string, id: string) => {
  try { return (JSON.parse(localStorage.getItem(key) || '[]') as string[]).includes(id); } catch { return false; }
};

export const toggleId = (key: string, id: string): boolean => {
  let arr: string[] = [];
  try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* ignore */ }
  const has = arr.includes(id);
  arr = has ? arr.filter((x) => x !== id) : [...arr, id];
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch { /* ignore */ }
  return !has;
};

/* ---------- 体型数据（与官方App同构，便于跨端） ---------- */
export const DEFAULT_BODY: BodyMeasurement = {
  height: 165, weight: 52, bust: 84, underBust: 72, waist: 64, hip: 90,
  shoulderWidth: 38, armLength: 54, thigh: 50, calf: 34, neck: 33, backLength: 38,
  source: 'manual', updatedAt: '2026-09-02',
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

export function recommendSize(body: BodyMeasurement): string {
  const m = Math.max(body.bust, body.waist, body.hip);
  if (m < 80) return 'XS';
  if (m < 88) return 'S';
  if (m < 96) return 'M';
  if (m < 104) return 'L';
  return 'XL';
}
