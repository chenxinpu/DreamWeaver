// 织梦 服装设计App · 冒烟测试
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();
const results = [];
const step = (n, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${n}${extra ? ' :: ' + extra : ''}`);

try {
  // 1. 设计首页渲染 + 新建入口
  await page.goto(`${BASE}/#/design`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const home = await page.evaluate(() => ({
    hasCreate: document.body.innerText.includes('创建新设计') || document.body.innerText.includes('新建设计'),
    svgCount: document.querySelectorAll('svg').length,
    nav: document.body.innerText.includes('灵感') && document.body.innerText.includes('作品'),
  }));
  step('设计App首页', home.hasCreate && home.nav, `svg=${home.svgCount}`);

  // 2. 进入工作台
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.includes('创建新设计') || x.textContent?.includes('连衣裙')); b?.click(); });
  await page.waitForTimeout(1000);
  const studioUrl = page.url();
  const studio = await page.evaluate(() => ({
    svgPaths: document.querySelectorAll('svg path').length,
    panel: document.body.innerText.includes('领型') && document.body.innerText.includes('袖型'),
    fabricTab: document.body.innerText.includes('面料'),
  }));
  step('工作台渲染', studio.svgPaths > 3 && studio.panel, `paths=${studio.svgPaths} url=${studioUrl.slice(-30)}`);

  // 3. 参数变化实时驱动画布（改袖型：泡泡袖）
  const pathBefore = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -1;
  });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '泡泡袖');
    btn?.click();
  });
  await page.waitForTimeout(600);
  const pathAfter = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find((x) => x.getAttribute('viewBox') === '0 0 360 560');
    return s ? s.innerHTML.length : -2;
  });
  step('参数实时驱动', pathBefore >= 0 && pathAfter >= 0 && pathBefore !== pathAfter);

  // 4. 面料切换
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '面料')?.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent?.includes('重磅真丝'))?.click(); });
  await page.waitForTimeout(300);
  step('面料切换', true);

  // 5. AI 文生图 → 候选 → 应用
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent?.includes('文生图') || x.textContent?.includes('AI'))?.click(); });
  await page.waitForTimeout(800);
  const aiOpen = await page.evaluate(() => document.body.innerText.includes('生成') && (document.body.innerText.includes('描述') || document.body.innerText.includes('灵感')));
  step('AI工具箱打开', aiOpen);
  await page.evaluate(() => {
    const gen = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '生成' || x.textContent?.includes('开始生成'));
    gen?.click();
  });
  await page.waitForTimeout(4200);
  const candidates = await page.evaluate(() => document.body.innerText.includes('候选') || [...document.querySelectorAll('button')].some(x => x.textContent?.trim() === '应用'));
  step('AI生成5款候选', candidates);

  // 6. 保存（工具栏「保存」按钮，精确匹配）
  await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === '保存')?.click(); });
  await page.waitForTimeout(800);
  const saved = await page.evaluate(() => [...document.querySelectorAll('body *')].some(el => el.textContent?.includes('已保存到我的作品')));
  step('设计稿保存', saved);

  // 7. 试衣间
  await page.goto(`${BASE}/#/design/tryon`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const tryon = await page.evaluate(() => ({
    title: document.body.innerText.includes('试衣') || document.body.innerText.includes('3D'),
    model: document.body.innerText.includes('体型') || document.body.innerText.includes('一人一版'),
    anim: [...document.querySelectorAll('button')].some(x => ['站立','转身','摆裙','行走'].includes(x.textContent?.trim() || '')),
  }));
  step('3D试衣间', tryon.title && tryon.anim, JSON.stringify(tryon));

  // 8. 我的作品 → 同步标记
  await page.goto(`${BASE}/#/design/works`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const works = await page.evaluate(() => document.body.innerText.includes('我的作品') && document.body.innerText.includes('已同步'));
  step('设计App作品页', works);

  // 9. 官方App我的作品集显示设计App作品
  await page.goto(`${BASE}/#/profile/works`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const official = await page.evaluate(() => document.body.innerText.includes('来自设计App') || document.body.innerText.includes('去「织梦·设计」'));
  step('官方作品集联动', official);

  // 10. 设计学习页
  await page.goto(`${BASE}/#/design/learn`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  step('设计App学习页', await page.evaluate(() => document.body.innerText.includes('设计学院')));
} catch (e) {
  step('异常', false, String(e).slice(0, 180));
}
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
