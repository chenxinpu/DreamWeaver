#!/usr/bin/env node
/**
 * 织梦 DreamWeaver · 端到端冒烟
 *
 * 覆盖 Java 后端(8787：REST + BFF 聚合 + WebSocket) → Python AI(8789) 的完整链路：
 *   1) 网关聚合健康检查（三方服务状态）
 *   2) API 网关透传（登录 / 素材 / 作品 / 推文）
 *   3) 业务链路：发推文 → 热度加速 → 资源池评估 → 橱窗材料审核 → AI 生成详情页 → 商品上架
 *   4) 私人定制：规格适配(Java) → AI 对话(Python) → 款式变体出图(Python)
 *   5) 订单履约：定制下单 → 支付 → 推进 → 退货 → 自动挂二手 → 成交
 *   6) BFF 聚合端点
 *   7) WebSocket 实时通道：订阅 + 内部事件广播
 *
 * 用法：
 *   node tools/smoke/stack-smoke.mjs [http://127.0.0.1:8787]
 *   BASE=http://127.0.0.1:8787 node tools/smoke/stack-smoke.mjs
 *
 * 退出码：0 = 全部通过；1 = 有失败项。
 */

const BASE = (process.argv[2] || process.env.BASE || 'http://127.0.0.1:8787').replace(/\/$/, '');
const WS_BASE = BASE.replace(/^http/, 'ws');
const INTERNAL_TOKEN = process.env.DW_INTERNAL_TOKEN || 'dw-internal-dev-token';

const CREATOR_ID = 1;   // 小织（creator）
const CONSUMER_ID = 14; // 我的小号（consumer）

let pass = 0;
let fail = 0;
const failures = [];
const warnings = [];

/* ------------------------------ 断言与输出 ------------------------------ */

const C = {
  reset: '\u001b[0m', dim: '\u001b[2m', red: '\u001b[31m',
  green: '\u001b[32m', yellow: '\u001b[33m', cyan: '\u001b[36m', bold: '\u001b[1m',
};

function step(name) {
  process.stdout.write(`${C.cyan}▸${C.reset} ${name} ... `);
}

function ok(msg = '') {
  pass++;
  console.log(`${C.green}✓${C.reset}${msg ? ' ' + msg : ''}`);
}

function bad(msg) {
  fail++;
  failures.push(msg);
  console.log(`${C.red}✗ ${msg}${C.reset}`);
}

function warn(msg) {
  warnings.push(msg);
  console.log(`${C.yellow}!${C.reset} ${msg}`);
}

function expect(cond, msg) {
  if (cond) ok();
  else bad(msg);
  return !!cond;
}

/* -------------------------------- HTTP -------------------------------- */

async function api(method, path, { token, body, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) {
    payload = raw;
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method, headers: h, body: payload });
  } catch (e) {
    return { status: 0, json: null, text: String(e), networkError: true };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON */ }
  return { status: res.status, json, text };
}

/** 成功响应取 data；失败时抛错并带上服务端 code/msg */
async function data(method, path, opts) {
  const r = await api(method, path, opts);
  if (r.networkError) throw new Error(`网络不可达 ${method} ${path}`);
  if (!r.json) throw new Error(`${method} ${path} 返回非 JSON（status=${r.status}）：${r.text.slice(0, 160)}`);
  if (r.json.ok !== true) {
    throw new Error(`${method} ${path} 失败：code=${r.json.code} msg=${r.json.msg}`);
  }
  return r.json.data;
}

async function login(userId) {
  const d = await data('POST', '/api/auth/login', { body: { userId } });
  if (!d.token) throw new Error(`登录 user=${userId} 未返回 token`);
  return d;
}

/* ------------------------- 0. 网关聚合健康检查 ------------------------- */

async function checkHealth() {
  step('聚合健康检查 GET /api/health');
  const r = await api('GET', '/api/health');
  if (!expect(r.json && r.json.ok === true, `健康检查失败：status=${r.status} ${r.text.slice(0, 200)}`)) return;

  const svc = r.json.data?.services || [];
  for (const s of svc) {
    if (s.ok) ok(`  ${s.name} 正常（${s.url}，${s.latencyMs}ms）`);
    else bad(`  ${s.name} 不可用（${s.url}）`);
  }
  if (!svc.length) warn('  健康检查未返回 services 列表（聚合健康未实现？）');
}

/* --------------------------- 1. 素材与作品 --------------------------- */

async function createWork(token) {
  step('导入素材 → 组织作品');
  const help = await data('GET', '/api/materials/import-help', { token });
  expect(Array.isArray(help.formats) && help.formats.length > 0, 'import-help 未返回 formats');

  // 从示例文件导入一份 DXF 打版图和一份 OBJ 3D 模型
  const dxfContent = await data('GET', '/api/materials/sample-content?file=dress-front-pattern.dxf', { token });
  const objContent = await data('GET', '/api/materials/sample-content?file=dress.obj', { token });

  const dxf = await data('POST', '/api/materials/import', {
    token,
    body: { fileName: 'dress-front-pattern.dxf', kind: 'dxf', content: dxfContent.content, title: '冒烟·连衣裙前片', tags: ['smoke'] },
  });
  expect(!!dxf.id && !!dxf.patternSvg, `DXF 解析失败（id=${dxf.id}, patternSvg=${dxf.patternSvg ? 'ok' : 'missing'}）`);

  const obj = await data('POST', '/api/materials/import', {
    token,
    body: { fileName: 'dress.obj', kind: 'obj', content: objContent.content, title: '冒烟·连衣裙3D', tags: ['smoke'] },
  });
  expect(!!obj.id && obj.objPreview?.vertices > 0, `OBJ 解析失败（id=${obj.id}, objPreview=${JSON.stringify(obj.objPreview)})`);

  const work = await data('POST', '/api/works', {
    token,
    body: {
      title: '冒烟·法式碎花连衣裙',
      category: '连衣裙',
      styleTags: ['法式', '碎花', '通勤'],
      fabric: '真丝',
      desc: '端到端冒烟用作品',
      cover: '/images/dress-01.jpg',
      patternMatIds: [dxf.id],
      modelMatIds: [obj.id],
      mediaImages: ['/images/dress-01.jpg', '/images/dress-02.jpg'],
    },
  });
  expect(!!work.id, `作品创建失败：${JSON.stringify(work)}`);
  return { work, dxf, obj };
}

/* --------------------- 2. 推文 → 资源池 --------------------- */

async function runPoolFlow(token, work) {
  step('发推文 → 热度加速 → 资源池自动评估');
  const post = await data('POST', '/api/posts', {
    token,
    body: {
      content: '冒烟测试推文 #法式 #碎花 用设计讲述温柔的力量',
      workId: work.id,
      patternMatIds: work.patternMatIds,
      modelMatIds: work.modelMatIds,
    },
  });
  expect(!!post.id, `发推文失败：${JSON.stringify(post)}`);

  const surge = await data('POST', '/api/dev/surge-likes', { token, body: { postId: post.id, likes: 9999 } });
  expect(!!surge.p60 !== undefined, 'surge-likes 未返回 p60');
  expect(surge.qualified === true, `推文未进入资源池（likes=${surge.likesNow}, p60=${surge.p60}）`);

  const pool = await data('GET', '/api/creator/pool', { token });
  const mine = (pool.list || pool.entries || []).find((e) => e.postId === post.id);
  expect(!!mine, '资源池列表未包含刚入池的推文');
  return { post, poolEntry: mine };
}

/* ------------------ 3. 橱窗材料 → AI 详情页 → 上架 ------------------ */

async function runWindowFlow(token, work) {
  step('橱窗材料提交 → 完整性审核 → AI 生成详情页 → 自动上架');
  const win = await data('POST', '/api/creator/window', {
    token,
    body: {
      workId: work.id,
      action: 'submit',
      photos: ['/images/dress-01.jpg', '/images/dress-02.jpg'],
      partsFabric: [
        { part: '前片', fabric: '真丝', note: '主面料' },
        { part: '里布', fabric: '高支棉' },
      ],
      spec: {
        label: '标准版型',
        sizeChart: [
          { size: 'S', bust: 84, waist: 66, hip: 90, shoulder: 37, sleeve: 20, length: 100 },
          { size: 'M', bust: 88, waist: 70, hip: 94, shoulder: 38, sleeve: 21, length: 102 },
          { size: 'L', bust: 92, waist: 74, hip: 98, shoulder: 39, sleeve: 22, length: 104 },
        ],
      },
      productName: '冒烟·法式碎花连衣裙',
      category: '连衣裙',
      styleTags: ['法式', '碎花'],
      patternMatIds: work.patternMatIds,
      modelMatIds: work.modelMatIds,
    },
  });
  expect(win.audit?.pass === true, `橱窗审核未通过：${JSON.stringify(win.audit)}`);

  const productId = win.audit?.product?.id;
  expect(!!productId, '审核通过但未生成商品');

  if (productId) {
    const detail = await data('GET', `/api/products/${productId}`, { token });
    expect(detail.status === 'onSale', `商品未上架（status=${detail.status}）`);
    const d = detail.aiDetail || {};
    expect(!!d.intro && !!d.story, 'AI 详情页 intro/story 缺失（Python AI 服务未生效？）');
    expect(Array.isArray(d.sections) && d.sections.length >= 4, `AI 详情页 sections 不足（${(d.sections || []).length}）`);
    expect(typeof d.baseFeeNote === 'string' && d.baseFeeNote.length > 0, 'AI 详情页 baseFeeNote 缺失');
    if (!/织梦柔性智造工厂/.test(d.manufacturer || '')) warn(`manufacturer 非预期：${d.manufacturer}`);
  }

  const mall = await data('GET', '/api/mall/products?pageSize=50', { token });
  expect((mall.list || []).some((p) => p.id === productId), '商城列表未包含新上架商品');
  return { window: win, productId };
}

/* ------------------------- 4. 私人定制（含 AI） ------------------------- */

const SMOKE_BODY = {
  height: 166, weight: 54, bust: 86, underBust: 74, waist: 66, hip: 92,
  shoulderWidth: 38, armLength: 54, thigh: 51, calf: 34, neck: 33, backLength: 39,
  source: 'manual',
};

async function runCustomFlow(token, productId) {
  step('私人定制：规格适配（Java 算法）');
  const adapt = await data('POST', '/api/custom/adapt', { token, body: { productId, body: SMOKE_BODY } });
  expect(!!adapt.baseSize, `未返回 baseSize：${JSON.stringify(adapt).slice(0, 200)}`);
  expect(Array.isArray(adapt.adjustedSpec) && adapt.adjustedSpec.length > 0, 'adjustedSpec 为空');
  expect(Array.isArray(adapt.fitAlerts), 'fitAlerts 不是数组');
  expect(adapt.totalEstimate && adapt.totalEstimate.total > 0, 'totalEstimate 异常');

  step('私人定制：AI 对话（Python AI 服务）');
  const chat = await data('POST', '/api/custom/chat', {
    token,
    body: { productId, body: SMOKE_BODY, history: [{ role: 'user', content: '袖子想改成泡泡袖，能改吗' }] },
  });
  expect(typeof chat.reply === 'string' && chat.reply.length > 0, 'AI 对话未返回 reply（Python AI 服务未生效？）');
  expect(Array.isArray(chat.options) && chat.options.length > 0, 'AI 对话未返回 options');
  if (chat.options?.[0] && !chat.options[0].key) warn('AI 对话 options 缺少 key 字段');

  step('私人定制：款式变体出图（Python AI 服务）');
  const variant = await data('POST', '/api/custom/variant', { token, body: { productId, optionKey: 'sleeve-puff' } });
  expect(typeof variant.image === 'string' && variant.image.startsWith('data:image/svg+xml'), '变体图不是 SVG data-url');
  expect(Array.isArray(variant.applied) && variant.applied.length > 0, '变体图未返回 applied');

  step('私人定制：汇总预览');
  const preview = await data('POST', '/api/custom/preview', {
    token,
    body: { productId, body: SMOKE_BODY, options: ['sleeve-puff', 'neck-v'] },
  });
  expect(Array.isArray(preview.variantImages), 'preview 未返回 variantImages');
  return adapt;
}

/* --------------------- 5. 订单履约 → 售后 → 二手 --------------------- */

async function runOrderFlow(consumerToken, creatorToken, productId, adapt) {
  step('定制下单 → 支付 → 履约推进');
  const order = await data('POST', '/api/orders', {
    token: consumerToken,
    body: { productId, kind: 'custom', body: SMOKE_BODY },
  });
  expect(!!order.id, '下单失败');
  expect(order.kind === 'custom', `订单类型应为 custom，实际 ${order.kind}`);
  expect(!!order.adapt?.baseSize, '定制订单未返回 adapt.baseSize');

  const paid = await data('POST', `/api/orders/${order.id}/pay`, { token: consumerToken });
  expect(paid.status === 'paid', `支付后状态应为 paid，实际 ${paid.status}`);

  let advanced = null;
  for (let i = 0; i < 8; i++) {
    advanced = await data('POST', `/api/orders/${order.id}/dev-advance`, { token: consumerToken });
    if (['received', 'completed'].includes(advanced.status)) break;
  }
  expect(['received', 'completed'].includes(advanced.status), `履约推进未到达 received/completed，最终 ${advanced.status}`);
  expect(!!advanced.stage, '订单未返回 stage 履约阶段');

  step('定制退货（退原价、留基础费）→ 自动挂二手集市');
  const ret = await data('POST', `/api/orders/${order.id}/return`, { token: consumerToken, body: { reason: '冒烟测试退货' } });
  expect(ret.refundAmount > 0, `退货未退原价（refundAmount=${ret.refundAmount}）`);
  expect(!!ret.resaleId, '退货未自动生成二手挂单');
  expect(ret.returnReq?.state === 'done' || ret.returnReq?.state === 'returning', `returnReq.state 异常：${ret.returnReq?.state}`);

  step('二手集市：浏览 → 砍价 → 成交');
  const mall = await data('GET', '/api/mall/resale?pageSize=50', { token: consumerToken });
  expect((mall.list || []).some((l) => l.id === ret.resaleId), '二手集市未包含新挂单');
  const listing = (mall.list || []).find((l) => l.id === ret.resaleId);
  if (listing) {
    expect(listing.netEstimate > 0, '挂单缺少 netEstimate 净额估算');
    const cheaper = Math.max(1, Math.round(listing.listPrice * 0.8));
    const afterBargain = await data('PATCH', `/api/resale/${listing.id}/price`, { token: consumerToken, body: { listPrice: cheaper } });
    expect(afterBargain.listPrice === cheaper, `降价未生效：${afterBargain.listPrice} != ${cheaper}`);

    const bought = await data('POST', `/api/resale/${listing.id}/buy`, { token: creatorToken });
    expect(bought.status === 'sold', `成交后状态应为 sold，实际 ${bought.status}`);
    expect(bought.netToSeller > 0, '成交未结算给卖家');
  }
}

/* ------------------------------ 6. BFF ------------------------------ */

async function runBff(consumerToken) {
  step('BFF 聚合端点');
  const endpoints = [
    ['GET', '/api/bff/home', consumerToken],
    ['GET', '/api/bff/mall/home', consumerToken],
    ['GET', '/api/bff/me', consumerToken],
  ];
  for (const [method, path, token] of endpoints) {
    const r = await api(method, path, { token });
    if (r.status === 404) { warn(`${path} 未实现（BFF 端点缺失）`); continue; }
    expect(r.json?.ok === true, `${path} 失败：status=${r.status} ${r.text.slice(0, 160)}`);
  }
}

/* --------------------------- 7. WebSocket --------------------------- */

async function runWebSocket() {
  step('WebSocket 实时通道（订阅 / 心跳 / 内部事件广播）');
  if (typeof WebSocket !== 'function') { warn('当前 Node 无全局 WebSocket，跳过'); return; }
  const url = `${WS_BASE}/ws`;
  const ws = new WebSocket(url);

  const opened = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 5000);
    ws.onopen = () => { clearTimeout(t); resolve(true); };
    ws.onerror = () => { clearTimeout(t); resolve(false); };
  });
  if (!opened) { bad(`无法连接 ${url}`); return; }
  ok(`  已连接 ${url}`);

  const messages = [];
  ws.onmessage = (ev) => { try { messages.push(JSON.parse(ev.data)); } catch { messages.push({ raw: ev.data }); } };

  ws.send(JSON.stringify({ type: 'subscribe', topics: ['order:1', 'user:1', 'post:1', 'live:smoke'] }));
  await sleep(300);
  expect(messages.some((m) => m.type === 'subscribed'), '未收到 subscribed 回执');

  ws.send(JSON.stringify({ type: 'ping' }));
  await sleep(300);
  expect(messages.some((m) => m.type === 'pong'), '未收到 pong 心跳响应');

  // 内部事件广播
  const pub = await api('POST', '/internal/publish', {
    headers: { 'X-Internal-Token': INTERNAL_TOKEN },
    body: { topic: 'order:1', event: 'status', data: { status: 'producing', no: 'SMOKE' } },
  });
  expect(pub.status === 200 || pub.json?.ok === true, `内部事件投递失败：status=${pub.status} ${pub.text.slice(0, 160)}`);
  await sleep(500);
  expect(messages.some((m) => m.topic === 'order:1' && m.event === 'status'), '订阅方未收到 order:1 广播');

  // 未授权投递必须被拒
  const denied = await api('POST', '/internal/publish', {
    headers: { 'X-Internal-Token': 'wrong-token' },
    body: { topic: 'order:1', event: 'status', data: {} },
  });
  expect(denied.status === 401 || denied.status === 403, `错误 token 未被拒绝（status=${denied.status}）`);

  ws.close();
  await sleep(200);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------- main ------------------------------- */

async function main() {
  console.log(`${C.bold}织梦 DreamWeaver · 端到端冒烟${C.reset}`);
  console.log(`${C.dim}Java 后端 ${BASE}（REST + BFF + WebSocket）· Python AI 8789${C.reset}\n`);

  const health = await api('GET', '/api/health');
  if (health.networkError) {
    console.log(`${C.red}无法连接后端 ${BASE}，请先执行 ./tools/dev/services.sh start${C.reset}`);
    process.exit(1);
  }

  await checkHealth();

  let creator, consumer;
  step(`登录创作者（user=${CREATOR_ID} 小织）`);
  try { creator = await login(CREATOR_ID); ok(); } catch (e) { bad(String(e.message)); }
  step(`登录消费者（user=${CONSUMER_ID} 我的小号）`);
  try { consumer = await login(CONSUMER_ID); ok(); } catch (e) { bad(String(e.message)); }

  if (!creator || !consumer) {
    report();
    process.exit(1);
  }

  try {
    const { work } = await createWork(creator.token);
    await runPoolFlow(creator.token, work);
    const { productId } = await runWindowFlow(creator.token, work);
    if (productId) {
      const adapt = await runCustomFlow(consumer.token, productId);
      await runOrderFlow(consumer.token, creator.token, productId, adapt);
    } else {
      bad('未生成商品，跳过定制/订单链路');
    }
  } catch (e) {
    bad(`业务链路中断：${e.message}`);
  }

  try { await runBff(consumer.token); } catch (e) { bad(`BFF 检查异常：${e.message}`); }
  try { await runWebSocket(); } catch (e) { bad(`WebSocket 检查异常：${e.message}`); }

  report();
  process.exit(fail ? 1 : 0);
}

function report() {
  console.log(`\n${C.bold}结果：${C.green}${pass} 通过${C.reset} · ${fail ? C.red : C.dim}${fail} 失败${C.reset}${warnings.length ? ` · ${C.yellow}${warnings.length} 警告${C.reset}` : ''}`);
  if (failures.length) {
    console.log(`\n${C.red}失败项：${C.reset}`);
    for (const f of failures) console.log(`  ${C.red}✗${C.reset} ${f}`);
  }
  if (warnings.length) {
    console.log(`\n${C.yellow}警告项：${C.reset}`);
    for (const w of warnings) console.log(`  ${C.yellow}!${C.reset} ${w}`);
  }
}

main().catch((e) => {
  console.error(`\n${C.red}冒烟脚本自身异常：${e.stack || e}${C.reset}`);
  process.exit(1);
});
