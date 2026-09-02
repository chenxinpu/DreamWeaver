// 织梦 App · 自动视觉QA v2（只报真实问题：页面级横向溢出/嵌套按钮/控制台错误/坏图）
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.argv[2] || 'http://localhost:5173';
const CSV = process.argv[3] || 'pages.csv';
const lines = readFileSync(CSV, 'utf-8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const pages = lines.map(l => l.split(',')[0].trim());

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();

let failCount = 0;
for (const route of pages) {
  const issues = [];
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 180)); });
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 180)));
  try {
    await page.goto(`${BASE}/#${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(700);
    // 页面级横向溢出（真溢出）
    const pageOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2 ? { sw: doc.scrollWidth, cw: doc.clientWidth } : null;
    });
    if (pageOverflow) {
      // 找出最可能越界的元素
      const culprit = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        let best = null;
        document.querySelectorAll('body *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 2 || r.left < -2) {
            const w = r.right - Math.max(r.left, 0);
            if (!best || w > best.w) {
              best = { w, tag: el.tagName, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50), l: Math.round(r.left), r: Math.round(r.right) };
            }
          } else if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'auto' && getComputedStyle(el).overflowX !== 'scroll') {
            best = { w: el.scrollWidth, tag: el.tagName, cls: (typeof el.className === 'string' ? el.className : '').slice(0, 50), note: `scrollW=${el.scrollWidth} clientW=${el.clientWidth}` };
          }
        });
        return best;
      });
      issues.push(`PAGE-OVERFLOW ${pageOverflow.sw}px: ${JSON.stringify(culprit)}`);
    }
    const broken = await page.$$eval('img', (imgs) => imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(-45)));
    if (broken.length) issues.push(`broken-img x${broken.length}: ${broken.slice(0, 3).join(', ')}`);
    const nested = await page.$$eval('button button, a button', (els) => els.length);
    if (nested) issues.push(`nested-button/a-button x${nested}`);
    const interact = await page.$$eval('button, a[href]', (els) => els.length);
    if (interact < 3) issues.push(`too-few-interactives(${interact})`);
  } catch (e) {
    issues.push(`LOAD-FAIL: ${String(e).slice(0, 140)}`);
  }
  page.removeAllListeners('console');
  page.removeAllListeners('pageerror');
  if (errors.length) issues.push(`console-err: ${errors[0]}`);
  if (issues.length) failCount++;
  console.log(`${issues.length ? 'ISSUE' : 'OK  '} ${route}${issues.length ? '\n      - ' + issues.join('\n      - ') : ''}`);
}
await browser.close();
console.log(`\n${failCount}/${pages.length} pages with issues`);
