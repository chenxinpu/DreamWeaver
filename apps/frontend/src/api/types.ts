/* ============================================================================
 * 织梦 DreamWeaver V2 · API 数据类型（对齐 apps/frontend/docs/ITER_V2_SPEC.md §2）
 * 全部日期统一 ISO 字符串：YYYY-MM-DDTHH:mm:ss+08:00（另有 dateKey=YYYY-MM-DD）
 * 说明：后端仍在并行开发，字段做宽松容错（大量可选），前端展示前需判空。
 * ==========================================================================*/

export type Role = 'consumer' | 'creator' | 'auditor' | 'admin';

export interface User {
  id: number;
  nickname: string;
  avatar: string;
  bio: string;
  role: Role;
  level: 0 | 1 | 2 | 3; // 能力认证等级（学习模块沿用）
  followers: number;
  following: number;
  body?: BodyMeasurement;
  createdAt: string;
  // 宽松容错（创作者聚合，users/:id 或 feed author 附带）
  worksCount?: number;
  productsCount?: number;
  certified?: boolean;
}

export interface BodyMeasurement {
  height: number; weight: number; bust: number; underBust: number;
  waist: number; hip: number; shoulderWidth: number; armLength: number;
  thigh: number; calf: number; neck: number; backLength: number;
  source: 'manual' | 'ai';
  updatedAt: string;
}

export type MaterialKind = 'dxf' | 'svg' | 'obj' | 'glb' | 'png' | 'jpg' | 'zprj' | 'ai' | 'pdf';

export interface ObjMesh {
  positions: number[];
  faces: number[];
  normals?: number[];
}

export interface Material {
  id: number;
  creatorId: number;
  title: string;
  kind: MaterialKind;
  ext: string;
  size: number;                 // 原始字节
  fileName: string;
  layerNames?: string[];
  entityCount?: number;         // dxf/svg 统计
  patternSvg?: string;          // dxf/svg → 打版图 svg 字符串
  objPreview?: { vertices: number; faces: number; mesh?: ObjMesh | null } | null;
  cover?: string;
  width?: number;
  height?: number;
  note?: string;
  parseWarn?: string;
  tags: string[];
  createdAt: string;
}

export interface Work {
  id: number;
  creatorId: number;
  title: string;
  category: string;              // 连衣裙/衬衫/半裙/外套/裤装/套装
  styleTags: string[];
  fabric: string;
  desc: string;
  cover: string;
  patternMatIds: number[];       // 打版素材（2D 板片）
  modelMatIds: number[];         // 3D 素材
  mediaImages: string[];
  createdAt: string;
}

export interface PostComment {
  id: number;
  userId: number;
  content: string;
  createdAt: string;
  likes: number;
  author?: User;                 // 后端补全
}

export interface Post {
  id: number;
  authorId: number;
  workId?: number;
  content: string;
  images: string[];
  tags: string[];
  createdAt: string;
  dateKey: string;
  likes: number;
  likedBy: number[];
  comments: PostComment[];
  commentCount: number;
  shareCount: number;
  // ---- feed 详情后端补充字段（宽松容错） ----
  author?: User | null;
  linkedWork?: Work | null;
  patternMatIds?: number[];
  modelMatIds?: number[];
  viewer?: { liked?: boolean; collected?: boolean; followed?: boolean };
  // 兼容：某些版本把素材引用直接放在顶层
  materials?: Material[];
  // 列表/详情 DTO 附带（后端 dto.ts）
  materialPreview?: { id: number; kind: string; fileName: string; cover?: string }[];
  patternCount?: number;
  modelCount?: number;
  inPool?: boolean;
  /** 作者查看自己推文时的「市场认可进度」（GET /posts/:id & 发布响应附带） */
  market?: {
    p60: number;
    p60Note: string;
    commentTarget: number;
    likes: number;
    comments: number;
    qualified: boolean;
  };
}

export interface PoolEntry {
  id: number;
  postId: number;
  workId?: number;
  creatorId: number;
  qualifiedAt: string;
  dateKey: string;
  reason: string;                 // '点赞超过当日P60' | '评论数≥10' | '同时满足'
  likeP60: number;
  likeAtQualify: number;
  commentAtQualify: number;
  notifiedAt?: string;
  // ---- 后端 poolEntryDTO 附带 ----
  post?: Post | null;
  work?: Work | null;
  creator?: User | null;
  /** 该作品对应的商品状态（null = 尚未上架） */
  productStatus?: string | null;
  productId?: number | null;
  /** 该作品对应的橱窗状态（draft/submitted/approved/rejected 或 null） */
  windowStatus?: string | null;
}

export interface FabricPart {
  part: string;
  fabric: string;
  note?: string;
}

export interface SpecSizeChartRow {
  size: string;
  bust?: number;
  waist?: number;
  hip?: number;
  shoulder?: number;
  sleeve?: number;
  length?: number;
}

export interface WindowMaterialSpec {
  label: string;
  sizeChart: SpecSizeChartRow[];
  note?: string;
}

export interface WindowAuditLog {
  passed: boolean;
  note: string;
  at: string;
}

export interface WindowMaterial {
  id: number;
  creatorId: number;
  workId: number;
  postId?: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  photos: string[];
  partsFabric: FabricPart[];
  spec: WindowMaterialSpec;
  productName: string;
  category: string;
  styleTags: string[];
  price: number;
  baseFee: number;
  patternMatIds: number[];
  modelMatIds: number[];
  auditLog?: WindowAuditLog[];
  auditMissing?: string[];          // 最近一次被拒的缺失项（后端返回）
  createdAt: string;
  updatedAt: string;
  product?: Product | { id: number; title: string; status?: string } | null;  // 通过审核后的商品（列表为摘要）
  work?: Work | { id: number; title: string; cover?: string } | null;
  // 后端窗口操作响应附带的审计/完整性字段（宽松）
  audit?: { pass: boolean; missing: string[]; note: string; product?: { id: number; title: string } | null };
  completeness?: { ok?: boolean; pass?: boolean; missing?: string[] };
  offShelf?: boolean;
}

export interface AiProductDetail {
  intro: string;
  story: string;
  sections: { icon?: string; title: string; body: string }[];
  sizeChart: SpecSizeChartRow[];
  partsFabric: string[];
  manufacturer: string;
  prodDays: number;
  baseFeeNote: string;
}

export interface ProductDetailEdit {
  intro?: string;
  story?: string;
  sections?: { title: string; body: string }[];
  manufacturer?: string;
}

export interface Product {
  id: number;
  creatorId: number;
  workId: number;
  windowId: number;
  title: string;
  category: string;
  styleTags: string[];
  price: number;
  baseFee: number;
  cover: string;
  images: string[];
  patternMatIds: number[];
  modelMatIds: number[];
  aiDetail: AiProductDetail;
  detailEdits?: ProductDetailEdit;
  views: number;
  sales: number;
  status: 'draft' | 'onSale' | 'offShelf';
  createdAt: string;
  creator?: User;                // 详情接口附带
  work?: Work;
  /** creator/products 列表附带：对应橱窗状态 */
  windowStatus?: string | null;
  window?: { id: number; status: string; updatedAt?: string; auditLog?: WindowAuditLog[] } | null;
  viewer?: { liked?: boolean; collected?: boolean };
  patternMaterials?: { id: number; kind: string; fileName: string; cover?: string }[];
  modelMaterials?: { id: number; kind: string; fileName: string; cover?: string }[];
  /** 是否支持私人定制（商城列表字段） */
  hasCustom?: boolean;
}

export type OrderKind = 'direct' | 'custom';
export type OrderStatus = 'created' | 'paid' | 'producing' | 'qc' | 'shipping' | 'received' | 'completed' | 'cancelled';

export interface SpecLine {
  part: string;
  body?: number;
  ease?: number;
  base?: number;
  target?: number;
  flag?: 'ok' | 'tight' | 'loose';
  advise?: string;
}

export interface OrderSpecUsed {
  size?: string;
  adjusted?: SpecLine[];
  body?: BodyMeasurement;
}

export interface OrderAmounts {
  price: number;    // 原价部分
  baseFee: number;  // 基础费用（定制专用；direct=0）
  total: number;
}

export interface TimelineNode { t: string; text: string }

export interface StageInfo {
  name: string;
  percent: number;
  eta: string;
  doneAt?: string;
}

export interface QcReport {
  pass: boolean;
  items: { k: string; v: string }[];
  at: string;
}

export interface LogisticsInfo {
  company: string;
  trackingNo: string;
  traces: { time: string; text: string }[];
}

export interface ReturnRequest {
  state: 'none' | 'returning' | 'done' | 'exchanged';
  refundAmount: number;
  baseFeeKept: number;
  reason: string;
  at: string;
  resaleListingId?: number;
  newOrderId?: number;
}

export interface Order {
  id: number;
  no: string;
  productId: number;
  productTitle: string;
  cover: string;
  creatorId: number;
  kind: OrderKind;
  buyerId: number;
  specUsed?: OrderSpecUsed;
  amounts: OrderAmounts;
  status: OrderStatus;
  timeline: TimelineNode[];
  stage?: StageInfo;
  qcReport?: QcReport;
  logistics?: LogisticsInfo;
  returnReq?: ReturnRequest;
  paidAt?: string;
  shippedAt?: string;
  receivedAt?: string;
  createdAt: string;
  creator?: User;
  product?: Product;
}

export interface ResaleListing {
  id: number;
  orderId: number;
  productId: number;
  originalTitle: string;
  sellerId: number;
  photo: string;
  sizeLabel: string;
  listPrice: number;              // 当前标价
  originalPrice?: number;         // 原价（划线）
  platformFeeRate: number;        // 平台佣金（仓储物流）
  status: 'active' | 'sold' | 'cancelled';
  soldTo?: number;
  soldAt?: string;
  netToSeller?: number;
  feeCharged?: number;
  createdAt: string;
  product?: Product;
  seller?: User;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;   // pool_remind|audit|product|order|refund|resale|commission|system|like|comment
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface CommissionRule {
  id: number;
  name: string;
  desc: string;
  active: boolean;
  kind: 'level' | 'penalty';
  when: string;
}

export interface LedgerEvent {
  id: number;
  userId: number;
  kind: string;
  amount: number;
  balance: number;
  refNo: string;
  createdAt: string;
}

export interface SettingsState {
  lastPoolEval?: string;
}

/* --------------------------- 接口载荷 / 结果类型 --------------------------- */

export interface LoginResult { token: string; user: User }

export interface MePayload {
  user: User;
  unread: number;               // 未读通知数聚合
  stats?: {
    followers: number; following: number; likesGot: number; collected: number; works: number;
  };
}

export interface FeedItem extends Post {}

export interface Paged<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore?: boolean;
}

export interface AdaptRow {
  part: string;
  body: number;
  ease: number;
  base: number;
  target: number;
  flag: 'ok' | 'tight' | 'loose';
  advise?: string;
}

export interface AdaptResult {
  baseSize: string;
  chart: AdaptRow[];            // 成衣尺寸对照（宽松容错：也可能是 adjustedSpec 别名）
  adjustedSpec: AdaptRow[];
  fitAlerts: string[];          // 系统提示不适配的规格描述
  totalEstimate: { price: number; baseFee: number; total: number };
  sizeChart?: SpecSizeChartRow[];
  context?: CustomContext;
}

export interface ChatOption { key: string; title: string; desc?: string }

export interface ChatMessage { role: 'user' | 'assistant'; content: string; options?: ChatOption[]; imageUrl?: string; imageTitle?: string }

export interface ChatResult {
  reply: string;
  options: ChatOption[];
  imageUrl?: string;
}

export interface VariantResult {
  image?: string;      // svg data url / url / 裸 svg 字符串
  title?: string;
  desc?: string;
  applied?: Record<string, unknown>;
}

export interface CustomContext {
  product: Product;
  sizeChart: SpecSizeChartRow[];
  easeTemplate: Record<string, number>;
  baseFeeNote: string;
}

/* ------------------------- 创作者平台（/creator）接口类型 -------------------------
 * 均按后端真实响应（Java 核心 web/CreatorController.java · engine/DashboardEngine.java ·
 * engine/commission.ts · routes/dto.ts）标注；保留旧版字段（可选）以向后兼容。
 * --------------------------------------------------------------------------------*/

export interface CreatorOverview {
  welcome?: { nickname?: string; productCount?: number };
  counts?: {
    materials?: number; works?: number; posts?: number;
    poolTotal?: number; poolUnhandled?: number;
    windowDraft?: number; windowSubmitted?: number;
    windowApproved?: number; windowRejected?: number;
    productOnSale?: number; orderToday?: number;
    [k: string]: number | undefined;
  };
  todo?: { type: string; text: string; link: string }[];
  recentOrders?: {
    id: number; no: string; productTitle: string; status: string; total: number;
    createdAt: string; buyerId: number;
  }[];
  kpi?: DashboardKpis;
  meta?: PoolMetaInfo;
  // ---- 旧字段（宽松容错） ----
  poolCount?: number;
  windowDraft?: number;
  windowApproved?: number;
  windowRejected?: number;
  productCount?: number;
  todayViews?: number;
  todaySales?: number;
  withdrawable?: number;
  pendingCommission?: number;
  stats?: Record<string, unknown>;
}

export interface DashboardKpis {
  windowCount?: number;      // 橱窗上架商品数
  revenue30?: number;        // 近 N 天成交额
  conversion?: number;       // 转化率 %
  returnRate?: number;       // 退货率 %
  estCommission?: number;    // 预估佣金
  orders?: number;
  views?: number;
  // ---- 兼容旧命名 ----
  products?: number;
  amount30d?: number;
  conversionRate?: number;
  commissionEstimate?: number;
  orders30d?: number;
}
export interface DashboardKpi extends DashboardKpis {}   // 旧名别名

export interface DashboardTrendPoint { date: string; amount: number; orders: number }

export interface DashboardProductCompare {
  productId: number; title: string; cover: string; sales: number; amount: number; returnRate: number;
}

export interface DashboardRow {
  productId: number; title: string; cover: string;
  views: number; orders: number; conversion: number; sales: number;
  returnRate: number; commissionRate: number; amount: number;
}

export interface DashboardData {
  days?: number;
  range?: { days: number; from: string; to: string };
  productFilter?: number | null;
  kpis?: DashboardKpis;
  trend?: DashboardTrendPoint[];
  returnTrend?: { date: string; rate: number }[];
  productCompare?: DashboardProductCompare[];
  channel?: { name: string; value: number }[];
  rows?: DashboardRow[];
  poolDup?: { dup: number; notice: string };
  explain?: string[];
  // ---- 旧版字段（向后兼容） ----
  kpi?: DashboardKpi;
  amountTrend?: { date: string; amount: number; orders: number }[];
  productBars?: { name: string; value: number; sales: number; conversion: number }[];
  channelShare?: { name: string; value: number; color?: string }[];
  table?: { productId: number; title: string; views: number; sales: number; conversionRate: number; returnRate: number; commissionRate: number; cover?: string }[];
  poolDuplication?: { level: number; desc: string };
}

export interface BiSeriesPoint { date: string; value: number }

export interface BiSeries {
  metric?: string;
  days?: number;
  series?: BiSeriesPoint[];
  // ---- 旧版 ----
  labels?: string[];
  values?: number[];
}

export interface CommissionData {
  withdrawable?: number;
  pending?: number;
  settled?: number;
  estimatedTotal?: number;
  ledger?: LedgerEvent[];
  rules?: CommissionRule[];
  rateExplain?: string;
  withdrawHistory?: LedgerEvent[];
  // ---- 旧版 ----
  rateBase?: number;
}

export interface CommissionRate {
  rate?: number;
  base?: number;
  breaks?: { name: string; delta: number }[];
  reasons?: string[];
  explain?: string;
  /** 单品查询时附带 */
  product?: { id: number; title: string; cover: string } | null;
  productId?: number;
  /** 不带 productId 时：全部在售商品 */
  list?: (CommissionRate & { title: string; cover: string })[];
}

export interface PoolMetaInfo {
  engine?: string;
  lastEval?: string | null;
  rule?: string[];
  // ---- 兼容旧版 /pool/meta ----
  lastRun?: string;
  desc?: string;
}

export interface PoolEvalResult {
  evaluated?: number;
  dateKey?: string;
  p60?: number;
  n?: number;
  added?: PoolEntry[];
  explain?: string[];
  // ---- 旧版 ----
  meta?: PoolMetaInfo;
}

/* 素材导入帮助（后端 routes/materials.ts 真实形状） */
export interface ImportHelpFormat {
  kind: string; ext: string; desc: string; demo: string;
}
export interface ImportSampleFile {
  fileName: string; size: number; kind: string;
}
export interface ImportHelpResult {
  formats: ImportHelpFormat[];
  samples: ImportSampleFile[];
  samplePath?: string;
}

export interface MaterialListResult extends Paged<Material> {
  group?: Record<string, number>;
}

/** 工作/橱窗列表接口统一返回 {list,total} 而非标准分页，这里给出便捷别名 */
export interface SimpleList<T> { list: T[]; total: number; page?: number; pageSize?: number }

/* --------------------------- 常用常量（品类/状态文案） --------------------------- */

export const PRODUCT_CATEGORIES = ['连衣裙', '衬衫', '半裙', '外套', '裤装', '套装'] as const;

export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  created: '待支付', paid: '待生产', producing: '生产中', qc: '质检中',
  shipping: '已发货', received: '已收货', completed: '已完成', cancelled: '已取消',
};

export const RESALE_TEXT = { active: '在售', sold: '已售出', cancelled: '已下架' } as const;

export const NOTIFY_ICON: Record<string, string> = {
  pool_remind: 'layers', audit: 'shield', product: 'store', order: 'package',
  refund: 'wallet', resale: 'cart', commission: 'chart', system: 'bell',
  like: 'heart', comment: 'comment',
};
