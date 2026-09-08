// 织梦 V2 创作者平台 QA（桌面 viewport；断言文本 + 错误捕获）
// 用法: node qa-v2-creator.mjs <baseUrl>
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5179';

async function login(userId) {
  const r = await fetch('http://localhost:8787/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
  return (await r.json()).data.token;
}

const CASES = [
  ['/creator', 1, 1280, ['织梦创作者中心', '总览']],
  ['/creator/library', 1, 1280, ['素材库']],
  ['/creator/works', 1, 1280, ['作品']],
  ['/creator/publish', 1, 1280, ['发布新推文']],
  ['/creator/pool', 1, 1280, ['资源池']],
  ['/creator/window', 1, 1280, ['橱窗']],
  ['/creator/products', 1, 1280, ['商品']],
  ['/creator/dashboard', 1, 1280, ['数据看板']],
  ['/creator/commission', 1, 1280, ['佣金']],
  ['/creator/notifications', 1, 1280, ['通知']],
  ['/creator/settings', 1, 1280, ['设置']],
  ['/creator/audit', 1, 1280, ['审核']],          // creator: 应显示无权限或空
  ['/creator/audit', 99, 1280, ['审核']],          // auditor: 审核台
];

const browser = await chromium.launch();
let pass = 0, fail = 0; const fails = [];
for (const [route, uid, w, expects] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, locale: 'zh-CN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror:' + String(e).slice(0, 180)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console:' + m.text().slice(0, 180)); });
  try {
    const token = await login(uid);
    await page.addInitScript((t) => { try { localStorage.setItem('zm_v2_token', t); } catch {} }, token);
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);
    const text = await page.evaluate(() => document.body.innerText || '');
    const missing = expects.filter((s) => !text.includes(s));
    const hard = errors.filter((e) => !e.includes('401') && !e.includes('404'));
    if (!missing.length && !hard.length) { pass++; console.log(`ok   /creator${route === '/creator' ? '' : route.replace('/creator', '')} (uid${uid})`); }
    else { fail++; fails.push({ route, uid, missing, hard }); console.log(`FAIL ${route} uid${uid} missing=[${missing}] hard=[${hard.slice(0, 2)}]`); }
  } catch (e) { fail++; fails.push({ route, uid, err: String(e).slice(0, 180) }); console.log(`ERR  ${route} uid${uid} :: ${String(e).slice(0, 150)}`); }
  await ctx.close();
}
console.log(`\n${pass} passed / ${fail} failed`);
await browser.close();
