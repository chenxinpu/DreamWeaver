/**
 * 织梦 DreamWeaver v2 后端入口
 * Node + Express + TypeScript；内存库 + data/db.json 原子写盘；纯 JS 依赖。
 */
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { loadOrSeed, db, saveNow } from './db/store';
import { errorMiddleware } from './utils/resp';
import { authRequired } from './middleware/auth';
import { buildApiRouter } from './routes';
import { startScheduler } from './engine/scheduler';
import { startOfDayKey, dateKeyNow } from './utils/time';
import { evalPool } from './engine/pool';

const PORT = Number(process.env.PORT || 8787);

/**
 * 游客可访问的公开接口（浏览信息流 / 商城 / 素材预览等只读能力，无需登录）。
 * 互动（点赞/评论/下单/上架等）仍要求登录。
 */
function isPublicApi(req: express.Request): boolean {
  const p = req.path;
  const isGet = req.method === 'GET' || req.method === 'HEAD';
  if (isGet) {
    if (p === '/feed' || p.startsWith('/feed/')) return true;
    if (/^\/posts\/\d+$/.test(p)) return true;               // 推文详情公开（/posts/mine 等须登录）
    if (p === '/mall/products' || p.startsWith('/products/')) return true; // 商城列表/详情
    if (p === '/mall/resale') return true;                       // 二手集市公开浏览（/resale/* 仍须登录）
    if (p === '/materials/import-help' || p.startsWith('/materials/sample-content')) return true;
    if (/^\/materials\/\d+$/.test(p)) return true;               // 素材详情（3D/打版预览）
    if (p === '/pool/meta' || p === '/feed/recommend/seed') return true;
    if (p === '/health') return true;
  }
  // 浏览量计数对游客也允许（幂等演示用途）
  if (req.method === 'POST' && /^\/products\/\d+\/view$/.test(p)) return true;
  return false;
}

export function createApp(): express.Express {
  const app = express();
  // CORS 全开
  app.use(cors({ origin: true, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '15mb' }));   // 图片 base64（≤3MB 原始）上传用
  app.use(express.text({ limit: '15mb', type: ['text/plain', 'application/octet-stream', 'application/dxf', 'model/obj', 'image/svg+xml'] }));

  // 健康检查
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'up', version: '2.0.0', port: PORT, time: new Date().toISOString(), entities: { users: db.users.length, posts: db.posts.length, products: db.products.length, orders: db.orders.length } } });
  });

  // 鉴权（登录/切换 + 游客可访问的公开只读接口除外）
  app.use('/api', (req, res, next) => {
    const p = req.path;
    if (p === '/auth/login' || p === '/auth/switch' || isPublicApi(req)) { next(); return; }
    authRequired(req, res, next);
  });

  app.use('/api', buildApiRouter());

  // 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, code: 'NOT_FOUND', msg: '接口不存在（请对照 ITER_V2_SPEC §4）' });
  });
  app.use(errorMiddleware);
  return app;
}

// 独立启动（tsx/node 直接运行本文件）
if (require.main === module) {
  const seeded = loadOrSeed().seeded;
  // 若 db 缺失时是全新 seed，首启顺手把当日资源池跑一遍，保证演示状态一致
  if (seeded) {
    try {
      const r = evalPool(dateKeyNow());
      console.log(`[seed] 首启资源池评估：P60=${r.p60}（n=${r.n}），今日新增入池 ${r.added.length} 条`);
    } catch (e) {
      console.error('[seed] 首启评估异常（可稍后 POST /api/dev/eval-pool）', e);
    }
  }
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`✅ 织梦 DreamWeaver v2 server 已启动 → http://localhost:${PORT}/api/health`);
    console.log(`   数据文件：data/db.json（${db.users.length} 用户 / ${db.products.length} 商品 / ${db.orders.length} 订单）`);
  });
  startScheduler();
  // 优雅退出：强制写盘
  const flush = () => { try { saveNow(); } catch { /* ignore */ } process.exit(0); };
  process.on('SIGINT', flush);
  process.on('SIGTERM', flush);
}

// 启动顺序说明供引用
export const bootInfo = { port: PORT, startOfDayKey, dateKeyNow };
void fs;
