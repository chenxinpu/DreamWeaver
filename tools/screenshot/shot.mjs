// 织梦 App · 页面截图验证脚本
// 用法: node shot.mjs <baseUrl> [pages.csv] [outDir]
// pages.csv 每行: 路由,文件名(不带扩展名)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5173';
const CSV = process.argv[3] || 'pages.csv';
const OUT = resolve(process.argv[4] || 'shots');
await mkdir(OUT, { recursive: true });

const fs = await import('node:fs');
const lines = fs.readFileSync(CSV, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const pages = lines.map(l => {
  const [route, name] = l.split(',');
  return { route: route.trim(), name: (name || route.replace(/\W+/g, '-')).trim() };
});

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
});
const page = await ctx.newPage();
page.on('console', (msg) => { if (msg.type() === 'error') console.log(`[console.error] ${msg.text().slice(0, 200)}`); });
page.on('pageerror', (err) => console.log(`[pageerror] ${String(err).slice(0, 300)}`));

const results = [];
for (const p of pages) {
  try {
    await page.goto(`${BASE}/#${p.route}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: resolve(OUT, `${p.name}.png`), fullPage: false });
    results.push(`ok   ${p.route} -> ${p.name}.png`);
  } catch (e) {
    results.push(`FAIL ${p.route} :: ${String(e).slice(0, 150)}`);
  }
}
await browser.close();
console.log(results.join('\n'));
