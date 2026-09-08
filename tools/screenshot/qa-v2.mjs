// 织梦 V2 QA：登录后逐页断言关键文本 + 捕获 console/pageerror
// 用法: node qa-v2.mjs <baseUrl> [onlyPrefix]
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5179';
const ONLY = process.argv[3] || '';
const fs = await import('node:fs');

const tokFor = async (userId) => {
  const r = await fetch(`${BASE.replace(':5179', ':8787').includes('8787') ? 'http://localhost:8787' : 'http://localhost:8787'}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
  });
  const j = await r.json();
  return j.data.token;
};

const CASES = [
  // [route, userId, viewportW, expects[]]
  ['/home', 14, 390, ['织梦']],
  ['/me', 14, 390, ['我的小号']],
  ['/me/body', 14, 390, ['体型']],
  ['/me/preferences', 14, 390, ['偏好']],
  ['/messages', 14, 390, ['通知']],
  ['/post/5', 14, 390, []],
  ['/mall/home', 14, 390, ['商城']],
  ['/mall/product/1', 14, 390, ['¥', '私人定制']],
  ['/mall/orders', 14, 390, ['订单']],
  ['/mall/orders/134', 14, 390, []],
  ['/mall/orders/134/return', 14, 390, ['退货']],
  ['/mall/resale', 14, 390, ['二手']],
  ['/mall/resale/mine', 14, 390, ['转售']],
  ['/mall/mine', 14, 390, []],
];

const browser = await chromium.launch();
let pass = 0, fail = 0;
const fails = [];
for (const [route, uid, w, expects] of CASES) {
  if (ONLY && !route.includes(ONLY)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: 844 }, deviceScaleFactor: 1, isMobile: w <= 430, hasTouch: w <= 430, locale: 'zh-CN' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror:' + String(e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text().slice(0, 200)); });
  try {
    const token = await tokFor(uid);
    await page.addInitScript((t) => { try { localStorage.setItem('zm_v2_token', t); } catch {} }, token);
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle', timeout: 25000 });
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => document.body.innerText || '');
    const missing = expects.filter((s) => !text.includes(s));
    const bad = errors.filter((e) => !e.includes('401') && !e.includes('Failed to load resource'));
    if (!missing.length && !bad.length) { pass++; console.log(`ok   ${route}`); }
    else { fail++; fails.push({ route, missing, bad }); console.log(`FAIL ${route} missing=[${missing}] bad=[${bad.slice(0, 2)}]`); }
  } catch (e) {
    fail++; fails.push({ route, err: String(e).slice(0, 200) });
    console.log(`ERR  ${route} :: ${String(e).slice(0, 160)}`);
  }
  await ctx.close();
}
console.log(`\n${pass} passed / ${fail} failed`);
if (fails.length) fs.writeFileSync('/tmp/qa-fails.json', JSON.stringify(fails, null, 2));
await browser.close();
