// 织梦 创作者中心移动版 QA（390 手机视口；断言文本 + 错误捕获 + 回归）
// 用法: PLAYWRIGHT_BROWSERS_PATH=.../.pw-browsers node qa-v2-mcreator.mjs <baseUrl>
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5173';

async function login(userId) {
  const r = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  return (await r.json()).data.token;
}

const MOBILE = [
  ['/c/home', ['创作者中心', '你好', '快捷操作']],
  ['/c/works', ['创作者中心', '作品', '新建作品', '我的作品']],
  ['/c/publish', ['发布推文', '发布新推文', '我的推文']],
  ['/c/window', ['橱窗材料', '我的橱窗材料']],
  ['/c/products', ['商品管理', '佣金率', '查看详情']],
  ['/c/library', ['素材库', '导入素材']],
  ['/c/pool', ['资源池', '立即评估']],
];
const DESKTOP = [
  ['/creator', ['织梦创作者中心', '总览']],
  ['/creator/window', ['橱窗材料']],
];
const CONSUMER = [
  ['/home', ['推荐', '关注', '热门']],
];

const browser = await chromium.launch();
let pass = 0, fail = 0; const fails = [];

async function runCase({ route, uid, w, expects, tapTabs }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror:' + String(e).slice(0, 180)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console:' + m.text().slice(0, 180)); });
  try {
    const token = await login(uid);
    await page.addInitScript((t) => { try { localStorage.setItem('zm_v2_token', t); } catch {} }, token);
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1400);
    const text = await page.evaluate(() => document.body.innerText || '');
    const missing = expects.filter((s) => !text.includes(s));
    if (tapTabs) {
      // 依次点底部 5 个 Tab，确认无页面错误
      const labels = ['总览', '作品', '发布', '橱窗', '商品'];
      for (const lb of labels) {
        const btn = page.locator('.mc-tabbar button', { hasText: lb }).first();
        if (await btn.count()) { await btn.click(); await page.waitForTimeout(900); }
      }
    }
    const hard = errors.filter((e) => !e.includes('401') && !e.includes('404'));
    if (!missing.length && !hard.length) { pass++; console.log(`ok   ${route} (${w}px uid${uid})`); }
    else { fail++; fails.push({ route, uid, missing, hard }); console.log(`FAIL ${route} uid${uid} missing=[${missing}] hard=[${hard.slice(0, 3)}]`); }
  } catch (e) { fail++; fails.push({ route, uid, err: String(e).slice(0, 200) }); console.log(`ERR  ${route} uid${uid} :: ${String(e).slice(0, 160)}`); }
  await ctx.close();
}

for (const [route, expects] of MOBILE) await runCase({ route, uid: 1, w: 390, expects, tapTabs: true });
for (const [route, expects] of CONSUMER) await runCase({ route, uid: 1, w: 390, expects, tapTabs: false });
for (const [route, expects] of DESKTOP) await runCase({ route, uid: 1, w: 1280, expects, tapTabs: false });

console.log(`\n${pass} passed / ${fail} failed`);
if (fails.length) console.log(JSON.stringify(fails, null, 2));
await browser.close();
