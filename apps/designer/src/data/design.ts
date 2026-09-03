/* ============ 服装设计App · 参数化设计数据模型 ============ */

export type CategoryKey = 'dress' | 'shirt' | 'skirt' | 'coat' | 'pants' | 'suit';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  dress: '连衣裙', shirt: '衬衫', skirt: '半裙', coat: '外套', pants: '裤装', suit: '套装',
};

/** 18 类可调款式元素 */
export type GroupKey =
  | 'collar' | 'sleeve' | 'fit' | 'length' | 'waist' | 'placket' | 'pockets'
  | 'hem' | 'shoulder' | 'dart' | 'pleat' | 'slit' | 'ornament' | 'lining'
  | 'stitch' | 'buttons' | 'zipper' | 'printPos';

export const GROUP_LABELS: Record<GroupKey, string> = {
  collar: '领型', sleeve: '袖型', fit: '版型', length: '衣长/裙长', waist: '腰型',
  placket: '门襟', pockets: '口袋', hem: '下摆', shoulder: '肩线', dart: '省道',
  pleat: '褶皱', slit: '开衩', ornament: '装饰', lining: '里衬', stitch: '缝线',
  buttons: '扣子', zipper: '拉链', printPos: '印花位置',
};

export interface OptionDef { v: string; label: string; }

export const OPTIONS: Record<GroupKey, OptionDef[]> = {
  collar: [
    { v: 'round', label: '圆领' }, { v: 'vneck', label: 'V领' }, { v: 'square', label: '方领' },
    { v: 'boat', label: '一字领' }, { v: 'stand', label: '立领' }, { v: 'shirt', label: '衬衫领' },
  ],
  sleeve: [
    { v: 'none', label: '无袖' }, { v: 'short', label: '短袖' }, { v: 'long', label: '长袖' },
    { v: 'puff', label: '泡泡袖' }, { v: 'lantern', label: '灯笼袖' }, { v: 'bell', label: '喇叭袖' },
  ],
  fit: [
    { v: 'slim', label: '紧身' }, { v: 'fit', label: '合体' }, { v: 'loose', label: '宽松' },
    { v: 'a', label: 'A字' }, { v: 'h', label: 'H型' },
  ],
  length: [
    { v: 'mini', label: '超短' }, { v: 'knee', label: '及膝' }, { v: 'midi', label: '中长' },
    { v: 'ankle', label: '及踝' }, { v: 'floor', label: '曳地' },
  ],
  waist: [
    { v: 'high', label: '高腰' }, { v: 'mid', label: '中腰' }, { v: 'low', label: '低腰' },
    { v: 'elastic', label: '松紧腰' },
  ],
  placket: [
    { v: 'none', label: '无' }, { v: 'single', label: '单排扣' }, { v: 'double', label: '双排扣' },
    { v: 'hidden', label: '暗门襟' }, { v: 'tie', label: '系带' },
  ],
  pockets: [
    { v: 'none', label: '无口袋' }, { v: 'patch', label: '贴袋' }, { v: 'slash', label: '插袋' },
    { v: 'welt', label: '挖袋' },
  ],
  hem: [
    { v: 'flat', label: '平摆' }, { v: 'round', label: '圆摆' }, { v: 'slithem', label: '开衩摆' },
    { v: 'ruffle', label: '荷叶边' }, { v: 'asym', label: '不规则摆' },
  ],
  shoulder: [
    { v: 'normal', label: '正常肩' }, { v: 'dropped', label: '落肩' },
  ],
  dart: [
    { v: 'none', label: '无省' }, { v: 'bust', label: '胸省' }, { v: 'waistdart', label: '腰省' },
    { v: 'shoulder', label: '肩省' },
  ],
  pleat: [
    { v: 'none', label: '无褶' }, { v: 'natural', label: '自然褶' }, { v: 'pressed', label: '压褶' },
    { v: 'shirred', label: '抽褶' },
  ],
  slit: [
    { v: 'none', label: '不开衩' }, { v: 'front', label: '前开衩' }, { v: 'back', label: '后开衩' },
    { v: 'side', label: '侧开衩' },
  ],
  ornament: [
    { v: 'none', label: '无装饰' }, { v: 'embroidery', label: '刺绣花卉' }, { v: 'bow', label: '蝴蝶结' },
    { v: 'lace', label: '蕾丝花边' }, { v: 'pearls', label: '珍珠点缀' },
  ],
  lining: [
    { v: 'none', label: '无里衬' }, { v: 'full', label: '全里衬' }, { v: 'half', label: '半里衬' },
  ],
  stitch: [
    { v: 'hidden', label: '暗缝' }, { v: 'visible', label: '明线' }, { v: 'contrast', label: '撞色线' },
  ],
  buttons: [
    { v: 'none', label: '无扣' }, { v: 'resin', label: '树脂扣' }, { v: 'metal', label: '金属扣' },
    { v: 'fabric', label: '包布扣' },
  ],
  zipper: [
    { v: 'none', label: '无拉链' }, { v: 'hidden', label: '隐形拉链' }, { v: 'metal', label: '金属拉链' },
  ],
  printPos: [
    { v: 'full', label: '满印' }, { v: 'center', label: '居中' }, { v: 'bottom', label: '下摆' },
    { v: 'chest', label: '局部·胸口' },
  ],
};

/** 各品类可调节的元素组（切换品类时参数面板自动适配） */
export const APPLICABLE: Record<CategoryKey, GroupKey[]> = {
  dress: ['collar', 'sleeve', 'fit', 'length', 'waist', 'placket', 'pockets', 'hem', 'shoulder', 'dart', 'pleat', 'slit', 'ornament', 'lining', 'stitch', 'buttons', 'zipper', 'printPos'],
  shirt: ['collar', 'sleeve', 'fit', 'length', 'placket', 'pockets', 'hem', 'shoulder', 'dart', 'lining', 'stitch', 'buttons', 'printPos'],
  skirt: ['fit', 'length', 'waist', 'pockets', 'hem', 'pleat', 'slit', 'lining', 'stitch', 'zipper', 'printPos'],
  coat: ['collar', 'sleeve', 'fit', 'length', 'waist', 'placket', 'pockets', 'hem', 'shoulder', 'lining', 'stitch', 'buttons', 'zipper'],
  pants: ['fit', 'length', 'waist', 'pockets', 'hem', 'pleat', 'lining', 'stitch', 'zipper'],
  suit: ['collar', 'sleeve', 'fit', 'length', 'placket', 'pockets', 'hem', 'shoulder', 'dart', 'lining', 'stitch', 'buttons', 'zipper', 'printPos'],
};

/* ---------- 面料库（含物理参数） ---------- */
export interface FabricDef {
  id: string; name: string; weight: string; // 克重
  drape: number; // 垂坠感 0-1
  gloss: number; // 光泽 0-1
  stretch: number; // 弹性 0-1
  desc: string;
}
export const FABRICS: FabricDef[] = [
  { id: 'silk', name: '重磅真丝', weight: '21姆米', drape: .92, gloss: .85, stretch: .08, desc: '垂坠飘逸 · 微光泽' },
  { id: 'satin', name: '醋酸缎面', weight: '150g', drape: .72, gloss: .92, stretch: .15, desc: '缎面光泽 · 抗皱' },
  { id: 'linen', name: '亚麻', weight: '180g', drape: .42, gloss: .1, stretch: .05, desc: '天然褶皱 · 透气' },
  { id: 'cotton', name: '精梳棉', weight: '160g', drape: .3, gloss: .08, stretch: .12, desc: '挺括亲肤' },
  { id: 'chiffon', name: '雪纺', weight: '75g', drape: .9, gloss: .3, stretch: .2, desc: '轻薄飘逸' },
  { id: 'wool', name: '精纺羊毛', weight: '260g', drape: .5, gloss: .28, stretch: .1, desc: '挺括有型' },
  { id: 'cashmere', name: '羊绒', weight: '220g', drape: .62, gloss: .18, stretch: .3, desc: '柔软亲肤' },
  { id: 'knit', name: '针织毛线', weight: '300g', drape: .55, gloss: .12, stretch: .65, desc: '弹性舒适' },
  { id: 'denim', name: '牛仔', weight: '420g', drape: .15, gloss: .06, stretch: .2, desc: '硬朗复古' },
  { id: 'velvet', name: '天鹅绒', weight: '320g', drape: .55, gloss: .6, stretch: .18, desc: '丝绒光泽' },
  { id: 'tulle', name: '网纱', weight: '60g', drape: .85, gloss: .35, stretch: .05, desc: '轻盈梦幻' },
  { id: 'lace', name: '蕾丝', weight: '90g', drape: .7, gloss: .2, stretch: .12, desc: '精致镂空' },
  { id: 'suede', name: '麂皮绒', weight: '280g', drape: .3, gloss: .06, stretch: .1, desc: '哑光细腻' },
  { id: 'jersey', name: '莫代尔', weight: '150g', drape: .55, gloss: .05, stretch: .8, desc: '贴体弹力' },
  { id: 'oxford', name: '牛津纺', weight: '200g', drape: .22, gloss: .12, stretch: .1, desc: '挺括耐磨' },
  { id: 'tech', name: '科技面料', weight: '180g', drape: .3, gloss: .5, stretch: .45, desc: '速干弹力' },
];
export const fabricById = (id: string) => FABRICS.find((f) => f.id === id) || FABRICS[0];

/* ---------- 图案 ---------- */
export const PATTERNS = [
  { v: 'none', label: '纯色' }, { v: 'floral', label: '碎花' }, { v: 'stripe', label: '条纹' },
  { v: 'plaid', label: '格纹' }, { v: 'polka', label: '波点' }, { v: 'geo', label: '几何' },
  { v: 'dots2', label: '爱心' },
];

/* ---------- 配色板 ---------- */
export const COLOR_SWATCHES = [
  '#F5EFE6', '#EFD9CF', '#E8A0B0', '#C2544E', '#E0A458', '#C9A23F', '#9FB4C7',
  '#7C8A6F', '#5A6650', '#4A5B72', '#2A3B5C', '#7E2E3A', '#2B2B30', '#8C8C92',
];

/* ---------- 默认参数（按品类） ---------- */
export interface DesignParams {
  category: CategoryKey;
  collar: string; sleeve: string; fit: string; lengthCm: number;
  waist: string; placket: string; pockets: string; hem: string;
  shoulder: string; dart: string; pleat: string; slit: string;
  ornament: string; lining: string; stitch: string; buttons: string; zipper: string;
  printPos: string;
  fabric: string; color: string; pattern: string; accent: string;
  drape: number; gloss: number; stretch: number;
}

export const LENGTH_RANGE: Record<CategoryKey, { min: number; max: number; def: number }> = {
  dress: { min: 60, max: 135, def: 92 },
  shirt: { min: 45, max: 85, def: 62 },
  skirt: { min: 30, max: 95, def: 58 },
  coat: { min: 70, max: 125, def: 100 },
  pants: { min: 40, max: 110, def: 100 },
  suit: { min: 50, max: 80, def: 64 },
};

export const LENGTH_LABEL = (c: CategoryKey, cm: number): string => {
  const r = LENGTH_RANGE[c];
  const t = (r.max - r.min) / 4;
  if (cm <= r.min + t) return '超短';
  if (cm <= r.min + t * 2) return '及膝/短款';
  if (cm <= r.min + t * 3) return '中长';
  return '及踝/长款';
};

function defParams(category: CategoryKey, fabric = 'cotton', color = '#F5EFE6'): DesignParams {
  return {
    category, collar: 'round', sleeve: category === 'coat' ? 'long' : 'short', fit: 'fit',
    lengthCm: LENGTH_RANGE[category].def, waist: 'mid', placket: 'none', pockets: 'none',
    hem: 'flat', shoulder: 'normal', dart: 'none', pleat: 'none', slit: 'none',
    ornament: 'none', lining: 'none', stitch: 'hidden', buttons: 'none', zipper: 'none',
    printPos: 'full', fabric, color, pattern: 'none', accent: '#C2544E',
    drape: 0.5, gloss: 0.3, stretch: 0.2,
  };
}

export const DEFAULT_PARAMS: Record<CategoryKey, DesignParams> = {
  dress: defParams('dress', 'silk', '#E8A0B0'),
  shirt: defParams('shirt', 'cotton', '#F5EFE6'),
  skirt: defParams('skirt', 'cotton', '#9FB4C7'),
  coat: defParams('coat', 'wool', '#C9A23F'),
  pants: defParams('pants', 'denim', '#5A6650'),
  suit: defParams('suit', 'wool', '#4A5B72'),
};

/* ---------- 品类默认文案 ---------- */
export const CATEGORY_DESC: Record<CategoryKey, string> = {
  dress: '连衣裙 · 一体成型', shirt: '衬衫 · 上装', skirt: '半裙 · 下装',
  coat: '外套 · 长款', pants: '裤装 · 下装', suit: '套装 · 上装+裙',
};

/* ---------- AI 候选方案（文生图5款） ---------- */
export interface AiCandidate {
  id: number; title: string; tagline: string; preview: string; pattern: string;
  fabric: string; color: string; accent: string; category: CategoryKey;
  sleeve: string; collar: string; fit: string; lengthCm: number; printPos: string;
}
export const AI_CANDIDATES: AiCandidate[] = [
  { id: 1, title: '法式碎花泡泡袖连衣裙', tagline: '约会 · 温柔 · 收腰', preview: '/images/dress-01.jpg', pattern: 'floral', fabric: 'silk', color: '#F5EFE6', accent: '#C2544E', category: 'dress', sleeve: 'puff', collar: 'square', fit: 'a', lengthCm: 96, printPos: 'full' },
  { id: 2, title: '晨光缎面吊带裙', tagline: '晚宴 · 光泽 · 优雅', preview: '/images/dress-18.jpg', pattern: 'none', fabric: 'satin', color: '#E8A0B0', accent: '#7E2E3A', category: 'dress', sleeve: 'none', collar: 'boat', fit: 'slim', lengthCm: 110, printPos: 'none' },
  { id: 3, title: '格纹学院风衬衫', tagline: '校园 · 复古 · 减龄', preview: '/images/blouse-02.jpg', pattern: 'plaid', fabric: 'oxford', color: '#9FB4C7', accent: '#2A3B5C', category: 'shirt', sleeve: 'long', collar: 'shirt', fit: 'fit', lengthCm: 62, printPos: 'full' },
  { id: 4, title: '波点茶歇裙', tagline: '假日 · 俏皮 · A字', preview: '/images/dress-03.jpg', pattern: 'polka', fabric: 'cotton', color: '#F6F4F0', accent: '#2B2B30', category: 'dress', sleeve: 'short', collar: 'round', fit: 'a', lengthCm: 88, printPos: 'full' },
  { id: 5, title: '极简羊毛大衣', tagline: '通勤 · 挺括 · 高级', preview: '/images/coat-02.jpg', pattern: 'none', fabric: 'wool', color: '#D8CFC2', accent: '#4A4A52', category: 'coat', sleeve: 'long', collar: 'stand', fit: 'h', lengthCm: 105, printPos: 'none' },
];

/* ---------- 颜色工具 ---------- */
export function shade(hex: string, pct: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * (1 + pct))));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * (1 + pct))));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * (1 + pct))));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/* ---------- AI 候选应用（文生图 → 一键载入工作台） ---------- */
export function applyCandidate(c: AiCandidate): Partial<DesignParams> {
  const d = DEFAULT_PARAMS[c.category];
  return {
    category: c.category,
    collar: c.collar || d.collar,
    sleeve: c.sleeve || d.sleeve,
    fit: c.fit || d.fit,
    lengthCm: c.lengthCm || d.lengthCm,
    pattern: c.pattern,
    printPos: c.printPos === 'none' ? d.printPos : c.printPos,
    fabric: c.fabric,
    color: c.color,
    accent: c.accent,
    drape: (fabricById(c.fabric)?.drape ?? d.drape),
    gloss: (fabricById(c.fabric)?.gloss ?? d.gloss),
    stretch: (fabricById(c.fabric)?.stretch ?? d.stretch),
  };
}
