/**
 * Seed 演示数据（ITER_V2_SPEC §6）：
 * - 用户 1 小织(creator)/2 鹿屿Lu/3 云端裁缝铺/… /14 我的小号(consumer,预置体型)/99 审核员
 * - samples/*.dxf|.obj|.svg 真实示例文件 → 程序解析入库为 creator1 素材
 * - creator1 今日推文 2 篇「差一点达标」+ 1 篇「高赞入池」；其他创作者今日推文 8-12 篇形成 P60
 * - 已上架商品 2 件（含完整 aiDetail）+ 审核中 1 件 + 被拒 1 件
 * - 过去 30 天订单/浏览/退款事件种子（BI 曲线）+ 二手挂单 + 已收货可退货定制订单
 */
import fs from 'fs';
import path from 'path';
import type { DB, User, Material, Work, Post, PoolEntry, WindowMaterial, Product, Order, ResaleListing, BodyMeasurement, WindowSpec } from '../types';
import { emptyDb, replaceDb, saveNow, SAMPLES_DIR } from './store';
import { fmtTs, dateKeyNow, daysAgo, dateKeyOf } from '../utils/time';
import { r2, mulberry32 } from '../utils/misc';
import { parseByKind } from '../parsers';
import { buildDressFrontDxf, buildShirtFrontDxf, buildDressObj, buildFloralSvg } from '../parsers/samples';
import { auditWindow } from '../engine/window';
import { settleDueCommissions } from '../engine/commission';
import { notify, ledger } from '../engine/helpers';

/* ---------------- 常量：演示账号 / 图片 ---------------- */

export const DEMO_ACCOUNTS = [
  { id: 1, nickname: '小织', avatar: '/images/avatar-01.jpg', level: 3 as const, role: 'creator' as const, bio: '独立设计师｜专注法式浪漫风', followers: 128000, following: 236 },
  { id: 2, nickname: '鹿屿Lu', avatar: '/images/avatar-02.jpg', level: 3 as const, role: 'creator' as const, bio: '主理人｜做有温度的衣服', followers: 86200, following: 112 },
  { id: 3, nickname: '云端裁缝铺', avatar: '/images/avatar-03.jpg', level: 2 as const, role: 'creator' as const, bio: '从打版师到设计师｜分享工艺细节', followers: 45100, following: 328 },
  { id: 4, nickname: '莓莓酱', avatar: '/images/avatar-04.jpg', level: 1 as const, role: 'creator' as const, bio: '设计学徒学习中～', followers: 8900, following: 1204 },
  { id: 5, nickname: 'Ginger阿姜', avatar: '/images/avatar-05.jpg', level: 2 as const, role: 'creator' as const, bio: '复古工装爱好者', followers: 22300, following: 465 },
  { id: 6, nickname: '山茶与猫', avatar: '/images/avatar-06.jpg', level: 1 as const, role: 'consumer' as const, bio: '记录穿搭灵感', followers: 5600, following: 890 },
  { id: 7, nickname: '四月的裙子', avatar: '/images/avatar-07.jpg', level: 0 as const, role: 'consumer' as const, bio: '四月到了就想穿裙子', followers: 1200, following: 356 },
  { id: 8, nickname: '木棉设计工作室', avatar: '/images/avatar-08.jpg', level: 3 as const, role: 'creator' as const, bio: '木棉棉麻 · 东方美学', followers: 156000, following: 89 },
  { id: 9, nickname: '眠眠兔', avatar: '/images/avatar-09.jpg', level: 1 as const, role: 'creator' as const, bio: '软妹风设计师', followers: 18700, following: 632 },
  { id: 10, nickname: '针织日记', avatar: '/images/avatar-10.jpg', level: 2 as const, role: 'creator' as const, bio: '手织毛衫的温度', followers: 33400, following: 214 },
  { id: 11, nickname: 'Momo莫莫', avatar: '/images/avatar-11.jpg', level: 0 as const, role: 'consumer' as const, bio: '求推荐通勤穿搭！', followers: 860, following: 458 },
  { id: 12, nickname: '丝语Silk', avatar: '/images/avatar-12.jpg', level: 2 as const, role: 'creator' as const, bio: '真丝面料研究员', followers: 41200, following: 178 },
  { id: 13, nickname: '青禾定制', avatar: '/images/avatar-13.jpg', level: 3 as const, role: 'creator' as const, bio: '轻定制西装｜一人一版', followers: 97400, following: 96 },
  { id: 14, nickname: '我的小号', avatar: '/images/avatar-14.jpg', level: 0 as const, role: 'consumer' as const, bio: '', followers: 12, following: 108 },
  { id: 15, nickname: '小岛花事', avatar: '/images/avatar-15.jpg', level: 1 as const, role: 'creator' as const, bio: '碎花爱好者', followers: 7300, following: 556 },
  { id: 16, nickname: '白鹭Ling', avatar: '/images/avatar-16.jpg', level: 2 as const, role: 'creator' as const, bio: '极简通勤｜白衬衫狂魔', followers: 28900, following: 302 },
  { id: 17, nickname: '碎星', avatar: '/images/avatar-17.jpg', level: 1 as const, role: 'creator' as const, bio: '正在学打版', followers: 4200, following: 733 },
  { id: 18, nickname: '凉拌冰沙', avatar: '/images/avatar-18.jpg', level: 0 as const, role: 'consumer' as const, bio: '观望中…', followers: 90, following: 210 },
  { id: 99, nickname: '平台审核专员', avatar: '/images/avatar-05.jpg', level: 0 as const, role: 'auditor' as const, bio: '织梦平台内容审核 · 橱窗材料复核', followers: 0, following: 0 },
] as const;

const IMG = (n: string) => `/images/${n}`;
const BODY_14: BodyMeasurement = { height: 163, weight: 52, bust: 84, underBust: 74, waist: 64, hip: 90, shoulderWidth: 38, armLength: 54, thigh: 51, calf: 34, neck: 33, backLength: 39, source: 'manual', updatedAt: fmtTs(daysAgo(3)) };

/* ---------------- 工具 ---------------- */

function at(ts: number): string { return fmtTs(ts); }
function hourOf(dayAge: number, h = 10, m = 0): number { return daysAgo(dayAge, h, m) + Math.floor(Math.random() * 30) * 60000; }

const random = mulberry32(20260101);
const pickC = <T>(arr: T[]): T => arr[Math.floor(random() * arr.length)];

/* ==================== 主 seed ==================== */

export function resetData(seed = true): void {
  // 直接重建 store 的全局内存库：引擎/通知/资金流水全部写同一对象
  const fresh = emptyDb();
  replaceDb(fresh);
  const db: DB = fresh;
  if (!seed) { saveNow(); return; }
  const push = {
    user: (u: User) => { db.users.push(u); return u; },
    material: (m: Material) => { db.materials.push(m); return m; },
    work: (w: Work) => { db.works.push(w); return w; },
    post: (p: Post) => { db.posts.push(p); return p; },
    pool: (e: PoolEntry) => { db.pool.push(e); return e; },
    window: (w: WindowMaterial) => { db.windows.push(w); return w; },
    product: (p: Product) => { db.products.push(p); return p; },
    order: (o: Order) => { db.orders.push(o); return o; },
    resale: (r: ResaleListing) => { db.resale.push(r); return r; },
  };
  let id = 0;
  const N = (k: string) => { db.seq[k] = (db.seq[k] || 0) + 1; return db.seq[k]; };

  /* ---------- 用户 ---------- */
  const followsSeed: Record<number, number[]> = {
    1: [2, 3, 12], 2: [1, 3, 12], 3: [1, 2, 12], 4: [1, 3, 9], 5: [1, 16],
    6: [1, 3], 7: [1, 2], 8: [1, 2], 9: [1, 3], 10: [1, 3],
    11: [1, 2, 3, 5, 9, 10, 16], 12: [1, 3], 13: [1], 14: [1, 2, 3, 5, 10, 16], 15: [1, 9], 16: [1, 2], 17: [3, 12], 18: [1, 2, 3, 4, 5, 9, 10, 12, 15, 16], 99: [],
  };
  const usersById = new Map<number, User>();
  for (const a of DEMO_ACCOUNTS) {
    const u: User = {
      id: a.id, nickname: a.nickname, avatar: a.avatar, bio: a.bio,
      role: a.role, level: a.level, followers: a.followers, following: a.following,
      createdAt: at(daysAgo(120 + a.id * 3)),
      follows: followsSeed[a.id] || [],
      ...(a.id === 14 ? { body: BODY_14 } : {}),
    };
    usersById.set(a.id, u);
    push.user(u);
  }
  db.seq.users = 99;

  /* ---------- samples 真实文件 → 素材库 ---------- */
  if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  const sampleFiles: { name: string; content: string | Buffer }[] = [
    { name: 'dress-front-pattern.dxf', content: buildDressFrontDxf() },
    { name: 'shirt-front.dxf', content: buildShirtFrontDxf() },
    { name: 'dress.obj', content: buildDressObj() },
    { name: 'floral-print.svg', content: buildFloralSvg() },
  ];
  for (const f of sampleFiles) fs.writeFileSync(path.join(SAMPLES_DIR, f.name), f.content);

  /** 用真实解析产物建素材 */
  function addParsedMaterial(ownerId: number, title: string, fileName: string, kind: 'dxf' | 'obj' | 'svg', content: string, tags: string[] = []): Material {
    const parsed = parseByKind({ kind, ext: kind, fileName, text: content });
    const m: Material = {
      id: N('materials'),
      creatorId: ownerId, title, kind, ext: kind, size: parsed.size, fileName,
      ...(parsed.layerNames ? { layerNames: parsed.layerNames } : {}),
      ...(parsed.entityCount !== undefined ? { entityCount: parsed.entityCount } : {}),
      ...(parsed.patternSvg ? { patternSvg: parsed.patternSvg } : {}),
      ...(parsed.objPreview ? { objPreview: parsed.objPreview } : {}),
      ...(parsed.cover ? { cover: parsed.cover } : {}),
      ...(parsed.width !== undefined ? { width: parsed.width } : {}),
      ...(parsed.height !== undefined ? { height: parsed.height } : {}),
      ...(parsed.note ? { note: parsed.note } : {}),
      ...(parsed.parseWarn ? { parseWarn: parsed.parseWarn } : {}),
      tags, createdAt: at(daysAgo(30)),
    };
    push.material(m);
    return m;
  }
  /** 官方图片作素材（轻量引用） */
  function addImageMaterial(ownerId: number, title: string, img: string, tags: string[] = [], size = 120_000): Material {
    const m: Material = { id: N('materials'), creatorId: ownerId, title, kind: 'jpg', ext: 'jpg', size, fileName: img.split('/').pop() || 'photo.jpg', cover: img, tags, createdAt: at(daysAgo(20)) };
    push.material(m);
    return m;
  }

  const dxfFront = buildDressFrontDxf(); const dxfShirt = buildShirtFrontDxf(); const objDress = buildDressObj(); const svgFloral = buildFloralSvg();
  // creator1 素材
  const m1DressPattern = addParsedMaterial(1, '法式连衣裙 · 前片打版(DXF)', 'dress-front-pattern.dxf', 'dxf', dxfFront, ['连衣裙', '打版', '前片']);
  const m1ShirtPattern = addParsedMaterial(1, '泡泡纱衬衫 · 前片打版(DXF)', 'shirt-front.dxf', 'dxf', dxfShirt, ['衬衫', '打版']);
  const m1DressObj = addParsedMaterial(1, '法式连衣裙 · 3D 网格(OBJ)', 'dress.obj', 'obj', objDress, ['连衣裙', '3D']);
  const m1Floral = addParsedMaterial(1, '花间集 · 碎花印花(SVG)', 'floral-print.svg', 'svg', svgFloral, ['印花', '碎花']);
  const m1Pic1 = addImageMaterial(1, '连衣裙真人穿搭 1', IMG('style-01.jpg'), ['穿搭'], 89_000);
  const m1Pic2 = addImageMaterial(1, '连衣裙真人穿搭 2', IMG('style-05.jpg'), ['穿搭'], 88_000);
  const m1Pic3 = addImageMaterial(1, '面料细节 · 真丝', IMG('fabric-03.jpg'), ['面料'], 64_000);
  const m1Pic4 = addImageMaterial(1, '成衣平铺图', IMG('dress-01.jpg'), ['成衣'], 92_000);
  // creator2 素材（大衣）
  const m2Pattern = addParsedMaterial(2, '雾色大衣 · 前片打版(DXF)', 'shirt-front.dxf', 'dxf', dxfShirt, ['外套', '打版']);
  const m2Obj = addParsedMaterial(2, '雾色大衣 · 3D 网格(OBJ)', 'dress.obj', 'obj', objDress, ['外套', '3D']);
  const m2Pic1 = addImageMaterial(2, '大衣真人穿搭', IMG('style-03.jpg'), ['穿搭'], 87_000);
  const m2Pic2 = addImageMaterial(2, '大衣成衣', IMG('coat-02.jpg'), ['成衣'], 96_000);
  // creator3 素材
  const m3Pattern = addParsedMaterial(3, '泡泡纱衬衫 · 前片(DXF)', 'shirt-front.dxf', 'dxf', dxfShirt, ['衬衫', '打版']);
  const m3Obj = addParsedMaterial(3, '衬衫 3D(OBJ)', 'dress.obj', 'obj', objDress, ['衬衫', '3D']);
  const m3Pic1 = addImageMaterial(3, '衬衫真人上身', IMG('style-08.jpg'), ['穿搭'], 78_000);
  const m3Pic2 = addImageMaterial(3, '泡泡纱衬衫', IMG('blouse-02.jpg'), ['成衣'], 90_000);

  /* ---------- 作品 ---------- */
  function addWork(opts: Partial<Work> & { title: string; category: string; creatorId: number; styleTags: string[]; cover: string; patternMatIds?: number[]; modelMatIds?: number[] }): Work {
    const w: Work = {
      id: N('works'),
      creatorId: opts.creatorId, title: opts.title, category: opts.category,
      styleTags: opts.styleTags, fabric: opts.fabric || '', desc: opts.desc || '',
      cover: opts.cover, patternMatIds: opts.patternMatIds || [], modelMatIds: opts.modelMatIds || [],
      mediaImages: opts.mediaImages || [], createdAt: opts.createdAt || at(daysAgo(20)),
    };
    push.work(w);
    return w;
  }
  const w1 = addWork({ creatorId: 1, title: '法式碎花泡泡袖连衣裙', category: '连衣裙', styleTags: ['法式', '碎花', '泡泡袖'], fabric: '100% 真丝', desc: '灵感来自南法仲夏花园，细密碎花与复古泡泡袖结合，收腰显瘦。', cover: IMG('dress-01.jpg'), patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id], mediaImages: [IMG('dress-01.jpg'), IMG('style-01.jpg'), IMG('style-05.jpg')], createdAt: at(daysAgo(40)) });
  const w2 = addWork({ creatorId: 1, title: '微醺玫瑰 · 缎面吊带连衣裙', category: '连衣裙', styleTags: ['法式', '缎面', '吊带'], fabric: '醋酸缎面', desc: '缎面微光，约会之夜的主角。', cover: IMG('dress-18.jpg'), patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id], mediaImages: [IMG('dress-18.jpg'), IMG('style-02.jpg')], createdAt: at(daysAgo(26)) });
  const w3 = addWork({ creatorId: 1, title: '蓝调波点 · 方领连衣裙', category: '连衣裙', styleTags: ['法式', '波点', '方领'], fabric: '高支棉', desc: '波点与方领的复古甜心组合，等待市场验证中。', cover: IMG('dress-03.jpg'), patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id], mediaImages: [IMG('dress-03.jpg'), IMG('style-04.jpg')], createdAt: at(daysAgo(12)) });
  const w4 = addWork({ creatorId: 1, title: '初夏微风 · 泡泡纱衬衫', category: '衬衫', styleTags: ['通勤', '清爽', '泡泡纱'], fabric: '泡泡纱棉', desc: '泡泡纱自带空气感，夏日不闷热。', cover: IMG('blouse-02.jpg'), patternMatIds: [m1ShirtPattern.id], modelMatIds: [m1DressObj.id], mediaImages: [IMG('blouse-02.jpg'), IMG('style-08.jpg')], createdAt: at(daysAgo(9)) });
  const w5 = addWork({ creatorId: 1, title: '雾屿羊毛 · 半裙', category: '半裙', styleTags: ['韩系', '羊毛', '半裙'], fabric: '羊毛混纺', desc: '雾灰半裙的松弛与利落。', cover: IMG('skirt-02.jpg'), patternMatIds: [m1ShirtPattern.id], modelMatIds: [m1DressObj.id], mediaImages: [IMG('skirt-02.jpg'), IMG('style-03.jpg')], createdAt: at(daysAgo(6)) });
  const w2c = addWork({ creatorId: 2, title: '雾色晨雾 · 羊毛混纺大衣', category: '外套', styleTags: ['韩系', '极简', '大衣'], fabric: '70%羊毛混纺', desc: '廓形利落，双层工艺保暖不臃肿。', cover: IMG('coat-02.jpg'), patternMatIds: [m2Pattern.id], modelMatIds: [m2Obj.id], mediaImages: [IMG('coat-02.jpg'), IMG('style-03.jpg')], createdAt: at(daysAgo(35)) });
  const w3c = addWork({ creatorId: 3, title: '初夏微风 · 泡泡纱衬衫', category: '衬衫', styleTags: ['通勤', '清爽', '泡泡纱'], fabric: '泡泡纱棉', desc: '为通勤定制的泡泡纱衬衫。', cover: IMG('blouse-02.jpg'), patternMatIds: [m3Pattern.id], modelMatIds: [m3Obj.id], mediaImages: [IMG('blouse-02.jpg'), IMG('style-08.jpg')], createdAt: at(daysAgo(22)) });

  /* ---------- 推文 ---------- */
  const COMMENTS_POOL = [
    '救命！这也太好看了吧😍', '请问会显肩宽吗？', '蹲一个价格！', '面料质感看起来很好', '已收藏，等上架～', '这种版型对梨形友好吗', '太仙了吧', '想看更多细节图！', '夏天穿一定很凉快', '能不能出短款呀', '已下单！期待', '返图来了，绝绝子', '同款不同色会补货吗', '版型数据在哪里看', '可以私人定制吗', '超喜欢这个配色', '求生产周期', '腰带是送的嘛', '怎么清洗呀', '冲了冲了', '太适合通勤了', '这个领口太显瘦了'];
  function addPost(opts: { authorId: number; workId?: number; content: string; images?: string[]; tags?: string[]; likes: number; dayAge: number; comments?: number; hour?: number; patternMatIds?: number[]; modelMatIds?: number[] }): Post {
    const ts = hourOf(opts.dayAge, opts.hour ?? (10 + (opts.authorId % 8)), opts.authorId % 60);
    const p: Post = {
      id: N('posts'),
      authorId: opts.authorId,
      ...(opts.workId ? { workId: opts.workId } : {}),
      content: opts.content,
      images: opts.images || [],
      tags: opts.tags || [],
      createdAt: at(ts),
      dateKey: dateKeyOf(ts),
      likes: opts.likes,
      likedBy: [],
      comments: [],
      commentCount: 0,
      shareCount: Math.floor(opts.likes / 11),
      ...(opts.patternMatIds ? { patternMatIds: opts.patternMatIds } : {}),
      ...(opts.modelMatIds ? { modelMatIds: opts.modelMatIds } : {}),
    };
    const nComments = opts.comments ?? Math.min(6, Math.max(0, Math.floor(opts.likes / 160)));
    const authors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].filter((x) => x !== opts.authorId);
    for (let i = 0; i < nComments; i++) {
      p.comments.push({ id: N('comments'), userId: pickC(authors), content: pickC(COMMENTS_POOL), createdAt: at(ts + (i + 1) * 3600_000), likes: Math.floor(random() * 40) });
    }
    p.commentCount = p.comments.length;
    push.post(p);
    return p;
  }

  // —— creator1 历史推文（形成「已入池」链条）——
  const postW1 = addPost({ authorId: 1, workId: w1.id, dayAge: 13, likes: 3420, comments: 12, hour: 9, content: '南法的夏天藏在碎花里🌿 「法式碎花泡泡袖连衣裙」打版完成！真丝垂坠感绝了，泡泡袖一点也不显肩宽～\n#法式穿搭 #碎花 #原创设计', images: [IMG('dress-01.jpg'), IMG('style-01.jpg')], tags: ['法式穿搭', '碎花', '原创设计'], patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id] });
  const postW2 = addPost({ authorId: 1, workId: w2.id, dayAge: 6, likes: 2310, comments: 8, hour: 11, content: '微醺玫瑰🌹 缎面吊带裙的试穿反馈来啦，光泽感太适合约会了！\n#法式 #缎面 #吊带裙', images: [IMG('dress-18.jpg'), IMG('style-02.jpg')], tags: ['法式', '缎面', '吊带裙'], patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id] });

  // —— creator1 今日推文：2 差一点 + 1 高赞入池 ——
  const postTodayNear1 = addPost({ authorId: 1, workId: w4.id, dayAge: 0, likes: 520, comments: 6, hour: 9, content: '初夏微风🍃 泡泡纱衬衫的新版片终于定稿！自带空气感，通勤穿一整天都不闷～就差大家的认可啦！\n#通勤穿搭 #衬衫 #原创设计', images: [IMG('blouse-02.jpg'), IMG('style-08.jpg')], tags: ['通勤穿搭', '衬衫', '原创设计'], patternMatIds: [m1ShirtPattern.id], modelMatIds: [m1DressObj.id] });
  const postTodayNear2 = addPost({ authorId: 1, workId: w5.id, dayAge: 0, likes: 458, comments: 4, hour: 12, content: '雾屿羊毛半裙 2.0 试穿🎀 雾灰的松弛感很难不爱，评论破 10 就能进资源池，帮帮我～\n#半裙 #韩系 #羊毛', images: [IMG('skirt-02.jpg'), IMG('style-03.jpg')], tags: ['半裙', '韩系', '羊毛'], patternMatIds: [m1ShirtPattern.id] });
  const postTodayHigh = addPost({ authorId: 1, workId: w3.id, dayAge: 0, likes: 1320, comments: 9, hour: 15, content: '蓝调波点 · 方领连衣裙 打版首秀💙 复古甜心的日常与度假都能驾驭，感谢大家的点赞冲上今天前几名！\n#法式 #波点 #方领 #连衣裙', images: [IMG('dress-03.jpg'), IMG('style-04.jpg')], tags: ['法式', '波点', '方领'], patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id] });

  // —— 其他创作者今日推文 9 篇（点赞形成 P60 分布）——
  const otherToday: { authorId: number; workId?: number; likes: number; comments: number; content: string; tags: string[]; images: string[] }[] = [
    { authorId: 2, workId: w2c.id, likes: 812, comments: 8, content: '「雾色晨雾」大衣羊毛面料到货，70% 澳洲羊毛手感真的绝了～今晚直播看细节。\n#羊毛大衣 #韩系穿搭', tags: ['羊毛大衣', '韩系穿搭'], images: [IMG('coat-02.jpg'), IMG('fabric-03.jpg')] },
    { authorId: 3, workId: w3c.id, likes: 933, comments: 10, content: '打版小课堂｜泡泡纱衬衫从纸样到成衣的细节，今天上新啦！\n#打版 #衬衫 #工艺', tags: ['打版', '衬衫', '工艺'], images: [IMG('blouse-02.jpg'), IMG('craft-01.jpg')] },
    { authorId: 5, likes: 705, comments: 7, content: '工装半裙×3 种穿法，一条裙子穿出三种风格。\n#工装风 #半裙', tags: ['工装风', '半裙'], images: [IMG('skirt-01.jpg'), IMG('style-03.jpg')] },
    { authorId: 9, likes: 560, comments: 5, content: '甜心波点裙细节图来了！收腰+伞摆，梨形也能放心冲。\n#波点 #复古', tags: ['波点', '复古'], images: [IMG('dress-03.jpg')] },
    { authorId: 10, likes: 648, comments: 6, content: '手织的第 12 件毛衣完工，羊毛混纺软到想埋进去🧶\n#针织 #手作', tags: ['针织', '手作'], images: [IMG('knit-01.jpg')] },
    { authorId: 12, likes: 502, comments: 4, content: '真丝小课堂：桑蚕丝 vs 柞蚕丝，选购记得看克重。\n#面料知识 #真丝', tags: ['面料知识', '真丝'], images: [IMG('fabric-03.jpg')] },
    { authorId: 15, likes: 388, comments: 11, content: '南法假日碎花短裙买家返图来了！评论区姐妹们太会拍了✨\n#碎花 #法式', tags: ['碎花', '法式'], images: [IMG('skirt-03.jpg'), IMG('style-02.jpg')] },
    { authorId: 16, likes: 445, comments: 3, content: '白衬衫重度患者的第 17 件：泡泡纱通勤款，清爽利落。\n#通勤穿搭 #白衬衫', tags: ['通勤穿搭', '白衬衫'], images: [IMG('blouse-02.jpg'), IMG('style-08.jpg')] },
    { authorId: 4, likes: 310, comments: 2, content: '设计学徒第一次打版作业通过啦！两周的成果🥳\n#学习打卡 #设计', tags: ['学习打卡', '设计'], images: [IMG('dress-15.jpg'), IMG('style-09.jpg')] },
  ];
  for (const t of otherToday) addPost({ authorId: t.authorId, workId: t.workId, dayAge: 0, likes: t.likes, comments: t.comments, hour: 8 + (t.authorId % 7), content: t.content, images: t.images, tags: t.tags });

  // —— 其它创作者历史推文 ——
  const postW2c = addPost({ authorId: 2, workId: w2c.id, dayAge: 11, likes: 1660, comments: 6, hour: 10, content: '雾色晨雾大衣 3D 试穿效果来了！双面呢的垂坠感在虚拟模特上也很能打。\n#大衣 #羊毛 #韩系', images: [IMG('coat-02.jpg'), IMG('style-03.jpg')], tags: ['大衣', '羊毛', '韩系'] });
  addPost({ authorId: 3, dayAge: 2, likes: 1280, comments: 9, content: '连衣裙从纸样到胚布的全过程｜每一步都是细节✂️\n#打版 #工艺', images: [IMG('craft-01.jpg'), IMG('craft-02.jpg')], tags: ['打版', '工艺'] });
  addPost({ authorId: 5, dayAge: 3, likes: 1680, comments: 5, content: '直筒半裙的大口袋设计，复古工装感十足。\n#工装 #半裙', images: [IMG('skirt-01.jpg'), IMG('style-04.jpg')], tags: ['工装', '半裙'] });
  addPost({ authorId: 12, dayAge: 4, likes: 1980, comments: 7, content: '真丝缎面半裙，行走间流光溢彩。\n#真丝 #缎面', images: [IMG('skirt-02.jpg')], tags: ['真丝', '缎面'] });
  addPost({ authorId: 8, dayAge: 1, likes: 620, comments: 4, content: '东方美学与棉麻：亚麻衬衫裙的松弛感。\n#东方美学 #棉麻', images: [IMG('dress-11.jpg'), IMG('fabric-02.jpg')], tags: ['东方美学', '棉麻'] });

  /* ---------- 资源池（历史条目直接入池；今日的由引擎评估产生） ---------- */
  function addPool(entry: Omit<PoolEntry, 'id'>): PoolEntry {
    const e: PoolEntry = { id: N('pool'), ...entry };
    push.pool(e);
    return e;
  }
  addPool({ postId: postW1.id, workId: w1.id, creatorId: 1, qualifiedAt: at(daysAgo(13)), dateKey: dateKeyOf(daysAgo(13)), reason: '点赞超过当日P60 / 评论数≥10', likeP60: 680, likeAtQualify: 3420, commentAtQualify: 12, notifiedAt: at(daysAgo(13)) });
  addPool({ postId: postW2.id, workId: w2.id, creatorId: 1, qualifiedAt: at(daysAgo(6)), dateKey: dateKeyOf(daysAgo(6)), reason: '点赞超过当日P60', likeP60: 540, likeAtQualify: 2310, commentAtQualify: 8, notifiedAt: at(daysAgo(6)) });
  addPool({ postId: postW2c.id, workId: w2c.id, creatorId: 2, qualifiedAt: at(daysAgo(10)), dateKey: dateKeyOf(daysAgo(10)), reason: '点赞超过当日P60', likeP60: 480, likeAtQualify: 1660, commentAtQualify: 6, notifiedAt: at(daysAgo(10)) });
  void postTodayNear1; void postTodayNear2; void postTodayHigh;

  /* ---------- 橱窗与商品（通过审核引擎生成 AI 详情） ---------- */
  const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  const sizeChart = (sizes: { size: string; bust: number; waist: number; hip: number; shoulder: number; sleeve: number; length: number }[]) => sizes;
  function approveWindowProduct(opts: {
    creatorId: number; work: Work; productName: string; category: string; styleTags: string[]; price: number; baseFee: number;
    photos: string[]; partsFabric: { part: string; fabric: string; note?: string }[]; chart: WindowSpec['sizeChart'];
    dayAge: number; patternMatIds: number[]; modelMatIds: number[]; cover: string;
  }): { window: WindowMaterial; product: Product } {
    const createdAt = at(daysAgo(opts.dayAge + 1));
    const win: WindowMaterial = {
      id: N('windows'), creatorId: opts.creatorId, workId: opts.work.id,
      status: 'submitted', photos: opts.photos, partsFabric: opts.partsFabric,
      spec: { label: '标准成衣版', sizeChart: opts.chart },
      productName: opts.productName, category: opts.category, styleTags: opts.styleTags,
      price: opts.price, baseFee: opts.baseFee,
      patternMatIds: opts.patternMatIds, modelMatIds: opts.modelMatIds,
      auditLog: [], createdAt, updatedAt: createdAt,
    };
    push.window(win);
    const res = auditWindow(win); // 同步审核并自动上架
    if (!res.pass || !res.product) throw new Error('seed 橱窗审核失败');
    const product = res.product;
    // 时间回拨到历史时点
    win.updatedAt = at(daysAgo(opts.dayAge));
    win.createdAt = createdAt;
    if (win.auditLog && win.auditLog.length) win.auditLog[0].at = at(daysAgo(opts.dayAge));
    product.createdAt = at(daysAgo(opts.dayAge));
    product.cover = opts.cover;
    return { window: win, product };
  }
  const { product: p1 } = approveWindowProduct({
    creatorId: 1, work: w1, productName: '法式碎花泡泡袖连衣裙', category: '连衣裙', styleTags: ['法式', '碎花', '泡泡袖'], price: 328, baseFee: 68,
    photos: [IMG('style-01.jpg'), IMG('style-05.jpg'), IMG('dress-01.jpg')],
    partsFabric: [{ part: '面料', fabric: '100% 桑蚕丝', note: '垂坠感强' }, { part: '内衬', fabric: '高支棉' }, { part: '袖', fabric: '同面料泡泡袖' }],
    chart: sizeChart([
      { size: 'XS', bust: 78, waist: 62, hip: 84, shoulder: 37, sleeve: 56, length: 112 },
      { size: 'S', bust: 82, waist: 66, hip: 88, shoulder: 38, sleeve: 58, length: 114 },
      { size: 'M', bust: 86, waist: 70, hip: 92, shoulder: 39, sleeve: 60, length: 116 },
      { size: 'L', bust: 92, waist: 76, hip: 98, shoulder: 41, sleeve: 62, length: 118 },
      { size: 'XL', bust: 98, waist: 82, hip: 104, shoulder: 42, sleeve: 63, length: 120 },
    ]),
    dayAge: 12, patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id], cover: IMG('dress-01.jpg'),
  });
  const { product: p2 } = approveWindowProduct({
    creatorId: 1, work: w2, productName: '微醺玫瑰 · 缎面吊带连衣裙', category: '连衣裙', styleTags: ['法式', '缎面', '吊带'], price: 299, baseFee: 79,
    photos: [IMG('style-02.jpg'), IMG('dress-18.jpg')],
    partsFabric: [{ part: '面料', fabric: '醋酸缎面' }, { part: '里布', fabric: '天丝棉' }],
    chart: sizeChart([
      { size: 'XS', bust: 76, waist: 60, hip: 84, shoulder: 34, sleeve: 0, length: 104 },
      { size: 'S', bust: 80, waist: 64, hip: 88, shoulder: 35, sleeve: 0, length: 106 },
      { size: 'M', bust: 84, waist: 68, hip: 92, shoulder: 36, sleeve: 0, length: 108 },
      { size: 'L', bust: 90, waist: 74, hip: 98, shoulder: 38, sleeve: 0, length: 110 },
    ]),
    dayAge: 5, patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id], cover: IMG('dress-18.jpg'),
  });
  // creator2 大衣 / creator3 衬衫
  const { product: p2c } = approveWindowProduct({
    creatorId: 2, work: w2c, productName: '雾色晨雾 · 羊毛混纺大衣', category: '外套', styleTags: ['韩系', '极简', '大衣'], price: 899, baseFee: 159,
    photos: [IMG('style-03.jpg'), IMG('coat-02.jpg')],
    partsFabric: [{ part: '大身', fabric: '70%羊毛混纺' }, { part: '里布', fabric: '铜氨丝' }],
    chart: sizeChart([
      { size: 'S', bust: 102, waist: 92, hip: 102, shoulder: 40, sleeve: 58, length: 102 },
      { size: 'M', bust: 106, waist: 96, hip: 106, shoulder: 42, sleeve: 60, length: 104 },
      { size: 'L', bust: 112, waist: 102, hip: 112, shoulder: 44, sleeve: 62, length: 106 },
      { size: 'XL', bust: 118, waist: 108, hip: 118, shoulder: 46, sleeve: 63, length: 108 },
    ]),
    dayAge: 9, patternMatIds: [m2Pattern.id], modelMatIds: [m2Obj.id], cover: IMG('coat-02.jpg'),
  });
  const { product: p3c } = approveWindowProduct({
    creatorId: 3, work: w3c, productName: '初夏微风 · 泡泡纱衬衫', category: '衬衫', styleTags: ['通勤', '清爽', '泡泡纱'], price: 199, baseFee: 49,
    photos: [IMG('style-08.jpg'), IMG('blouse-02.jpg')],
    partsFabric: [{ part: '面料', fabric: '泡泡纱棉' }, { part: '纽扣', fabric: '贝壳扣' }],
    chart: sizeChart([
      { size: 'S', bust: 96, waist: 88, hip: 96, shoulder: 39, sleeve: 56, length: 64 },
      { size: 'M', bust: 100, waist: 92, hip: 100, shoulder: 41, sleeve: 58, length: 66 },
      { size: 'L', bust: 106, waist: 98, hip: 106, shoulder: 43, sleeve: 60, length: 68 },
    ]),
    dayAge: 7, patternMatIds: [m3Pattern.id], modelMatIds: [m3Obj.id], cover: IMG('blouse-02.jpg'),
  });
  // creator1：审核中 1 件（今日入池的 W3）
  const winPending = (() => {
    const createdAt = at(daysAgo(0));
    const win: WindowMaterial = {
      id: N('windows'), creatorId: 1, workId: w3.id, status: 'submitted',
      photos: [IMG('style-04.jpg'), IMG('dress-03.jpg')],
      partsFabric: [{ part: '面料', fabric: '高支棉', note: '可换亚麻' }],
      spec: { label: '标准成衣版', sizeChart: [
        { size: 'S', bust: 84, waist: 66, hip: 90, shoulder: 38, sleeve: 56, length: 100 },
        { size: 'M', bust: 88, waist: 70, hip: 94, shoulder: 39, sleeve: 58, length: 102 },
        { size: 'L', bust: 94, waist: 76, hip: 100, shoulder: 41, sleeve: 60, length: 104 },
      ] },
      productName: '蓝调波点 · 方领连衣裙', category: '连衣裙', styleTags: ['法式', '波点', '方领'],
      price: 259, baseFee: 69, patternMatIds: [m1DressPattern.id], modelMatIds: [m1DressObj.id],
      auditLog: [], createdAt, updatedAt: createdAt,
    };
    push.window(win);
    return win;
  })();
  // creator1：被拒 1 件（W4 泡泡纱衬衫 —— 缺真人穿搭图 & 尺码档不足）
  const winRejected = (() => {
    const win: WindowMaterial = {
      id: N('windows'), creatorId: 1, workId: w4.id, status: 'rejected',
      photos: [],
      partsFabric: [{ part: '面料', fabric: '泡泡纱棉' }],
      spec: { label: '标准', sizeChart: [{ size: 'M', bust: 100, waist: 92, hip: 100, shoulder: 41, sleeve: 58, length: 66 }] },
      productName: '初夏微风 · 泡泡纱衬衫', category: '衬衫', styleTags: ['通勤', '清爽', '泡泡纱'],
      price: 199, baseFee: 49, patternMatIds: [m1ShirtPattern.id], modelMatIds: [m1DressObj.id],
      auditLog: [{ passed: false, note: '缺少：真人模特穿搭实景图（photos ≥ 1）；规格尺码表 ≥ 2 档（spec.sizeChart）；3D 结果文件（modelMatIds ≥ 1）请使用 OBJ/GLB 素材', at: at(daysAgo(3)) }],
      auditMissing: ['真人模特穿搭实景图（photos ≥ 1）', '规格尺码表 ≥ 2 档（spec.sizeChart）'],
      createdAt: at(daysAgo(5)), updatedAt: at(daysAgo(3)),
    };
    push.window(win);
    return win;
  })();
  void winPending; void winRejected; void SIZES;

  /* ---------- 过去 30 天浏览/订单/退货事件种子 ---------- */
  const CONSUMERS = [6, 7, 11, 14, 18];
  const directSizes = ['S', 'M', 'L'];
  const CHANNELS = ['广场推荐', '商城分类', '搜索', '分享', '创作者推荐'];
  const allProducts: { product: Product; viewBase: number; orderBase: number; returnProb: number; customRate: number; seed: number }[] = [
    { product: p1, viewBase: 34, orderBase: 2.8, returnProb: 0.08, customRate: 0.35, seed: 11 },
    { product: p2, viewBase: 58, orderBase: 2.0, returnProb: 0.02, customRate: 0.5, seed: 22 },
  ];
  let orderCursor = 0;
  const orderNo = (i: number) => `ZM${String(Date.now() % 100000000000).slice(0, 11)}${String(i).padStart(4, '0')}`;

  for (const cfg of allProducts) {
    const rnd = mulberry32(cfg.seed);
    const prod = cfg.product;
    for (let d = 29; d >= 0; d--) {
      const views = Math.max(6, Math.round(cfg.viewBase * (0.7 + rnd() * 0.7)));
      const dayKey = dateKeyOf(daysAgo(d));
      db.viewsByDay.push({ productId: prod.id, creatorId: prod.creatorId, dayKey, count: views });
      const nOrders = rnd() < 0.12 ? 0 : 1 + Math.floor(rnd() * 4);
      for (let k = 0; k < nOrders; k++) {
        const buyerId = pickC(CONSUMERS);
        const custom = rnd() < cfg.customRate;
        const size = pickC(directSizes);
        const createdTs = daysAgo(d, 9 + Math.floor(rnd() * 10), Math.floor(rnd() * 60));
        const paid = true;
        const prodDays = (prod.prodDays || 9);
        const age = d; // 距今
        // 状态推导：按年龄与生产周期
        let status: Order['status'];
        const paidTs = createdTs + 10 * 60000;
        const shippedTs = createdTs + prodDays * 86400000 * 0.9;
        const receivedTs = createdTs + (prodDays + 1) * 86400000;
        if (!paid) status = 'created';
        else if (age <= prodDays - 3) status = 'paid';
        else if (age <= prodDays - 1) status = 'producing';
        else if (age <= prodDays) status = 'qc';
        else if (age <= prodDays + 1) status = 'shipping';
        else status = 'received';
        const o: Order = {
          id: N('orders'),
          no: orderNo(++orderCursor),
          productId: prod.id,
          productTitle: prod.title,
          cover: prod.cover,
          creatorId: prod.creatorId,
          kind: custom ? 'custom' : 'direct',
          buyerId,
          specUsed: custom
            ? { size, body: BODY_14, adjusted: [] }
            : { size },
          amounts: custom
            ? { price: prod.price, baseFee: prod.baseFee, total: r2(prod.price + prod.baseFee) }
            : { price: prod.price, baseFee: 0, total: prod.price },
          status,
          timeline: [{ t: at(createdTs), text: '订单已创建' }],
          createdAt: at(createdTs),
          prodDays,
          channel: pickC(CHANNELS),
          simulate: true,
        };
        if (status !== 'created') {
          o.paidAt = at(paidTs);
          o.timeline.push({ t: at(paidTs), text: `支付成功 ¥${o.amounts.total}` });
        }
        if (status === 'producing') o.timeline.push({ t: at(paidTs + 86400000), text: '开始生产' });
        if (status === 'qc') {
          o.qcReport = { pass: true, items: [{ k: '面料成分', v: '一致 ✓' }, { k: '车缝', v: '无跳线 ✓' }, { k: '尺寸偏差', v: '0.4mm ✓' }], at: at(paidTs + prodDays * 0.7 * 86400000) };
          o.timeline.push({ t: at(paidTs + prodDays * 0.7 * 86400000), text: '通过出厂质检' });
        }
        if (status === 'shipping' || status === 'received') {
          o.qcReport = { pass: true, items: [{ k: '面料成分', v: '一致 ✓' }, { k: '车缝', v: '无跳线 ✓' }, { k: '尺寸偏差', v: '0.5mm ✓' }], at: at(paidTs + prodDays * 0.7 * 86400000) };
          o.logistics = { company: '顺丰速运', trackingNo: 'SF' + String(100000000000 + Math.floor(rnd() * 1e9)), traces: [{ time: at(shippedTs), text: '已揽收' }, { time: at(shippedTs + 86400000), text: '到达杭州转运中心' }] };
          o.shippedAt = at(shippedTs);
          o.timeline.push({ t: at(shippedTs), text: '已发货 顺丰速运' });
        }
        if (status === 'received') {
          o.receivedAt = at(receivedTs);
          o.timeline.push({ t: at(receivedTs), text: '买家确认收货' });
        }
        push.order(o);
        // 退货事件
        if (status === 'received' && age >= prodDays + 2 && rnd() < cfg.returnProb) {
          o.returnReq = { state: 'done', refundAmount: o.amounts.price, baseFeeKept: custom ? o.amounts.baseFee : 0, reason: '尺寸不合/版型不合预期', at: at(receivedTs + 86400000) };
          ledger(o.buyerId, 'refund', o.amounts.price, `R-${o.no}`);
          o.timeline.push({ t: at(receivedTs + 86400000), text: `退货退款 ¥${o.amounts.price}` });
        }
      }
    }
  }

  // 展示用订单A：id14 已收货可退货定制订单（P1）
  const featTs = daysAgo(8, 11);
  const featOrder: Order = {
    id: N('orders'), no: orderNo(++orderCursor),
    productId: p1.id, productTitle: p1.title, cover: p1.cover, creatorId: p1.creatorId,
    kind: 'custom', buyerId: 14,
    specUsed: { size: 'L', body: BODY_14, adjusted: [] },
    amounts: { price: p1.price, baseFee: p1.baseFee, total: r2(p1.price + p1.baseFee) },
    status: 'received',
    timeline: [
      { t: at(featTs), text: '订单已创建（私人定制 · 基码 L）' },
      { t: at(featTs + 600000), text: `支付成功 ¥${r2(p1.price + p1.baseFee)}` },
      { t: at(daysAgo(6)), text: '开始生产' },
      { t: at(daysAgo(3)), text: '通过出厂质检' },
      { t: at(daysAgo(1)), text: '已发货 顺丰速运' },
      { t: at(daysAgo(0, 8)), text: '买家确认收货' },
    ],
    qcReport: { pass: true, items: [{ k: '面料成分', v: '100% 桑蚕丝 ✓' }, { k: '车缝', v: '无跳线 ✓' }, { k: '尺寸偏差', v: '0.3mm ✓' }], at: at(daysAgo(3)) },
    logistics: { company: '顺丰速运', trackingNo: 'SF1326091004521', traces: [{ time: at(daysAgo(1, 9)), text: '已揽收' }, { time: at(daysAgo(0, 7)), text: '派送中' }] },
    paidAt: at(featTs + 600000), shippedAt: at(daysAgo(1)), receivedAt: at(daysAgo(0, 8)),
    createdAt: at(featTs), channel: '创作者推荐', simulate: true, prodDays: 9,
  };
  push.order(featOrder);

  // 展示用订单B：consumer7 定制退货 → 自动二手挂单（active）
  const rTs = daysAgo(15, 14);
  const returnOrder: Order = {
    id: N('orders'), no: orderNo(++orderCursor),
    productId: p2.id, productTitle: p2.title, cover: p2.cover, creatorId: p2.creatorId,
    kind: 'custom', buyerId: 7,
    specUsed: { size: 'S', body: BODY_14, adjusted: [] },
    amounts: { price: p2.price, baseFee: p2.baseFee, total: r2(p2.price + p2.baseFee) },
    status: 'received',
    timeline: [{ t: at(rTs), text: '订单已创建' }, { t: at(rTs + 600000), text: '支付成功' }, { t: at(daysAgo(9)), text: '确认收货' }, { t: at(daysAgo(4)), text: '退货退款 ¥299（原价退，基础费用不退）' }],
    paidAt: at(rTs + 600000), receivedAt: at(daysAgo(9)),
    returnReq: { state: 'done', refundAmount: 299, baseFeeKept: 79, reason: '尺寸不合', at: at(daysAgo(4)) },
    createdAt: at(rTs), channel: '搜索', simulate: true, prodDays: 9,
  };
  push.order(returnOrder);
  ledger(7, 'refund', 299, `R-${returnOrder.no}`);
  // active 二手挂单：原价×75%
  const activeResale: ResaleListing = {
    id: N('resale'), orderId: returnOrder.id, productId: p2.id, originalTitle: p2.title,
    sellerId: 7, photo: p2.cover, sizeLabel: '私人定制 · 基码 S（按身高163cm体型）',
    listPrice: r2(299 * 0.75), platformFeeRate: 0.08, status: 'active',
    createdAt: at(daysAgo(4)),
  };
  push.resale(activeResale);
  // 已成交二手（历史演示）
  const soldResale: ResaleListing = {
    id: N('resale'), orderId: featOrder.id, productId: p1.id, originalTitle: p1.title,
    sellerId: 11, photo: p1.cover, sizeLabel: '现货 · M',
    listPrice: 246, platformFeeRate: 0.08, status: 'sold', soldTo: 6,
    soldAt: at(daysAgo(20)), netToSeller: 226.32, feeCharged: 19.68, createdAt: at(daysAgo(22)),
  };
  push.resale(soldResale);

  /* ---------- 汇总统计：商品 views/sales ---------- */
  for (const cfg of allProducts) {
    const prod = cfg.product;
    prod.views = db.viewsByDay.filter((v) => v.productId === prod.id).reduce((a, v) => a + v.count, 0);
    prod.sales = db.orders.filter((o) => o.productId === prod.id && o.status !== 'created' && o.status !== 'cancelled').length;
  }
  p2c.views = 3600; p2c.sales = 8; p3c.views = 2100; p3c.sales = 5;

  /* ---------- 通知种子 ---------- */
  const notifs: { userId: number; type: string; title: string; body: string; link?: string; read: boolean; ago: number }[] = [
    { userId: 1, type: 'pool_remind', title: '🎉 作品已进入资源池', body: '「法式碎花泡泡袖连衣裙」点赞超过当日 P60，市场认可！请准备真人穿搭图/规格表/3D与打版文件上橱窗。', link: '/creator/window?workId=' + w1.id, read: true, ago: 13 },
    { userId: 1, type: 'audit', title: '✅ 橱窗审核通过，商品已上架', body: '「法式碎花泡泡袖连衣裙」审核通过，AI 已生成详情页并上架（原价 ¥328）。', link: '/mall/product/' + p1.id, read: true, ago: 12 },
    { userId: 1, type: 'product', title: '🛍️ 新商品上架', body: '「微醺玫瑰 · 缎面吊带连衣裙」已在商城开售，去数据看板看转化。', link: '/creator/dashboard?productId=' + p2.id, read: false, ago: 5 },
    { userId: 1, type: 'audit', title: '❌ 橱窗审核未通过', body: '「初夏微风 · 泡泡纱衬衫」缺少真人穿搭图与完整尺码表，请补齐后重新提交。', link: '/creator/window?workId=' + w4.id, read: false, ago: 3 },
    { userId: 1, type: 'order', title: '💰 收到新订单', body: '买家「我的小号」支付了「微醺玫瑰 · 缎面吊带连衣裙」定制订单。', link: '/creator/dashboard', read: false, ago: 2 },
    { userId: 1, type: 'commission', title: '💎 佣金结算', body: '「法式碎花泡泡袖连衣裙」T+7 佣金 ¥1,286.40 已结算，可在佣金中心提现。', link: '/creator/commission', read: false, ago: 1 },
    { userId: 1, type: 'system', title: '📌 每日资源池提醒', body: '今天你有 1 篇推文离 P60 一步之遥，再获得一些点赞即可入池变现。', read: false, ago: 0 },

    { userId: 2, type: 'product', title: '🛍️ 新商品上架', body: '「雾色晨雾 · 羊毛混纺大衣」AI 详情已生成并上架。', link: '/creator/dashboard', read: true, ago: 9 },
    { userId: 3, type: 'audit', title: '✅ 橱窗审核通过', body: '「初夏微风 · 泡泡纱衬衫」审核通过已上架。', link: '/creator/dashboard', read: true, ago: 7 },

    { userId: 14, type: 'order', title: '📦 订单已发货', body: '「法式碎花泡泡袖连衣裙」定制订单已发货（顺丰 SF1326091004521）。', link: '/mall/orders/' + featOrder.id, read: false, ago: 1 },
    { userId: 14, type: 'order', title: '📦 订单已收货', body: '「法式碎花泡泡袖连衣裙」确认收货成功，定制商品可在订单详情退/换货。', link: '/mall/orders/' + featOrder.id, read: false, ago: 0 },
    { userId: 14, type: 'system', title: '📏 体型数据已保存', body: '你的体型档案已更新（162/52/84/64/90），私人定制时将自动适配。', read: true, ago: 3 },
    { userId: 7, type: 'resale', title: '🏷️ 二手挂单已生成', body: '「微醺玫瑰 · 缎面吊带连衣裙」已按 ¥224.25 挂上二手集市（原价 299×75%）。', link: '/mall/resale/mine', read: false, ago: 4 },
    { userId: 99, type: 'system', title: '🗂 今日待审橱窗 1 件', body: '小织提交了「蓝调波点 · 方领连衣裙」橱窗材料，请复核（可用 force 接口演示）。', link: '/admin', read: false, ago: 0 },
    { userId: 99, type: 'system', title: '📊 昨日审核 4 件', body: '通过 3 / 驳回 1（缺少真人穿搭图）。', read: true, ago: 1 },
  ];
  for (const n of notifs) {
    notify(n.userId, n.type, n.title, n.body, n.link);
    const last = db.notifications[db.notifications.length - 1];
    last.read = n.read;
    last.createdAt = at(daysAgo(n.ago));
  }

  /* ---------- 佣金规则（展示） ---------- */
  db.commissionRules.push(
    { id: 1, name: '基础佣金', desc: '所有已支付有效订单按 6% 基础佣金计', active: true, kind: 'level', when: '全部有效订单' },
    { id: 2, name: '转化与销量上浮', desc: '单品近30天转化率 ≥8% 且销量 ≥10 → +2%（封顶 10%）', active: true, kind: 'level', when: '单品达标即触发' },
    { id: 3, name: '退货率下浮', desc: '近30天退货率 >6% → −1.5%/档（>10% 再降一档）', active: true, kind: 'penalty', when: '超过阈值触发' },
    { id: 4, name: '资源池重复度下浮', desc: '与同款风格重叠度≥60% 的池内作品 ≥3 → −1；≥5 → −2', active: true, kind: 'penalty', when: '进入资源池的作品参与统计' },
  );

  /* ---------- 资金流水（佣金/历史提现演示） ---------- */
  // 历史佣金结算由下方 settleDueCommissions 统一幂等写入；先放两条历史提现
  ledger(1, 'withdraw', -6000, 'WD-hist-01');
  ledger(1, 'withdraw', -4500, 'WD-hist-02');
  // 让几条早期结算有历史时间感：直接在最后用 settleDueCommissions() 生成本日结算 + 一条历史补录
  // (见 resetData 收尾)

  /* ---------- 设定 ---------- */
  db.settings.seedVersion = 2;

  /* ---------- 收尾：清理引擎造数据产生的“当前时刻”噪音通知，避免与手工种子重复 ---------- */
  const cut = Date.now() - 180000;
  db.notifications = db.notifications.filter((n) => Date.parse(n.createdAt) < cut);

  // 佣金按到期规则结算（幂等写 commission_settle 流水，让「已结算/可提现」有数据）
  try {
    settleDueCommissions();
  } catch (e) {
    console.warn('[seed] 佣金结算演示失败（可忽略）', e);
  }
  saveNow();
  console.log(`[seed] ✅ 演示数据已生成：users=${db.users.length} materials=${db.materials.length} works=${db.works.length} posts=${db.posts.length} pool=${db.pool.length} products=${db.products.length} windows=${db.windows.length} orders=${db.orders.length} resale=${db.resale.length} notifs=${db.notifications.length} ledger=${db.ledger.length}`);
}

/** reset 语义：不播种时仅清空 */
export function clearData(): void {
  resetData(false);
}
