import { useLocalState } from './store';
import type { DesignParams } from '../data/design';
import { AI_CANDIDATES, DEFAULT_PARAMS, applyCandidate } from '../data/design';

/* ============ 服装设计App · 作品存储 ============ */

export interface DesignWork {
  id: number;
  title: string;
  params: DesignParams;
  status: 'draft' | 'synced';
  /** 同步到官方App后对应的作品ID */
  syncedWorkId?: number;
  updatedAt: string;
  aiSource?: string;
}

/** 首次打开预置的演示作品（AI 生成示例） */
export const SEED_DESIGN_WORKS: DesignWork[] = AI_CANDIDATES.slice(0, 3).map((c, i) => {
  const d = DEFAULT_PARAMS[c.category];
  return {
    id: 100 + i,
    title: c.title,
    params: { ...d, ...applyCandidate(c) },
    status: 'synced',
    syncedWorkId: 900 + i,
    updatedAt: `9月${2 - i}日 15:2${i}0`,
    aiSource: 'AI生成',
  };
});

export const useDesignWorks = () => {
  const [works, setWorks] = useLocalState<DesignWork[]>('zm_design_works', SEED_DESIGN_WORKS);
  const save = (title: string, params: DesignParams, opts?: { aiSource?: string }) => {
    const now = new Date();
    const fmt = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const newId = works.length ? Math.max(...works.map((w) => w.id)) + 1 : 1;
    setWorks([{ id: newId, title, params, status: 'draft', updatedAt: fmt, aiSource: opts?.aiSource }, ...works]);
    return newId;
  };
  const update = (id: number, patch: Partial<DesignWork>) => {
    const now = new Date();
    const fmt = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: fmt } : w)));
  };
  const remove = (id: number) => setWorks((prev) => prev.filter((w) => w.id !== id));
  const find = (id: number) => works.find((w) => w.id === id);
  return { works, setWorks, save, update, remove, find };
};

export const useSyncedDesignIds = () => useLocalState<number[]>('zm_design_synced', []);
