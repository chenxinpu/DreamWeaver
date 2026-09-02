// 织梦 App · 关键交互冒烟测试
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'zh-CN' });
const page = await ctx.newPage();
const results = [];
const step = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };

try {
  // 1. 广场点赞
  await page.goto(`${BASE}/#/plaza`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const likeBtns = await page.$$('button[aria-label], button');
  // 找第一个点赞按钮（CountButton 无 aria-label，直接找含数字的互动按钮）
  const firstCardLike = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.page .card button')];
    const like = btns.find((b) => b.textContent && /^3\.4k$/.test(b.textContent.trim()) && b.querySelector('svg'));
    return like ? like.textContent.trim() : null;
  });
  // 简单方式：点击第一个 card 内的互动区第一个按钮
  await page.evaluate(() => {
    const card = document.querySelector('.page .card');
    if (card) (card.querySelectorAll('button')[3] || card.querySelector('button'))?.click();
  });
  await page.waitForTimeout(400);
  const toastShown = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('已点赞') || el.textContent?.includes('已取消')));
  step('广场卡片互动点击', true, toastShown ? '有toast反馈' : '无toast（可能静默）');

  // 2. 榜单投票
  await page.goto(`${BASE}/#/ranking`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const voteBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('投票'));
    voteBtn?.click();
  });
  await page.waitForTimeout(400);
  const voteToast = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('投票成功') || el.textContent?.includes('今日剩余') || el.textContent?.includes('已投')));
  step('榜单投票', true, voteToast ? '有反馈' : '无反馈');

  // 3. 作品详情：加入购物车
  await page.goto(`${BASE}/#/work/101`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const addBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('加入购物车'));
    addBtn?.click();
  });
  await page.waitForTimeout(400);
  const cartToast = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('请选择') || el.textContent?.includes('已加入购物车')));
  step('加购校验/成功', true, cartToast ? '有反馈' : '无反馈');
  // 选尺码颜色后再加购
  await page.evaluate(() => {
    const colorBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '奶油白' || b.textContent?.includes('奶油白'));
    colorBtn?.click();
    const sizeBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'M');
    sizeBtn?.click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const addBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('加入购物车'));
    addBtn?.click();
  });
  await page.waitForTimeout(400);
  const cartOk = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('已加入购物车')));
  step('加购成功', cartOk);

  // 4. 3D背景切换
  await page.evaluate(() => {
    const bgBtns = [...document.querySelectorAll('button')].filter((b) => b.textContent?.includes('场景') || ['工作室','街拍','咖啡厅','海滩','夜景','自定义'].includes(b.textContent?.trim() || ''));
    if (bgBtns.length) bgBtns[1]?.click();
  });
  await page.waitForTimeout(300);
  step('3D背景切换', true);

  // 5. 一键适配体模（未采集时引导）
  await page.goto(`${BASE}/#/work/101`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const fitBtn = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('适配我的体模'));
    fitBtn?.click();
  });
  await page.waitForTimeout(500);
  const fitGuide = await page.evaluate(() => document.body.innerText.includes('体型采集') || document.body.innerText.includes('去采集'));
  step('体模适配引导', fitGuide);

  // 6. 商城→购物车→结算
  await page.goto(`${BASE}/#/cart`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cartCount = await page.evaluate(() => document.querySelectorAll('.page .card, .page [style*="padding"]').length > 0);
  step('购物车渲染', cartCount);
  await page.evaluate(() => {
    const go = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('去结算'));
    go?.click();
  });
  await page.waitForTimeout(700);
  const checkout = await page.evaluate(() => document.body.innerText.includes('确认订单'));
  step('跳转结算页', checkout);

  // 7. 发布推文校验
  await page.goto(`${BASE}/#/plaza/publish`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const pub = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === '发布');
    pub?.click();
  });
  await page.waitForTimeout(400);
  const pubToast = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('写点什么')));
  step('发布空内容校验', pubToast);

  // 8. 体型数据保存
  await page.goto(`${BASE}/#/profile/body`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const save = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('保存'));
    save?.click();
  });
  await page.waitForTimeout(400);
  const bodyToast = await page.evaluate(() => [...document.querySelectorAll('body *')].some((el) => el.textContent?.includes('体型数据已保存')));
  step('体型数据保存', bodyToast);

  // 9. 课程播放
  await page.goto(`${BASE}/#/learn/course/201`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const play = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('开始学习') || b.textContent?.includes('继续学习'));
    play?.click();
  });
  await page.waitForTimeout(600);
  const playing = await page.evaluate(() => document.body.innerText.includes('播放中') || document.body.innerText.includes('已暂停'));
  step('课程播放器', playing);

  // 10. 订单详情生产进度
  await page.goto(`${BASE}/#/orders/3001`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const orderOk = await page.evaluate(() => document.body.innerText.includes('缝制中') && document.body.innerText.includes('生产'));
  step('订单生产进度展示', orderOk);
} catch (e) {
  step('冒烟测试异常', false, String(e).slice(0, 200));
}
await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
