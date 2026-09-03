// 织梦 设计师App · 冒烟测试（重构后新 IA）
import { chromium } from 'playwright';
const BASE = 'http://localhost:5174';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();
const results = [];
const step = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${extra ? ' :: ' + extra : ''}`);

try {
  // 1. 首页：双入口 + 底部导航
  await page.goto(`${BASE}/#/design`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const home = await page.evaluate(() => ({
    canvas: document.body.innerText.includes('2D') && document.body.innerText.includes('画布'),
    sim: document.body.innerText.includes('3D 模拟') || document.body.innerText.includes('3D模拟'),
    nav: document.body.innerText.includes('素材') && document.body.innerText.includes('作品'),
  }));
  step('首页·双入口+导航', home.canvas && home.sim && home.nav, JSON.stringify(home));

  // 2. 画布：模板选择 → 编辑器
  await page.goto(`${BASE}/#/design/canvas`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const t = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('人模正面'));
    t?.click();
  });
  await page.waitForTimeout(1000);
  const editor = await page.evaluate(() => ({
    url: location.hash,
    svg: document.querySelectorAll('svg').length,
    draw: document.body.innerText.includes('画笔') || document.body.innerText.includes('绘制'),
    fill: document.body.innerText.includes('填充'),
    save: [...document.querySelectorAll('button')].some((x) => x.textContent?.trim() === '保存'),
  }));
  step('画布编辑器', editor.url.includes('/edit') && editor.draw && editor.save, JSON.stringify(editor));

  // 3. 画布绘制：实际画一笔
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const svg = [...document.querySelectorAll('svg')].find((s) => (s.getAttribute('viewBox') || '').includes('300 520'));
    if (svg) {
      const r = svg.getBoundingClientRect();
      const fire = (type, x, y) => svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, clientX: r.left + x * r.width / 300, clientY: r.top + y * r.height / 520, isPrimary: true, pointerType: 'touch' }));
      fire('pointerdown', 120, 140);
      for (let i = 1; i <= 6; i++) fire('pointermove', 120 + i * 8, 140 + i * 10);
      fire('pointerup', 170, 200);
    }
  });
  await page.waitForTimeout(500);
  const strokeCount = await page.evaluate(() => [...document.querySelectorAll('svg')].reduce((n, s) => n + s.querySelectorAll('path[stroke][d*="M"]').length, 0));
  step('画布自由笔触', strokeCount >= 1, `strokes=${strokeCount}`);

  // 4. 保存 2D 草稿
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '保存')?.click());
  await page.waitForTimeout(800);
  const saved2d = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('已保存')));
  step('2D草稿保存', saved2d);

  // 5. 3D模拟中心
  await page.goto(`${BASE}/#/design/sim3d`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  step('3D模拟中心', await page.evaluate(() => document.body.innerText.includes('参数化') && document.body.innerText.includes('试衣')));

  // 6. 参数化工具参数实时变化（泡泡袖）
  await page.goto(`${BASE}/#/design/studio`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -1;
  });
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '泡泡袖')?.click());
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -2;
  });
  step('参数化实时驱动', before >= 0 && after >= 0 && before !== after);

  // 7. 作品列表（3D 预置 + 刚才的2D草稿）
  await page.goto(`${BASE}/#/design/works`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const worksText = await page.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n+/g, ' | '));
  step('作品管理', worksText.includes('我的作品') && worksText.includes('3D'), worksText.slice(0, 120));

  // 8. 作品详情 → 工艺单
  await page.goto(`${BASE}/#/design/works/100`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const hasTpBtn = await page.evaluate(() => [...document.querySelectorAll('button')].some((x) => x.textContent?.includes('工艺单')));
  if (hasTpBtn) {
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('工艺单'))?.click());
    await page.waitForTimeout(900);
  }
  const tp = await page.evaluate(() => document.body.innerText.includes('BOM') || document.body.innerText.includes('尺寸表') || document.body.innerText.includes('面料'));
  step('工艺单 TechPack 生成', tp);

  // 9. 同步码
  const syncOpen = await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent?.includes('同步至官方') || x.textContent?.includes('同步官方'))?.click() ?? true);
  await page.waitForTimeout(600);
  const code = await page.evaluate(() => document.body.innerText.includes('同步码') || document.body.innerText.includes('dreamweaver-design'));
  step('同步码生成', code, `clicked=${!!syncOpen}`);
} catch (e) {
  step('异常', false, String(e).slice(0, 160));
}
await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.filter((r) => r.startsWith('PASS')).length}/${results.length} passed`);
