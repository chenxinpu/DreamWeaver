/* ============================================================================
 * 织梦 DreamWeaver V2 · API 客户端
 *  - base 相对 '/api'（vite dev 代理 → http://localhost:8787）
 *  - token 从 localStorage('zm_v2_token') 注入 Authorization: Bearer
 *  - 统一服务端 {ok:true,data} | {ok:false,msg} 契约；错误抛 ApiError（中文提示）
 *  - 按模块导出 api.{auth,users,materials,works,posts,feed,pool,window,
 *    products,custom,orders,resale,notifications,creator,admin,dev}
 * ==========================================================================*/
import type {
  AdaptResult, BiSeries, ChatResult, CommissionData, CommissionRate, CreatorOverview,
  CustomContext, DashboardData, FeedItem, ImportHelpResult, LedgerEvent, LoginResult,
  Material, MaterialListResult, MePayload, Notification, Order, OrderKind, Paged,
  PoolEvalResult, PoolEntry, PoolMetaInfo, Post, Product, ResaleListing, Role, User,
  SimpleList, VariantResult, WindowMaterial, Work,
} from './types';

export const TOKEN_KEY = 'zm_v2_token';

export class ApiError extends Error {
  code: string;
  ok = false as const;
  constructor(msg: string, code = 'unknown') {
    super(msg);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}
export const isLoggedIn = () => !!getToken();

/** 网络错误 / 服务端降级文案（后端未启动时页面据此展示友好提示） */
export function networkHint(): string {
  return '网络请求失败：请先启动后端服务（apps/server，端口 8787），或检查网络连接。';
}

/* --------------------------- 底层请求 --------------------------- */
function qs(params?: Record<string, string | number | boolean | undefined | null>) {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined | null>, raw?: boolean): Promise<T> {
  // 兼容旧调用：GET/HEAD/DELETE 且第 3 参传入纯对象时，视为查询参数（查询参数不能作为请求体发送）
  const isQueryMethod = method === 'GET' || method === 'HEAD' || method === 'DELETE';
  let query = params;
  let reqBody = body;
  if (isQueryMethod && query === undefined && reqBody !== undefined && typeof reqBody === 'object' && !Array.isArray(reqBody)) {
    query = reqBody as Record<string, string | number | boolean | undefined | null>;
    reqBody = undefined;
  }
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload: string | undefined;
  if (reqBody !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(reqBody);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs(query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(networkHint(), 'network');
  }
  let json: unknown = null;
  try { json = await res.json(); } catch { /* non-json */ }
  if (raw) return json as T;
  if (!res.ok || (json as { ok?: boolean } | null)?.ok === false) {
    const j = json as { msg?: string; code?: string } | null;
    const msg = j?.msg || (res.ok ? '请求失败，请稍后再试' : `服务异常（HTTP ${res.status}）`);
    throw new ApiError(msg, j?.code || String(res.status));
  }
  const d = json as { data?: T } | null;
  return (d && 'data' in d ? d.data : json) as T;
}

/* 请求体的宽松类型（分页查询参数） */
type Params = Record<string, string | number | boolean | undefined | null>;

/* --------------------------- 模块化 API --------------------------- */
export const api = {
  auth: {
    login: (userId: number) => request<LoginResult>('POST', '/auth/login', { userId }),
    switch: (userId: number) => request<LoginResult>('POST', '/auth/switch', { userId }),
  },
  me: () => request<MePayload>('GET', '/me'),
  users: {
    get: (id: number | string) => request<User>('GET', `/users/${id}`),
    /** 保存“我”的体型（前端约定 POST /api/me/body；后端契约若未实现需降级本地保存） */
    saveMyBody: (body: Record<string, unknown>) => request<{ user?: User; ok?: boolean }>('POST', '/me/body', body),
  },
  materials: {
    import: (payload: { fileName: string; kind?: string; content?: string; base64?: string; note?: string; title?: string; tags?: string[] }) =>
      request<Material>('POST', '/materials/import', payload),
    list: (p?: { mine?: boolean; kind?: string; kw?: string; page?: number; pageSize?: number }) =>
      request<MaterialListResult>('GET', '/materials', { mine: p?.mine ? 1 : undefined, kind: p?.kind, kw: p?.kw, page: p?.page, pageSize: p?.pageSize }),
    get: (id: number | string) => request<Material>('GET', `/materials/${id}`),
    remove: (id: number | string) => request<{ ok: boolean }>('DELETE', `/materials/${id}`),
    importHelp: () => request<ImportHelpResult>('GET', '/materials/import-help'),
    sampleContent: (file: string) =>
      request<{ fileName: string; kind: string; content: string; size: number }>('GET', '/materials/sample-content', { file }),
  },
  works: {
    create: (payload: Partial<Work>) => request<Work>('POST', '/works', payload),
    update: (id: number | string, patch: Partial<Work>) => request<Work>('PATCH', `/works/${id}`, patch),
    remove: (id: number | string) => request<{ deleted: boolean; id: number }>('DELETE', `/works/${id}`),
    mine: () => request<SimpleList<Work>>('GET', '/works/mine'),
    get: (id: number | string) => request<{ work: Work; inPool?: boolean; pool?: PoolEntry[]; product?: { id: number; status: string; title: string } | null }>('GET', `/works/${id}`),
  },
  posts: {
    create: (payload: Record<string, unknown>) => request<Post>('POST', '/posts', payload),
    get: (id: number | string) => request<FeedItem>('GET', `/posts/${id}`),
    mine: (p?: { days?: number; page?: number }) => request<Paged<FeedItem> & { days?: number }>('GET', '/posts/mine', p as Params),
    like: (id: number | string) => request<Post>('POST', `/posts/${id}/like`),
    unlike: (id: number | string) => request<Post>('POST', `/posts/${id}/unlike`),
    comment: (id: number | string, content: string) =>
      request<Post>('POST', `/posts/${id}/comment`, { content }),
    share: (id: number | string) => request<Post>('POST', `/posts/${id}/share`),
  },
  feed: {
    get: (p?: { tab?: 'rec' | 'follow' | 'hot'; page?: number; pageSize?: number }) =>
      request<Paged<FeedItem>>('GET', '/feed', { tab: p?.tab, page: p?.page, pageSize: p?.pageSize }),
    recommend: () => request<{ talents: User[]; picks: Post[] }>('GET', '/feed/recommend/seed'),
  },
  pool: {
    creatorPool: () => request<Paged<PoolEntry> & { meta?: PoolMetaInfo }>('GET', '/creator/pool'),
    meta: () => request<PoolMetaInfo>('GET', '/pool/meta'),
  },
  window: {
    mine: () => request<SimpleList<WindowMaterial>>('GET', '/creator/window'),
    get: (id: number | string) => request<WindowMaterial>('GET', `/creator/window/${id}`),
    submit: (payload: Record<string, unknown>) => request<WindowMaterial>('POST', '/creator/window', payload),
    submitId: (id: number | string) => request<WindowMaterial>('POST', `/creator/window/${id}/submit`),
    patch: (id: number | string, patch: Record<string, unknown>) =>
      request<WindowMaterial>('PATCH', `/creator/window/${id}`, patch),
    remove: (id: number | string) => request<{ deleted: boolean; id: number }>('DELETE', `/creator/window/${id}`),
  },
  products: {
    list: (p?: { category?: string; kw?: string; sort?: string; page?: number; pageSize?: number; creatorId?: number }) =>
      request<Paged<Product>>('GET', '/mall/products', p as Params),
    myAll: (p?: { status?: string; page?: number; pageSize?: number }) =>
      request<Paged<Product> & { counts?: Record<string, number> }>('GET', '/creator/products', p as Params),
    get: (id: number | string) => request<Product>('GET', `/products/${id}`),
    view: (id: number | string) => request<{ ok: boolean }>('POST', `/products/${id}/view`),
    like: (id: number | string) => request<{ ok: boolean }>('POST', `/products/${id}/like`),
    unlike: (id: number | string) => request<{ ok: boolean }>('POST', `/products/${id}/unlike`),
    editDetail: (id: number | string, detailEdits: Record<string, unknown>) =>
      request<Product>('POST', `/creator/products/${id}/edit-detail`, detailEdits),
    shelf: (id: number | string, onSale: boolean) =>
      request<Product>('PATCH', `/creator/products/${id}/shelf`, { action: onSale ? 'on' : 'off' }),
  },
  custom: {
    context: (productId: number | string) => request<CustomContext>('GET', `/custom/product/${productId}/context`),
    adapt: (payload: { productId: number; body: Record<string, unknown> }) =>
      request<AdaptResult>('POST', '/custom/adapt', payload),
    chat: (payload: { productId: number; history: { role: string; content: string }[]; body?: Record<string, unknown> }) =>
      request<ChatResult>('POST', '/custom/chat', payload),
    variant: (payload: { productId: number; optionKey: string }) =>
      request<VariantResult>('POST', '/custom/variant', payload),
    preview: (payload: { productId: number; body: Record<string, unknown>; options: string[] }) =>
      request<VariantResult>('POST', '/custom/preview', payload),
  },
  orders: {
    create: (payload: { productId: number; kind: OrderKind; size?: string; body?: Record<string, unknown>; adaptId?: number }) =>
      request<Order>('POST', '/orders', payload),
    pay: (id: number | string) => request<Order>('POST', `/orders/${id}/pay`),
    mine: (p?: { status?: string; page?: number; pageSize?: number }) =>
      request<Paged<Order>>('GET', '/orders/mine', p as Params),
    get: (id: number | string) => request<Order>('GET', `/orders/${id}`),
    devAdvance: (id: number | string) => request<Order>('POST', `/orders/${id}/dev-advance`),
    cancel: (id: number | string) => request<Order>('POST', `/orders/${id}/cancel`),
    confirmReceived: (id: number | string) => request<Order>('POST', `/orders/${id}/confirm-received`),
    returnOrder: (id: number | string, reason: string) => request<Order>('POST', `/orders/${id}/return`, { reason }),
    exchange: (id: number | string, reason: string) => request<{ order: Order; newOrder: Order }>('POST', `/orders/${id}/exchange`, { reason }),
    sellerMine: () => request<Paged<Order>>('GET', '/orders/seller/mine'),
  },
  resale: {
    list: (p?: { page?: number; pageSize?: number }) => request<Paged<ResaleListing>>('GET', '/mall/resale', p as Params),
    mine: () => request<Paged<ResaleListing>>('GET', '/resale/mine'),
    buy: (id: number | string) => request<ResaleListing>('POST', `/resale/${id}/buy`),
    setPrice: (id: number | string, listPrice: number) =>
      request<ResaleListing>('PATCH', `/resale/${id}/price`, { listPrice }),
    cancel: (id: number | string) => request<ResaleListing>('POST', `/resale/${id}/cancel`),
  },
  notifications: {
    list: (p?: { unread?: boolean; page?: number; pageSize?: number }) =>
      request<Paged<Notification> & { unreadCount?: number }>('GET', '/notifications', { unread: p?.unread ? 1 : undefined, page: p?.page, pageSize: p?.pageSize }),
    read: (ids?: number[] | 'all') => request<{ ok: boolean }>('POST', '/notifications/read', { ids }),
  },
  creator: {
    overview: () => request<CreatorOverview>('GET', '/creator/overview'),
    dashboard: (p?: { days?: number; productId?: number }) =>
      request<DashboardData>('GET', '/creator/dashboard', p as Params),
    commission: (p?: { days?: number }) =>
      request<CommissionData>('GET', '/creator/commission', p as Params),
    commissionRate: (productId?: number | string) =>
      request<CommissionRate>('GET', '/creator/commission/rate', { productId }),
    withdraw: (amount: number) => request<LedgerEvent>('POST', '/creator/commission/withdraw', { amount }),
    biSeries: (p?: { days?: number; metric?: 'order' | 'amount' | 'returnRate' }) =>
      request<BiSeries>('GET', '/creator/bi/series', p as Params),
  },
  admin: {
    /** 兼容旧调用方（数组语义，consumer 搜索用）；后端实际返回 {list,...} */
    users: (role?: Role) => request<User[]>('GET', '/admin/users', { role }),
    /** creator/audit 页使用的类型化版本（含 roleDesc/hint） */
    userList: (role?: Role) => request<{ list: (User & { roleDesc?: string })[]; roles?: string[]; hint?: string }>('GET', '/admin/users', { role }),
    windowForce: (id: number | string, pass: boolean, note?: string) =>
      request<{ window?: WindowMaterial; product?: { id: number; title: string } | null; note?: string }>('POST', `/admin/window/${id}/force`, { pass, note }),
  },
  dev: {
    reset: (seed = true) => request<{ ok: boolean; seeded?: boolean; before?: number; now?: number; msg?: string }>('POST', '/dev/reset', { seed }),
    evalPool: () => request<PoolEvalResult>('POST', '/dev/eval-pool'),
    surgeLikes: (postId: number | string, likes: number) =>
      request<{ postId: number; likesBefore: number; likesNow: number; p60: number; qualified: boolean; poolEntries: { id: number; reason: string }[]; note: string }>(
        'POST', '/dev/surge-likes', { postId: Number(postId), likes },
      ),
    health: () => request<{ ok: boolean; name?: string; time?: string }>('GET', '/health'),
    info: () => request<{ version?: string; entities?: Record<string, number> }>('GET', '/dev/info'),
  },
};

export type Api = typeof api;
export default api;
