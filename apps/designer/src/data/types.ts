/* ============ 织梦 · 数据类型定义 ============ */

export interface User {
  id: number;
  nickname: string;
  avatar: string;
  /** 设计能力认证 0-无 1-学徒 2-设计师 3-资深 */
  level: number;
  bio: string;
  followers: number;
  following: number;
  role: 'consumer' | 'creator' | 'brand';
  brandName?: string;
  works: number;
}

export interface Work {
  id: number;
  title: string;
  creatorId: number;
  brandId?: number;
  category: string; // 连衣裙/衬衫/半裙/外套/裤装/套装/配饰
  styleTags: string[];
  fabric: string;
  price: number;
  cover: string;
  colors: { name: string; hex: string }[];
  sizes: string[];
  sales: number;
  likes: number;
  collects: number;
  views: number;
  desc: string;
  /** 3D模型URL占位 */
  model3d?: string;
  isCustom: boolean;
  returnRate: number;
  /** 生产周期（天） */
  productionDays: number;
}

export interface Post {
  id: number;
  authorId: number;
  content: string;
  images: string[];
  mediaType: 'image' | 'video';
  linkedWorkIds: number[];
  tags: string[];
  likeCount: number;
  collectCount: number;
  commentCount: number;
  shareCount: number;
  /** 相对时间描述 */
  time: string;
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  likes: number;
  time: string;
  replyTo?: string;
}

export interface RankingItem {
  workId: number;
  periodType: 1 | 2 | 3; // 1-周榜 2-月榜 3-总榜
  rank: number;
  voteScore: number;
  collectScore: number;
  salesScore: number;
  interactionScore: number;
  totalScore: number;
  votes: number;
}

export interface CourseOutline {
  title: string;
  duration: number; // 秒
  done?: boolean;
}

export interface Course {
  id: number;
  title: string;
  instructorId: number;
  category: string; // 设计基础/面料知识/打版技巧/软件操作/趋势分析/品牌运营
  level: 1 | 2 | 3; // 1-入门 2-进阶 3-高级
  duration: number; // 总时长（秒）
  learners: number;
  cover: string;
  desc: string;
  outline: CourseOutline[];
  isUserUploaded: boolean;
  playCount: number;
  certified?: boolean;
}

export interface CartItem {
  workId: number;
  qty: number;
  color: string;
  size: string;
  checked?: boolean;
}

export type OrderStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const ORDER_STATUS_TEXT: Record<OrderStatus, string> = {
  0: '待支付', 1: '待生产', 2: '生产中', 3: '质检中', 4: '待发货', 5: '已发货', 6: '已收货', 7: '已完成',
};

export interface OrderItem {
  workId: number;
  title: string;
  cover: string;
  color: string;
  size: string;
  qty: number;
  price: number;
}

export interface Order {
  id: number;
  orderNo: string;
  status: OrderStatus;
  amount: number;
  createdAt: string;
  items: OrderItem[];
  address: { name: string; phone: string; region: string; detail: string };
  progress?: {
    stage: string;      // 当前环节
    percent: number;    // 0-100
    eta: string;        // 预计完成时间
  };
  qc?: {
    fabric: string;
    craft: string;
    sizeDeviation: string;
    images: string[];
    pass: boolean;
  };
  logistics?: {
    company: string;
    trackingNo: string;
    traces: { time: string; text: string }[];
  };
  isCustom: boolean;
}

export interface BodyMeasurement {
  height: number; weight: number; bust: number; underBust: number;
  waist: number; hip: number; shoulderWidth: number; armLength: number;
  thigh: number; calf: number; neck: number; backLength: number;
  source: 'manual' | 'ai';
  updatedAt: string;
}

export interface KpiWork {
  id: number;
  title: string;
  cover: string;
  conversionRate: number; // %
  clickRate: number;      // %
  rank: number;
  dailyOrders: number;
  monthlyOrders: number;
  returnRate: number;     // %
  todayAmount: number;
}

export interface DashboardData {
  todayAmount: number;
  todayVisitors: number;
  conversionRate: number;
  rank: number;
  monthlyOrders: number;
  totalOrders: number;
  works: KpiWork[];
  trend7d: { date: string; orders: number; amount: number }[];
  trend30d: { date: string; orders: number }[];
  returnTrend: { date: string; rate: number }[];
  channelShare: { name: string; value: number; color: string }[];
  commission: { withdrawable: number; pending: number; total: number };
  withdrawHistory: { time: string; amount: number; status: string }[];
}
