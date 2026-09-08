/**
 * 织梦 DreamWeaver v2 —— 数据模型（对应 ITER_V2_SPEC §2）
 * 日期统一 YYYY-MM-DDTHH:mm:ss+08:00；dateKey=YYYY-MM-DD（东八区日）。
 * 额外的 *_int 字段为服务端内部使用（序列化给前端时会被裁剪或不影响 DTO 语义）。
 */

export type Role = 'consumer' | 'creator' | 'auditor' | 'admin';
export type Level = 0 | 1 | 2 | 3;

export interface BodyMeasurement {
  height: number; weight: number; bust: number; underBust: number; waist: number; hip: number;
  shoulderWidth: number; armLength: number; thigh: number; calf: number; neck: number; backLength: number;
  source: 'manual' | 'ai'; updatedAt: string;
}

export interface User {
  id: number; nickname: string; avatar: string; bio: string;
  role: Role; level: Level;
  followers: number; following: number;
  body?: BodyMeasurement;
  createdAt: string;
  // 内部字段（鉴权/关注/收藏演示）
  follows?: number[];
  collectProductIds?: number[];
  collectPostIds?: number[];
  passwordHint?: string;
}

export type MaterialKind = 'dxf' | 'svg' | 'obj' | 'glb' | 'png' | 'jpg' | 'zprj' | 'ai' | 'pdf';

export interface ObjMesh { positions: number[]; faces: number[]; normals?: number[]; }

export interface Material {
  id: number; creatorId: number; title: string; kind: MaterialKind;
  ext: string; size: number;
  fileName: string;
  layerNames?: string[]; entityCount?: number;
  patternSvg?: string;
  objPreview?: { vertices: number; faces: number; mesh?: ObjMesh | null } | null;
  cover?: string;
  width?: number; height?: number;
  note?: string; parseWarn?: string;
  tags: string[]; createdAt: string;
}

export interface Work {
  id: number; creatorId: number; title: string; category: string;
  styleTags: string[]; fabric: string; desc: string;
  cover: string;
  patternMatIds: number[]; modelMatIds: number[];
  mediaImages: string[];
  createdAt: string;
}

export interface CommentItem {
  id: number; userId: number; content: string; createdAt: string; likes: number;
}

export interface Post {
  id: number; authorId: number; workId?: number;
  content: string; images: string[];
  tags: string[]; createdAt: string; dateKey: string;
  likes: number; likedBy: number[];
  comments: CommentItem[];
  commentCount: number; shareCount: number;
  patternMatIds?: number[]; modelMatIds?: number[];
}

export interface PoolEntry {
  id: number; postId: number; workId?: number; creatorId: number;
  qualifiedAt: string; dateKey: string;
  reason: string;              // '点赞超过当日P60' | '评论数≥10' | '同时满足'
  likeP60: number; likeAtQualify: number; commentAtQualify: number;
  notifiedAt?: string;
}

export interface FabricPart { part: string; fabric: string; note?: string; }

export interface SizeChartRow { size: string; bust?: number; waist?: number; hip?: number; shoulder?: number; sleeve?: number; length?: number; }

export interface WindowSpec { label: string; sizeChart: SizeChartRow[]; note?: string; }

export type WindowStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export interface WindowMaterial {
  id: number; creatorId: number; workId: number; postId?: number;
  status: WindowStatus;
  photos: string[];
  partsFabric: FabricPart[];
  spec: WindowSpec;
  productName: string; category: string; styleTags: string[];
  price: number; baseFee: number;
  patternMatIds: number[]; modelMatIds: number[];
  auditLog?: { passed: boolean; note: string; at: string }[];
  auditMissing?: string[];
  createdAt: string; updatedAt: string;
  /** 生产周期（天） */
  prodDays?: number;
}

export interface AiDetail {
  intro: string; story: string;
  sections: { icon?: string; title: string; body: string }[];
  sizeChart: SizeChartRow[];
  partsFabric: string[];
  manufacturer: string; prodDays: number;
  baseFeeNote: string;
}

export interface DetailEdits { intro?: string; story?: string; sections?: { title: string; body: string }[]; manufacturer?: string; }

export interface Product {
  id: number; creatorId: number; workId: number; windowId: number;
  title: string; category: string; styleTags: string[];
  price: number; baseFee: number;
  cover: string; images: string[];
  patternMatIds: number[]; modelMatIds: number[];
  aiDetail: AiDetail;
  detailEdits?: DetailEdits;
  views: number; sales: number;
  status: 'draft' | 'onSale' | 'offShelf';
  createdAt: string;
  // 内部
  likedBy?: number[];
  prodDays?: number;
}

export interface SpecLine { part: string; label?: string; body: number; ease: number; base: number; target: number; flag: 'ok' | 'tight' | 'loose'; advise: string; }

export type OrderKind = 'direct' | 'custom';
export type OrderStatus = 'created' | 'paid' | 'producing' | 'qc' | 'shipping' | 'received' | 'completed' | 'cancelled';

export interface OrderTimelineItem { t: string; text: string; }

export interface OrderStage { name: string; percent: number; eta: string; doneAt?: string; }

export interface QcReport { pass: boolean; items: { k: string; v: string }[]; at: string; }

export interface LogisticsInfo { company: string; trackingNo: string; traces: { time: string; text: string }[]; }

export interface ReturnReq {
  state: 'none' | 'returning' | 'done' | 'exchanged';
  refundAmount: number; baseFeeKept: number; reason: string; at: string;
  resaleListingId?: number; newOrderId?: number;
}

export interface Order {
  id: number; no: string;
  productId: number; productTitle: string; cover: string; creatorId: number;
  kind: OrderKind;
  buyerId: number;
  specUsed: { size?: string; adjusted?: SpecLine[]; body?: BodyMeasurement };
  amounts: { price: number; baseFee: number; total: number };
  status: OrderStatus;
  timeline: OrderTimelineItem[];
  stage?: OrderStage;
  qcReport?: QcReport;
  logistics?: LogisticsInfo;
  returnReq?: ReturnReq;
  paidAt?: string; shippedAt?: string; receivedAt?: string;
  createdAt: string;
  // 内部：渠道种子 / 演示标志
  channel?: string;
  prodDays?: number;
  simulate?: boolean;
}

export type ResaleStatus = 'active' | 'sold' | 'cancelled';

export interface ResaleListing {
  id: number; orderId: number; productId: number; originalTitle: string;
  sellerId: number;
  photo: string; sizeLabel: string;
  listPrice: number;
  originalPrice?: number;        // 原价（退货挂单时录入；降价后仍展示原始划线价）
  platformFeeRate: number;
  status: ResaleStatus; soldTo?: number; soldAt?: string;
  netToSeller?: number; feeCharged?: number;
  createdAt: string;
}

export interface Notification {
  id: number; userId: number; type: string;
  title: string; body: string; link?: string; read: boolean; createdAt: string;
}

export interface CommissionRule { id: number; name: string; desc: string; active: boolean; kind: 'level' | 'penalty'; when: string; }

export interface LedgerEvent {
  id: number; userId: number; kind: string; amount: number; balance: number; refNo: string; createdAt: string;
}

export interface ViewSeed { productId: number; creatorId: number; dayKey: string; count: number; }

export interface Settings { lastPoolEval?: string; lastWindowAudit?: string; seedVersion?: number; [k: string]: unknown; }

/** 内存库整体形状（单文件持久化 data/db.json） */
export interface DB {
  seq: Record<string, number>;
  users: User[];
  materials: Material[];
  works: Work[];
  posts: Post[];
  pool: PoolEntry[];
  windows: WindowMaterial[];
  products: Product[];
  orders: Order[];
  resale: ResaleListing[];
  notifications: Notification[];
  commissionRules: CommissionRule[];
  ledger: LedgerEvent[];
  viewsByDay: ViewSeed[];
  settings: Settings;
}

/** 资源池评估结果 */
export interface PoolEvalResult {
  evaluated: number;        // 评估的今日推文数
  dateKey: string;
  p60: number; n: number;
  added: PoolEntry[];
  explain: string[];
}
