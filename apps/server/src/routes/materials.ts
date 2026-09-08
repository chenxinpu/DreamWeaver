/** materials 路由：导入/列表/详情/删除/帮助 */
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { db, nextId, touch, SAMPLES_DIR } from '../db/store';
import type { Material } from '../types';
import { bad, deny, notFound, ok, wrap } from '../utils/resp';
import { currentUserId } from '../middleware/auth';
import { paginate } from '../utils/misc';
import { nowIso } from '../utils/time';
import { parseByKind, guessKindByExt, importHelpText, TEXT_KINDS } from '../parsers';
import type { ParsedMaterialFields } from '../parsers';

export const materialsRouter = Router();

materialsRouter.get('/materials/import-help', wrap(async (_req, res) => {
  const help = importHelpText();
  let samples: { fileName: string; size: number; kind: string }[] = [];
  try {
    if (fs.existsSync(SAMPLES_DIR)) {
      samples = fs.readdirSync(SAMPLES_DIR).map((f) => {
        const s = fs.statSync(path.join(SAMPLES_DIR, f));
        return { fileName: f, size: s.size, kind: guessKindByExt(f) };
      });
    }
  } catch { samples = []; }
  res.json(ok({ ...help, samples, samplePath: '/api/materials/sample-content?file=' }));
}));

/** 读取 sample 原文（导入演示/自检用） */
materialsRouter.get('/materials/sample-content', wrap(async (req, res) => {
  const file = String(req.query.file || '');
  const safe = path.basename(file);
  const p = path.join(SAMPLES_DIR, safe);
  if (!fs.existsSync(p)) bad('NOT_FOUND', '示例文件不存在');
  const kind = guessKindByExt(safe);
  const content = fs.readFileSync(p, kind === 'dxf' || kind === 'obj' || kind === 'svg' ? 'utf8' : 'base64');
  res.json(ok({ fileName: safe, kind, content, size: fs.statSync(p).size }));
}));

materialsRouter.post('/materials/import', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const user = db.users.find((u) => u.id === uid);
  if (!user) deny();
  const b = req.body || {};
  const fileName = String(b.fileName || b.filename || '');
  if (!fileName) bad('BAD_REQUEST', '请提供 fileName');
  const kind = (b.kind || guessKindByExt(fileName)) as Material['kind'];
  const tags: string[] = Array.isArray(b.tags) ? b.tags.map(String) : [];

  // 文本格式内容可能是 text 或 base64（兼容两种传法）
  const isTextKind = TEXT_KINDS.includes(kind);
  const content: string | undefined = b.content !== undefined ? String(b.content) : undefined;
  const base64: string | undefined = b.base64 !== undefined ? String(b.base64) : undefined;

  let parsed: ParsedMaterialFields;
  try {
    parsed = parseByKind({ kind, ext: path.extname(fileName).replace('.', '').toLowerCase() || kind, fileName, text: isTextKind ? content : content, base64: !isTextKind ? base64 || content : base64 });
  } catch (e) {
    const m = (e as Error).message;
    bad('PARSE_FAILED', `解析失败：${m}`);
  }
  const m: Material = {
    id: nextId('materials'),
    creatorId: uid,
    title: String(b.title || path.basename(fileName, path.extname(fileName))),
    kind: parsed.kind,
    ext: parsed.ext,
    size: parsed.size,
    fileName,
    ...(parsed.layerNames ? { layerNames: parsed.layerNames } : {}),
    ...(parsed.entityCount !== undefined ? { entityCount: parsed.entityCount } : {}),
    ...(parsed.patternSvg ? { patternSvg: parsed.patternSvg } : {}),
    ...(parsed.objPreview ? { objPreview: parsed.objPreview } : {}),
    ...(parsed.cover ? { cover: parsed.cover } : {}),
    ...(parsed.width !== undefined ? { width: parsed.width } : {}),
    ...(parsed.height !== undefined ? { height: parsed.height } : {}),
    ...(parsed.note ? { note: parsed.note } : {}),
    ...(parsed.parseWarn ? { parseWarn: parsed.parseWarn } : {}),
    tags,
    createdAt: nowIso(),
  };
  db.materials.push(m);
  touch();
  res.json(ok(m));
}));

materialsRouter.get('/materials', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const mine = String(req.query.mine || '1') !== '0';
  const kind = req.query.kind ? String(req.query.kind) : undefined;
  const kw = req.query.kw ? String(req.query.kw) : undefined;
  const userId = req.query.userId ? Number(req.query.userId) : uid;
  let list = db.materials.filter((m) => (mine ? m.creatorId === userId : true));
  if (kind) list = list.filter((m) => m.kind === kind);
  if (kw) list = list.filter((m) => (m.title + m.fileName + m.tags.join(' ')).toLowerCase().includes(kw.toLowerCase()));
  list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const paged = paginate(list, page, pageSize);
  const group = db.materials.filter((m) => m.creatorId === userId).reduce<Record<string, number>>((acc, m) => {
    acc[m.kind] = (acc[m.kind] || 0) + 1;
    return acc;
  }, {});
  res.json(ok({ ...paged, group }));
}));

materialsRouter.get('/materials/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const m = db.materials.find((x) => x.id === id);
  if (!m) notFound('素材不存在');
  res.json(ok(m));
}));

materialsRouter.delete('/materials/:id', wrap(async (req, res) => {
  const uid = currentUserId(req);
  const id = Number(req.params.id);
  const m = db.materials.find((x) => x.id === id);
  if (!m) notFound('素材不存在');
  if (m.creatorId !== uid) deny('只能删除自己的素材');
  const usedByWork = db.works.some((w) => w.creatorId === uid && (w.patternMatIds.includes(id) || w.modelMatIds.includes(id)));
  const usedByWindow = db.windows.some((w) => w.creatorId === uid && (w.patternMatIds.includes(id) || w.modelMatIds.includes(id)));
  if (usedByWork || usedByWindow) bad('MATERIAL_IN_USE', '素材正被作品/橱窗材料使用，无法删除');
  db.materials = db.materials.filter((x) => x.id !== id);
  touch();
  res.json(ok({ deleted: true }));
}));
