/**
 * 私人定制：规格调整（§3.4 主算法）+ AI 交互/款式变体生成图（纯 SVG data-url）。
 * 调整算法：
 *   目标成品尺寸 = 体型 + 品类松量（胸/腰/臀/肩/袖）
 *   基码 = 能满足全部目标的最小档；否则取最大档并将不足维度标 tight
 */
import type { BodyMeasurement, Product } from '../types';
import { r2, svgDataUrl } from '../utils/misc';

const LOOSE_TOL = 9;   // 成品超出目标该值(cm) → loose（容差外，提示改小或接受）
const TIGHT_TOL = 1;   // 成品小于目标超过 1cm 即 tight

export const PART_LABEL: Record<string, string> = {
  bust: '胸围', waist: '腰围', hip: '臀围', shoulder: '肩宽', sleeve: '袖长', length: '衣长',
};

/** 品类松量（SPEC §3.4，单位 cm） */
export function easeFor(category: string, key: string): number {
  const cat = category || '';
  switch (key) {
    case 'bust': return cat.includes('连衣裙') || cat.includes('套装') ? 8 : cat.includes('衬衫') || cat.includes('外套') ? 12 : 8;
    case 'waist': return cat.includes('半裙') || cat.includes('裤装') ? 4 : cat.includes('连衣裙') || cat.includes('套装') ? 6 : 8;
    case 'hip': return cat.includes('半裙') ? 6 : 8;
    case 'shoulder': return cat.includes('衬衫') || cat.includes('外套') ? 1.5 : 1;
    case 'sleeve': return 2;
    default: return 0;
  }
}

export interface AdaptResult {
  baseSize: string;
  chart: { size: string; bust?: number; waist?: number; hip?: number; shoulder?: number; sleeve?: number; length?: number }[];
  adjustedSpec: { part: string; label: string; body: number; ease: number; base: number; target: number; flag: 'ok' | 'tight' | 'loose'; advise: string }[];
  fitAlerts: string[];
  explain: string[];
  totalEstimate: { price: number; baseFee: number; total: number };
}

function bodyOf(b: BodyMeasurement, key: string): number | undefined {
  switch (key) {
    case 'bust': return b.bust;
    case 'waist': return b.waist;
    case 'hip': return b.hip;
    case 'shoulder': return b.shoulderWidth;
    case 'sleeve': return b.armLength;
    default: return undefined;
  }
}

/** 参与判定维度：表里有数据且体型有对应数据 */
function relevantKeys(category: string, chart: AdaptResult['chart']): string[] {
  const keys = ['bust', 'waist', 'hip', 'shoulder', 'sleeve'];
  return keys.filter((k) => chart.some((r) => typeof (r as Record<string, unknown>)[k] === 'number'));
}

export function adaptToProduct(product: Product, body: BodyMeasurement): AdaptResult {
  const chart: AdaptResult['chart'] = (product.aiDetail?.sizeChart || []).slice();
  const keys = relevantKeys(product.category || '', chart);
  const rows = keys
    .map((k) => ({ key: k, body: bodyOf(body, k), ease: easeFor(product.category || '', k) }))
    .filter((r): r is { key: string; body: number; ease: number } => typeof r.body === 'number' && r.body > 0);
  const explain: string[] = [];
  const targetOf = (r: { key: string; body: number; ease: number }) => r2(r.body + r.ease);
  const needs = rows.map((r) => ({ key: r.key, target: targetOf(r) }));

  // 选基码：能满足全部目标的最小档
  let baseSize = chart.length ? chart[chart.length - 1].size : '';
  let anyFit = false;
  for (const row of chart) {
    const okAll = needs.every((n) => {
      const v = (row as Record<string, unknown>)[n.key];
      return typeof v === 'number' ? (v as number) >= n.target - TIGHT_TOL : true;
    });
    if (okAll) { baseSize = row.size; anyFit = true; break; }
  }
  if (!anyFit && chart.length) baseSize = chart[chart.length - 1].size;
  const baseRow = chart.find((r) => r.size === baseSize);

  const adjustedSpec = rows.map((r) => {
    const row = baseRow as Record<string, unknown>;
    const v = row ? (row[r.key] as number | undefined) : undefined;
    const target = targetOf(r);
    const label = PART_LABEL[r.key] || r.key;
    let flag: 'ok' | 'tight' | 'loose' = 'ok';
    let advise = '';
    if (v === undefined) {
      advise = '该规格表未提供此维度数据，请与创作者确认';
    } else if (v < target - TIGHT_TOL) {
      flag = 'tight';
      advise = `${label}成品仅 ${v}cm，容纳不下所需 ${target}cm（体型 ${r.body} + 松量 ${r.ease}）→ 建议改大一码或在 AI 定制中加放该部位`;
    } else if (v > target + LOOSE_TOL) {
      flag = 'loose';
      advise = `${label}成品 ${v}cm 比所需 ${target}cm 大 ${r2(v - target)}cm（超出舒适容差）→ 可接受宽松或选更小码`;
    } else {
      advise = `${label}成品 ${v}cm 覆盖所需 ${target}cm，穿着舒适。`;
    }
    return { part: r.key, label, body: r.body, ease: r.ease, base: v === undefined ? target : v, target, flag, advise };
  });

  const fitAlerts: string[] = [];
  const tightRows = adjustedSpec.filter((s) => s.flag === 'tight');
  const looseRows = adjustedSpec.filter((s) => s.flag === 'loose');
  if (tightRows.length) {
    fitAlerts.push(`⚠️ 系统提示：该规格可能不合适——${tightRows.map((s) => `${s.label}（成品 ${s.base}cm < 需要 ${s.target}cm）`).join('、')}。建议改大一码或在定制中调整该部位。`);
  }
  if (!anyFit && chart.length) {
    const worst = needs.map((n) => `${PART_LABEL[n.key]}需 ${n.target}cm`).join('、');
    fitAlerts.push(`⚠️ 您的体型超出「${chart[chart.length - 1].size}」码范围（${worst}），建议私人定制加放或联系创作者沟通。`);
  }
  if (!tightRows.length && looseRows.length) {
    fitAlerts.push(`📏 提示：${looseRows.map((s) => `${s.label}偏大 ${r2(s.base - s.target)}cm`).join('、')}，可选更小码或接受宽松效果。`);
  }

  explain.push(
    `品类「${product.category}」松量参考：${keys.map((k) => `${PART_LABEL[k]} +${easeFor(product.category || '', k)}`).join('、')}。`,
    rows.map((r) => `${PART_LABEL[r.key]}目标 = 体型 ${r.body} + 松量 ${r.ease} = ${targetOf(r)}cm`).join('；'),
    `基码策略：优先取能覆盖全部目标成品尺寸的最小档；无档可覆盖时取最大档并把不足维度标为 tight。当前推荐基码「${baseSize}」。`,
  );

  const price = product.price || 0;
  const baseFee = product.baseFee || 0;
  return {
    baseSize,
    chart,
    adjustedSpec,
    fitAlerts,
    explain,
    totalEstimate: { price, baseFee, total: r2(price + baseFee) },
  };
}

/* ============================ AI 交互（规则模板） ============================ */

export interface ChatOption { key: string; title: string; desc: string; }

export interface ChatResult { reply: string; options: ChatOption[]; }

const INSTRUCTION = `你是织梦「AI 量体裁衣助手」。用户在与创作者合作对商品做私人定制：可改部件（领口/袖型/裙长/腰线）、设计元素、面料等。你给出可落地建议并用简短中文回复。`;

function matchAny(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w));
}

export function customChat(product: Product, history: { role: string; content: string }[]): ChatResult {
  const last = [...history].reverse().find((h) => h.role === 'user')?.content || '';
  const title = product.title;
  const has = (w: string[]) => matchAny(last, w);
  const options: ChatOption[] = [];

  if (has(['袖', '泡泡袖', '喇叭袖', '袖型', '袖子'])) {
    options.push(
      { key: 'sleeve-puff', title: '改泡泡袖', desc: '袖山抽褶，甜美复古，适合肩部较窄' },
      { key: 'sleeve-straight', title: '改直筒袖', desc: '利落通勤，简洁不挑场合' },
      { key: 'sleeve-lantern', title: '改灯笼袖', desc: '上窄下宽，藏肉显仙气' },
    );
    return {
      reply: `关于「${title}」的袖型：我可以帮你调整为更适合体型的袖型。若肩偏窄选泡泡袖/灯笼袖增加轮廓；若要利落干练选直筒袖。选择下方方案我会立即生成预览图。`,
      options,
    };
  }
  if (has(['领', '领口', '方领', 'V领', '圆领', '一字肩', '高领'])) {
    options.push(
      { key: 'neck-square', title: '方领', desc: '显锁骨，复古法式感' },
      { key: 'neck-v', title: 'V 领', desc: '拉长颈线，适合圆脸/短脖' },
      { key: 'neck-round', title: '圆领', desc: '日常百搭，不挑人' },
      { key: 'neck-high', title: '半高领', desc: '秋冬保暖，优雅知性' },
    );
    return { reply: `领口是影响上身比例的关键。${product.styleTags?.includes('法式') ? '这件法式风格可优先考虑方领' : '根据脸型与颈长选择'}：V 领最显修长，方领复古，圆领最稳妥。选择后可生成图预览。`, options };
  }
  if (has(['长', '裙长', '衣长', '短一点', '长一点', '膝'])) {
    options.push(
      { key: 'len-mini', title: '及膝偏短', desc: '活泼俏皮，显腿长' },
      { key: 'len-midi', title: '中长(及小腿肚)', desc: '优雅通勤，遮小腿' },
      { key: 'len-maxi', title: '长款(及踝)', desc: '飘逸度假，显高挑' },
    );
    return { reply: '衣长调整会同步影响版片裁切与排料。参考身高与比例：155-160cm 选及膝，160-168 中长更修饰，168+ 可大胆长款。', options };
  }
  if (has(['腰', '收腰', '腰线', '高腰', 'A字', '版型'])) {
    options.push(
      { key: 'waist-fit', title: '修身收腰', desc: '勾勒曲线，正装/约会' },
      { key: 'waist-empire', title: '高腰线', desc: '拉长腿部比例，显高' },
      { key: 'waist-relax', title: '宽松直筒', desc: '舒适日常，遮小腹' },
    );
    return { reply: '腰线设计决定整体廓形。收腰显身材、高腰显腿长、直筒最舒适。结合你的腰臀差可给出最合适版型。', options };
  }
  if (has(['面', '料', '材质', '真丝', '棉', '羊毛', '缎', '透气', '厚'])) {
    options.push(
      { key: 'fab-silk', title: '真丝/桑蚕丝', desc: '光泽垂坠，贵气（+¥120）' },
      { key: 'fab-cotton', title: '高支棉', desc: '亲肤透气易打理（+¥0）' },
      { key: 'fab-linen', title: '亚麻', desc: '松弛度假感，吸湿快干（+¥0）' },
      { key: 'fab-wool', title: '羊毛混纺', desc: '挺括保暖，适合秋冬（+¥90）' },
    );
    return { reply: '面料可替换，影响质感/克重/护理方式；替换面料将触发「材料变更 → 重新走橱窗审核」，已按默认加价给出方案。', options };
  }
  if (has(['碎花', '印花', '波点', '图案', '颜色', '配色'])) {
    options.push(
      { key: 'print-floral', title: '碎花印花', desc: '浪漫复古（花位可指定）' },
      { key: 'print-dot', title: '波点', desc: '经典俏皮' },
      { key: 'color-solid', title: '净色(米白/雾蓝/黑)', desc: '极简高级，好搭配' },
    );
    return { reply: `印花/配色素材可从「素材库 SVG/图片」带入；若替换设计元素同样需要重新审核材料。你可以从下方选择或描述想要的花型。`, options };
  }
  // 兜底：把可改维度都列出来引导
  options.push(
    { key: 'sleeve-puff', title: '改袖型（泡泡袖等）', desc: '甜美/复古/干练风格随你' },
    { key: 'neck-v', title: '改领口', desc: 'V领/方领/圆领可选' },
    { key: 'len-midi', title: '改裙长/衣长', desc: '调整廓形比例' },
    { key: 'fab-silk', title: '换面料', desc: '材料变更需重新审核' },
  );
  return {
    reply: `我是织梦 AI 量体裁衣助手 ✂️。当前商品「${title}」（￥${product.price}，定制基础费 ￥${product.baseFee}）。你可以直接说想改哪里，例如「袖子改成泡泡袖」「换成V领」「面料想透气些」；也可以从下方入口开始。定制确认后先付全款，退货仅退原价、基础费用不退（详见条款）。`,
    options,
  };
}

export interface VariantResult { image: string; title: string; desc: string; applied: string[]; }

const STYLE_HEX: Record<string, string> = {
  '法式': '#D44771', '碎花': '#E88DA6', '韩系': '#8A9BC0', '复古': '#B9816B', '极简': '#4A4A52', '甜美': '#F2B8C0', '通勤': '#7C8AA0', '东方': '#7C8A6F',
};

/** 生成款式草图（SVG data-url），叠加标注被应用的设计选项 */
export function genVariantSvg(product: Product, optionKey: string): VariantResult {
  const main = STYLE_HEX[(product.styleTags || []).find((t) => STYLE_HEX[t]) || ''] || '#D44771';
  const accent = '#E85C87';
  // 简易裙装轮廓
  const silhouette =
    `<path d="M130 40 C 60 44 58 96 96 108 C 80 128 84 158 118 166 L 66 220 C 40 246 46 270 88 262 L 176 262 C 218 270 224 246 198 220 L 146 166 C 180 158 184 128 168 108 C 206 96 204 44 134 40 Z" fill="${main}" opacity="0.16" stroke="${main}" stroke-width="2"/>`;
  const labels: { x: number; y: number; t: string }[] = [{ x: 152, y: 28, t: '正面款式草图' }];
  const applied: string[] = [];
  if (optionKey.startsWith('sleeve')) {
    labels.push({ x: 106, y: 120, t: '▲ 袖型调整' }, { x: 158, y: 120, t: '▲ 袖型调整' });
    applied.push(`袖型 → ${optionKey.replace('sleeve-', '') === 'puff' ? '泡泡袖' : optionKey.replace('sleeve-', '') === 'lantern' ? '灯笼袖' : '直筒袖'}`);
  }
  if (optionKey.startsWith('neck')) {
    labels.push({ x: 152, y: 84, t: '领口调整 →' });
    applied.push(`领口 → ${optionKey.replace('neck-', '') === 'v' ? 'V领' : optionKey.replace('neck-', '') === 'square' ? '方领' : optionKey.replace('neck-', '') === 'high' ? '半高领' : '圆领'}`);
  }
  if (optionKey.startsWith('len')) {
    labels.push({ x: 152, y: 288, t: '↓ 长度示意' });
    applied.push(`长度 → ${optionKey.replace('len-', '') === 'mini' ? '及膝偏短' : optionKey.replace('len-', '') === 'maxi' ? '长款及踝' : '中长及小腿'}`);
  }
  if (optionKey.startsWith('waist')) {
    labels.push({ x: 152, y: 168, t: '✂ 腰线' });
    applied.push(`腰线 → ${optionKey.replace('waist-', '') === 'fit' ? '修身收腰' : optionKey.replace('waist-', '') === 'empire' ? '高腰' : '宽松直筒'}`);
  }
  if (optionKey.startsWith('fab')) {
    labels.push({ x: 152, y: 220, t: '面料采样' });
    applied.push(`面料 → ${optionKey.replace('fab-', '') === 'silk' ? '真丝' : optionKey.replace('fab-', '') === 'cotton' ? '高支棉' : optionKey.replace('fab-', '') === 'linen' ? '亚麻' : '羊毛混纺'}`);
  }
  if (optionKey.startsWith('print') || optionKey.startsWith('color')) {
    labels.push({ x: 152, y: 190, t: '印花/配色' });
    applied.push(optionKey.startsWith('print') ? '图案 → 花型' : '配色 → 净色');
  }
  if (!applied.length) applied.push('样式微调');
  const textEls = labels.map((l) => `<text x="${l.x}" y="${l.y}" text-anchor="middle" font-size="11" fill="#565B63">${l.t}</text>`).join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">` +
    `<rect width="300" height="300" fill="#FFF9F7"/>` +
    silhouette + textEls +
    `<rect x="20" y="272" width="10" height="10" fill="${accent}"/><text x="36" y="281" font-size="10" fill="#8A8F98">织梦 AI 款式预览 · ${product.title}</text>` +
    `</svg>`;
  return {
    image: svgDataUrl(svg),
    title: applied.join(' · '),
    desc: `${applied.join('、')}已生成参变化预览（非最终成衣图）。确认后将在定制订单中应用，材料类变更（面料/印花/换版）将同步触发橱窗重新审核。`,
    applied,
  };
}

export const customInstructions = INSTRUCTION;
