import { useLocalState } from './store';
import type { SketchWork } from '../data/sketchTypes';

/* ============ 2D 设计稿存储 ============ */
export const SKETCH_KEY = 'zm_designer_sketches';

export const useSketchWorks = () => {
  const [works, setWorks] = useLocalState<SketchWork[]>(SKETCH_KEY, []);
  const save = (patch: Omit<SketchWork, 'id' | 'updatedAt'>) => {
    const now = new Date();
    const fmt = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const id = works.length ? Math.max(...works.map((w) => w.id)) + 1 : 1;
    setWorks([{ ...patch, id, updatedAt: fmt }, ...works]);
    return id;
  };
  const update = (id: number, patch: Partial<SketchWork>) => {
    setWorks((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  };
  const remove = (id: number) => setWorks((prev) => prev.filter((w) => w.id !== id));
  const find = (id: number) => works.find((w) => w.id === id);
  return { works, setWorks, save, update, remove, find };
};
