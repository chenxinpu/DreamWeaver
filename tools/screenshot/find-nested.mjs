// 定位嵌套按钮的具体 DOM 位置
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:5173';
const routes = process.argv.slice(3).length ? process.argv.slice(3) : ['/work/101', '/profile/settings'];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();
for (const r of routes) {
  await page.goto(`${BASE}/#${r}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button button, a button').forEach((inner) => {
      const outer = inner.parentElement;
      let text = '';
      for (let el = inner; el && el !== outer.parentElement; el = el.parentElement) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A') { text += `${el.tagName}<${(el.textContent || '').trim().slice(0, 30)}> `; }
      }
      out.push(text.trim());
    });
    return out;
  });
  console.log(r, '=>', JSON.stringify(info, null, 1));
}
await browser.close();
