// 织梦 设计师App · 创作链路(2D版片⇄3D联动⇄交付) 冒烟 v2
import { chromium } from 'playwright';
const BASE = 'http://localhost:5174';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();
const results = [];
const step = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${extra ? ' :: ' + extra : ''}`);
const clickText = async (t) => {
  await page.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === txt || x.textContent?.trim().startsWith(txt));
    b?.click();
  }, t);
};
const viewBoxes = () => page.evaluate(() => [...document.querySelectorAll('svg')].map((s) => s.getAttribute('viewBox') || ''));

try {
  await page.goto(`${BASE}/#/design`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  step('首页创作链路Hero', await page.evaluate(() => document.body.innerText.includes('创作链路') && document.body.innerText.includes('开始创作')));

  // 直接进入 2D 版片工作台
  await page.goto(`${BASE}/#/design/pipeline?cat=dress`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const v0 = await viewBoxes();
  const hasSheet = v0.some((v) => v.startsWith('0 0 210 300'));
  const has2d = await page.evaluate(() => document.body.innerText.includes('衣长') && document.body.innerText.includes('摆宽'));
  step('2D版片工作台', hasSheet && has2d, JSON.stringify(v0.slice(0, 8)));

  // 拖动衣长手柄（底部手柄向上）→ 尺寸实时变
  const dimBefore = await page.evaluate(() => document.body.innerText.match(/衣长\s*(\d+)cm/)?.[1] || '');
  await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => (s.getAttribute('viewBox') || '').startsWith('0 0 210 300'));
    const h = svg.querySelector('[data-param="lengthCm"]') || svg.querySelector('[data-handle]');
    if (!h) return;
    const hr = (h.querySelector('circle') || h).getBoundingClientRect();
    const cx = hr.left + hr.width / 2;
    const cy = hr.top + hr.height / 2;
    const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 9, clientX: x, clientY: y, isPrimary: true, pointerType: 'touch' }));
    fire('pointerdown', cx, cy);
    for (let i = 1; i <= 10; i++) fire('pointermove', cx + i * 1.2, cy - i * 5);
    fire('pointerup', cx + 12, cy - 50);
  });
  await page.waitForTimeout(800);
  const dimAfter = await page.evaluate(() => document.body.innerText.match(/衣长\s*(\d+)cm/)?.[1] || '');
  step('拖手柄改版片(衣长)', dimAfter !== '' && dimAfter !== dimBefore, `衣长 ${dimBefore}→${dimAfter}`);

  // 切 3D 联动：滑杆 + DressCanvas
  await clickText('3D联动');
  await page.waitForTimeout(1200);
  const v1 = await viewBoxes();
  const has3d = v1.some((v) => v === '0 0 360 560');
  const ranges = await page.evaluate(() => [...document.querySelectorAll('input[type=range]')].map((r) => `${r.min}-${r.max}`));
  step('3D联动视图', has3d && ranges.length >= 2, `ranges=${JSON.stringify(ranges)}`);

  const svgBefore = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -1;
  });
  await page.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type=range]')];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const pick = ranges.find((r) => Number(r.max) > 1.4) || ranges[ranges.length - 1];
    if (pick && setter) { setter.call(pick, String(Number(pick.max) * 0.85)); pick.dispatchEvent(new Event('input', { bubbles: true })); pick.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  await page.waitForTimeout(800);
  const svgAfter = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -2;
  });
  step('3D滑杆驱动服装', svgBefore >= 0 && svgAfter !== svgBefore);

  // 反向：回 2D 看摆宽标注变化
  const hemB = await page.evaluate(() => document.body.innerText.match(/摆宽\s*(\d+)cm/)?.[1] || '');
  await clickText('2D版片');
  await page.waitForTimeout(700);
  const hemA = await page.evaluate(() => document.body.innerText.match(/摆宽\s*(\d+)cm/)?.[1] || '');
  step('3D→2D 反向同步', hemA !== '' && hemA !== hemB, `摆宽 ${hemB}→${hemA}`);

  // 交付
  await clickText('交付');
  await page.waitForTimeout(1000);
  const deliver = await page.evaluate(() => ({
    bom: document.body.innerText.includes('BOM') || document.body.innerText.includes('物料'),
    sheet: document.body.innerText.includes('版片清单') || (document.body.innerText.includes('对折') && document.body.innerText.includes('片')),
    exp: [...document.querySelectorAll('button')].some((x) => x.textContent?.includes('导出')),
  }));
  step('交付工件稿(工艺单+版片)', deliver.bom && deliver.sheet && deliver.exp, JSON.stringify(deliver));

  // 保存
  await clickText('保存');
  await page.waitForTimeout(900);
  step('保存为作品', await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('已保存'))));

  // 作品页出现该作品且可进入工作台
  await page.goto(`${BASE}/#/design/works`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const inWorks = await page.evaluate(() => document.body.innerText.includes('联动工作台') || document.body.innerText.includes('2D') || [...document.querySelectorAll('button')].some((x) => x.getAttribute('title')?.includes('联动')));
  step('作品页工作台入口', inWorks);
} catch (e) {
  step('异常', false, String(e).slice(0, 160));
}
await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
