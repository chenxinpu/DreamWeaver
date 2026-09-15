#!/usr/bin/env node
/**
 * 织梦 DreamWeaver · Java 后端 WebSocket 实时通道冒烟测试
 * （原 apps/gateway/scripts/ws-smoke.mjs 的迁移版，协议以 apps/gateway/README.md §5 为准）
 *
 * 覆盖：
 *  1) 连接即收到 welcome（含 peerId / wsPath / pingIntervalMs / pongTimeoutMs）
 *  2) subscribe → subscribed（含去重、unsubscribe）
 *  3) ping → pong
 *  4) 两个客户端同房间：A 发 danmaku.send，B 收到 {topic:"live:room1",event:"danmaku"}
 *  5) im.send（?userId=1）→ 发送方 im.ack + 对端 {topic:"im:1-14",event:"message"}；无身份 → IM_NO_USER
 *  6) POST /internal/publish（正确 token → 订阅方收到广播 / 错误或缺失 token → 401 / 缺 topic → 400）
 *  7) GET /internal/stats → connections / rooms / subscriptions / peers 结构
 *  8) 真实业务推送：POST /api/orders/{id}/pay → 订阅 order:<id> 的客户端收到 {event:"status"}
 *
 * 运行（需后端已在 127.0.0.1:8787 启动）：
 *   node apps/backend/scripts/ws-smoke.mjs
 *   DW_BACKEND_URL=http://127.0.0.1:8790 node apps/backend/scripts/ws-smoke.mjs
 *
 * 注意：第 8 节会真实调用支付接口（必要时先下一单），会写入演示数据 apps/backend/data/db.json；
 *       可用 DW_SKIP_BUSINESS=1 跳过该节。
 * Node 22 自带全局 WebSocket / fetch，无需任何依赖。
 */

const BASE = (process.env.DW_BACKEND_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const WS_BASE = BASE.replace(/^http/, 'ws');
const INTERNAL_TOKEN = process.env.DW_INTERNAL_TOKEN || 'dw-internal-dev-token';
const BUYER_ID = Number(process.env.DW_SMOKE_BUYER_ID || 14);
const SKIP_BUSINESS = process.env.DW_SKIP_BUSINESS === '1';

let pass = 0;
let fail = 0;
let skip = 0;

function check(name, condition, detail) {
  if (condition) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${name}${detail === undefined ? '' : ` → ${JSON.stringify(detail).slice(0, 400)}`}`);
  }
}
function skipped(name, why) {
  skip += 1;
  console.log(`  ⏭️  ${name}（跳过：${why}）`);
}
function section(title) {
  console.log(`\n=== ${title} ===`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** HTTP 助手：返回 {status, json, text} */
async function http(path, opts = {}) {
  const headers = { accept: 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.internalToken) headers['X-Internal-Token'] = opts.internalToken;
  let body;
  if (opts.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method: opts.method || 'GET', headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, json, text };
}

/** 带帧队列的 WebSocket 测试客户端（优先扫描已收到的帧） */
function connectClient(query = '') {
  const ws = new WebSocket(`${WS_BASE}/ws${query}`);
  const frames = [];
  const waiters = [];
  ws.addEventListener('message', (ev) => {
    let frame;
    try {
      frame = JSON.parse(String(ev.data));
    } catch {
      frame = { raw: String(ev.data) };
    }
    frames.push(frame);
    for (let i = waiters.length - 1; i >= 0; i -= 1) {
      if (waiters[i].match(frame)) {
        const w = waiters.splice(i, 1)[0];
        w.resolve(frame);
      }
    }
  });
  return {
    ws,
    frames,
    opened: new Promise((resolve, reject) => {
      ws.addEventListener('open', () => resolve(), { once: true });
      ws.addEventListener('error', (e) => reject(new Error(`ws error: ${e?.message || 'unknown'}`)), { once: true });
    }),
    send: (obj) => ws.send(JSON.stringify(obj)),
    wait(match, timeoutMs = 3000) {
      const found = frames.find(match);
      if (found) return Promise.resolve(found);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('超时未收到符合条件的帧')), timeoutMs);
        waiters.push({
          match,
          resolve: (f) => {
            clearTimeout(timer);
            resolve(f);
          },
        });
      });
    },
    close: () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}

async function waitOrNull(client, match, timeoutMs = 3000) {
  try {
    return await client.wait(match, timeoutMs);
  } catch {
    return null;
  }
}

const clients = [];
function track(c) {
  clients.push(c);
  return c;
}

/* ------------------------------ 0. 健康检查 ------------------------------ */
section('后端可用性');
const health = await http('/api/health');
check('GET /api/health → 200', health.status === 200 && health.json?.ok === true, health.json);

/* ------------------------------ 1. welcome ------------------------------ */
section('1) 连接 → welcome');
const A = track(connectClient('?userId=1'));
const B = track(connectClient('?userId=14'));
await Promise.all([A.opened, B.opened]);
const wa = await waitOrNull(A, (f) => f.type === 'welcome');
check('连接后收到 welcome（含 peerId）', !!wa?.peerId, wa);
check('welcome 带 wsPath/pingIntervalMs/pongTimeoutMs', wa?.wsPath === '/ws'
  && wa?.pingIntervalMs === 30000 && wa?.pongTimeoutMs === 60000, wa);

/* ------------------------------ 2. subscribe ------------------------------ */
section('2) subscribe / unsubscribe（去重）');
A.send({ type: 'subscribe', topics: ['order:1', 'live:room1', 'im:1-14'] });
const subA = await waitOrNull(A, (f) => f.type === 'subscribed');
check('subscribe → subscribed（回执含全部 topic）',
  ['order:1', 'live:room1', 'im:1-14'].every((t) => subA?.topics?.includes(t)), subA);

B.send({ type: 'subscribe', topics: ['live:room1', 'im:1-14'] });
const subB = await waitOrNull(B, (f) => f.type === 'subscribed' && f.topics?.includes('live:room1'));
check('B 订阅 live:room1 / im:1-14 → 回执', !!subB, subB);

A.send({ type: 'subscribe', topics: ['live:room1'] });
const dup = await waitOrNull(A, (f) => f.type === 'subscribed' && Array.isArray(f.topics) && f.topics.length === 0);
check('重复订阅同一 topic 不重复计数（topics 为空）', !!dup, dup);

/* ------------------------------ 3. ping / pong ------------------------------ */
section('3) ping → pong');
A.send({ type: 'ping', ts: 12345 });
const pong = await waitOrNull(A, (f) => f.type === 'pong');
check('ping → pong（带 ts，且 echo 回传入 ts）', typeof pong?.ts === 'number' && pong?.echo === 12345, pong);

/* ------------------------------ 4. 弹幕广播 ------------------------------ */
section('4) 弹幕：同房间双客户端广播');
A.send({ type: 'danmaku.send', room: 'room1', content: '好看！' });
const dmB = await waitOrNull(B, (f) => f.topic === 'live:room1' && f.event === 'danmaku');
const dmA = await waitOrNull(A, (f) => f.topic === 'live:room1' && f.event === 'danmaku');
check('同房间两个客户端都收到弹幕帧', dmA?.data?.content === '好看！' && dmB?.data?.content === '好看！', dmB);
check('弹幕帧形状 {topic,event,data,ts} 且 data 含 room/content/from/at',
  dmB?.topic === 'live:room1' && dmB?.event === 'danmaku' && typeof dmB?.ts === 'number'
  && dmB?.data?.room === 'room1' && typeof dmB?.data?.at === 'string',
  dmB);

/* ------------------------------ 5. IM ------------------------------ */
section('5) 即时聊天 im.send');
A.send({ type: 'im.send', to: 14, content: '在吗' });
const ack = await waitOrNull(A, (f) => f.type === 'im.ack');
check('发送方收到 im.ack（含会话房间名 im:1-14）', ack?.data?.topic === 'im:1-14', ack);
const msgB = await waitOrNull(B, (f) => f.topic === 'im:1-14' && f.event === 'message');
check('对端收到 {topic:"im:1-14",event:"message"}',
  msgB?.data?.from === 1 && msgB?.data?.to === 14 && msgB?.data?.content === '在吗', msgB);

const C = track(connectClient());   // 无 token、无 userId
await C.opened;
await waitOrNull(C, (f) => f.type === 'welcome');
C.send({ type: 'im.send', to: 1, content: '我是谁' });
const noUser = await waitOrNull(C, (f) => f.type === 'error' && f.code === 'IM_NO_USER');
check('无身份连接 im.send → error IM_NO_USER', !!noUser && typeof noUser?.msg === 'string', noUser);

C.send({ type: 'unknown.type' });
const badMsg = await waitOrNull(C, (f) => f.type === 'error' && f.code === 'BAD_MESSAGE');
check('未知消息类型 → error BAD_MESSAGE（README §5.1 口径）', !!badMsg, badMsg);

C.send({ type: 'im.send', to: 1, content: '非 JSON 之外的兜底' });
await sleep(50);
check('IM_NO_USER 后连接仍可用（未被动断开）', noUser !== null && C.ws.readyState === 1, C.ws.readyState);

/* ------------------------------ 6. /internal/publish ------------------------------ */
section('6) 内部事件入口 POST /internal/publish');
const pub = await http('/internal/publish', {
  method: 'POST',
  internalToken: INTERNAL_TOKEN,
  body: { topic: 'order:1', event: 'status', data: { status: 'producing', no: 'ZM-SMOKE-1' } },
});
check('正确 token → {"ok":true,"data":{topics,event,delivered}}',
  pub.status === 200 && pub.json?.ok === true && Array.isArray(pub.json?.data?.topics)
  && pub.json?.data?.event === 'status' && typeof pub.json?.data?.delivered?.['order:1'] === 'number',
  pub.json);
const pubFrame = await waitOrNull(A, (f) => f.topic === 'order:1' && f.event === 'status');
check('订阅 order:1 的连接收到广播帧',
  pubFrame?.data?.status === 'producing' && pubFrame?.data?.no === 'ZM-SMOKE-1', pubFrame);

const pub401 = await http('/internal/publish', {
  method: 'POST',
  internalToken: 'wrong-token',
  body: { topic: 'order:1', event: 'status', data: {} },
});
check('错误 token → 401 {"ok":false,"code":"UNAUTHORIZED"}',
  pub401.status === 401 && pub401.json?.ok === false && pub401.json?.code === 'UNAUTHORIZED', pub401.json);
const pubNoToken = await http('/internal/publish', {
  method: 'POST',
  body: { topic: 'order:1', event: 'status', data: {} },
});
check('缺失 token → 401', pubNoToken.status === 401 && pubNoToken.json?.code === 'UNAUTHORIZED', pubNoToken.json);
const pub400 = await http('/internal/publish', {
  method: 'POST',
  internalToken: INTERNAL_TOKEN,
  body: { event: 'status', data: {} },
});
check('缺 topic → 400 BAD_REQUEST', pub400.status === 400 && pub400.json?.code === 'BAD_REQUEST', pub400.json);
const pubNoEvent = await http('/internal/publish', {
  method: 'POST',
  internalToken: INTERNAL_TOKEN,
  body: { topic: 'order:1', data: {} },
});
check('缺 event → 400 BAD_REQUEST', pubNoEvent.status === 400 && pubNoEvent.json?.code === 'BAD_REQUEST', pubNoEvent.json);

/* ------------------------------ 7. /internal/stats ------------------------------ */
section('7) 内部统计 GET /internal/stats');
const stats = await http('/internal/stats', { internalToken: INTERNAL_TOKEN });
const sd = stats.json?.data;
check('正确 token → 200 {"ok":true,"data":{connections,rooms,subscriptions,peers}}',
  stats.status === 200 && stats.json?.ok === true && typeof sd?.connections === 'number'
  && typeof sd?.rooms === 'number' && sd?.subscriptions !== null && typeof sd?.subscriptions === 'object'
  && Array.isArray(sd?.peers), stats.json);
check('统计含每连接订阅明细（peers[].topics 为数组）',
  Array.isArray(sd?.peers) && sd.peers.length >= 3 && sd.peers.every((p) => Array.isArray(p.topics)), sd?.peers);
check('subscriptions 为「topic → 订阅数」对象（live:room1 ≥ 2）',
  typeof sd?.subscriptions?.['live:room1'] === 'number' && sd.subscriptions['live:room1'] >= 2, sd?.subscriptions);
check('peers 含已解析身份（userId）', sd?.peers?.some((p) => p.userId === 1) && sd?.peers?.some((p) => p.userId === 14), sd?.peers);
const stats401 = await http('/internal/stats');
check('stats 缺 token → 401', stats401.status === 401 && stats401.json?.code === 'UNAUTHORIZED', stats401.json);

/* ------------------------------ 8. 真实业务推送 ------------------------------ */
section('8) 真实业务推送：支付订单 → order:<id> 的 status 帧');
if (SKIP_BUSINESS) {
  skipped('订单支付实时推送', 'DW_SKIP_BUSINESS=1');
} else {
  const login = await http('/api/auth/login', { method: 'POST', body: { userId: BUYER_ID } });
  const buyerToken = login.json?.data?.token;
  check(`登录买家 ${BUYER_ID} 号账号取得 access token`, typeof buyerToken === 'string' && buyerToken.length > 0, login.json);

  // 待支付订单：优先复用已有 created 订单；没有就先下一单（会写入演示数据）
  let target = null;
  const mine = await http('/api/orders/mine?status=created', { token: buyerToken });
  target = mine.json?.data?.list?.[0] ?? null;
  if (!target) {
    const mall = await http('/api/mall/products?pageSize=10');
    for (const p of mall.json?.data?.list ?? []) {
      const created = await http('/api/orders', {
        method: 'POST',
        token: buyerToken,
        body: { productId: p.id, kind: 'direct', size: 'M' },
      });
      if (created.status === 200 && created.json?.ok === true) {
        target = created.json.data;
        break;
      }
    }
  }
  check('取得一张待支付订单（复用已有 created 或新下一单）', !!target?.id, target);

  if (!target?.id) {
    check('订单支付实时推送', false, '无法取得待支付订单');
  } else {
    const D = track(connectClient(`?token=${buyerToken}`));
    await D.opened;
    const wd = await waitOrNull(D, (f) => f.type === 'welcome');
    check('用 ?token= 连接成功（welcome 正常）', !!wd?.peerId, wd);

    // 身份走 token → AuthService.userIdOf 解析（im.send 的 from 应为买家 id）
    D.send({ type: 'im.send', to: 7, content: 'token 身份解析' });
    const ackD = await waitOrNull(D, (f) => f.type === 'im.ack');
    check('?token= 连接的身份可用（im.ack.data.from = 登录用户）', ackD?.data?.from === BUYER_ID, ackD);

    D.send({ type: 'subscribe', topics: [`order:${target.id}`] });
    const subD = await waitOrNull(D, (f) => f.type === 'subscribed' && f.topics?.includes(`order:${target.id}`));
    check(`订阅 order:${target.id} 成功`, !!subD, subD);

    const pay = await http(`/api/orders/${target.id}/pay`, { method: 'POST', token: buyerToken });
    check(`POST /api/orders/${target.id}/pay → 200`, pay.status === 200 && pay.json?.ok === true, pay.json?.msg || pay.json);

    const frame = await waitOrNull(D, (f) => f.topic === `order:${target.id}` && f.event === 'status', 4000);
    check(`订阅方收到 {topic:"order:${target.id}",event:"status"}（payOrder 触发）`,
      frame?.data?.status === 'paid', frame);
    check('订单状态帧字段齐全（orderId/no/status/buyerId/creatorId/productId/productTitle/at）',
      frame?.data?.orderId === target.id && typeof frame?.data?.no === 'string'
      && typeof frame?.data?.buyerId === 'number' && typeof frame?.data?.creatorId === 'number'
      && typeof frame?.data?.productId === 'number' && typeof frame?.data?.productTitle === 'string'
      && typeof frame?.data?.at === 'string',
      frame);
  }
}

/* ------------------------------ 收尾 ------------------------------ */
section('收尾');
A.send({ type: 'unsubscribe', topics: ['live:room1'] });
const unsub = await waitOrNull(A, (f) => f.type === 'unsubscribed' && f.topics?.includes('live:room1'));
check('unsubscribe → unsubscribed 回执', !!unsub, unsub);
for (const c of clients) c.close();
await sleep(200);

console.log(`\n结果：pass=${pass} fail=${fail} skip=${skip}`);
process.exit(fail === 0 ? 0 : 1);
