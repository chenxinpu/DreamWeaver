/**
 * 数据层：单文件内存库 + 原子写盘持久化。
 * - data/db.json 缺失时自动跑 seed（见 seed.ts）
 * - 每次变更 touch() → debounce 300ms 写盘（进程退出时强制 flush）
 */
import fs from 'fs';
import path from 'path';
import type { DB } from '../types';

const projectRoot = path.resolve(__dirname, '../..'); // apps/server
export const DATA_DIR = path.join(projectRoot, 'data');
export const DB_PATH = path.join(DATA_DIR, 'db.json');
export const SAMPLES_DIR = path.join(projectRoot, 'samples');

/** 空库骨架 */
export function emptyDb(): DB {
  return {
    seq: {},
    users: [],
    materials: [],
    works: [],
    posts: [],
    pool: [],
    windows: [],
    products: [],
    orders: [],
    resale: [],
    notifications: [],
    commissionRules: [],
    ledger: [],
    viewsByDay: [],
    settings: {},
  };
}

export let db: DB = emptyDb();

/** 整体替换内存库（seed/reset 用），随后由调用方决定是否落盘 */
export function replaceDb(next: DB): void {
  db = next;
}

let saveTimer: NodeJS.Timeout | null = null;

function writeNow(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tmp, DB_PATH);
  } catch (e) {
    console.error('[store] 写盘失败:', e);
  }
}

/** 变更后调用：300ms debounce 持久化 */
export function touch(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    writeNow();
  }, 300);
}

/** 立即写盘（退出/重置前调用） */
export function saveNow(): void {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  writeNow();
}

/** 取下一个自增 id */
export function nextId(key: string): number {
  db.seq[key] = (db.seq[key] || 0) + 1;
  return db.seq[key];
}

/** 启动加载：db.json 存在则读入；否则 seed（由 seed.ts 的 resetData 完成） */
export function loadOrSeed(): { seeded: boolean } {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as Partial<DB>;
      const base = emptyDb();
      // 合并，防止新版本新增字段缺失
      db = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
      return { seeded: false };
    }
  } catch (e) {
    console.error('[store] db.json 损坏，重建种子数据:', e);
  }
  // 需要 seed
  // 延迟 require 避免循环依赖（store <- seed <- engine <- store）
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const seedMod = require('./seed');
  seedMod.resetData();
  return { seeded: true };
}
