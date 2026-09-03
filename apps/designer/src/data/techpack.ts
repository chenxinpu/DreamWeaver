import type { DesignParams } from './design';
import { CATEGORY_LABELS, FABRICS, OPTIONS, GROUP_LABELS, LENGTH_LABEL } from './design';
import type { BodyMeasurement } from './types';

/* ============ 工艺单（Tech Pack）生成 ============ */

export interface BomItem { name: string; spec: string; qty?: string }
export interface TechPack {
  title: string;
  categoryLabel: string;
  styleSummary: string;
  bom: BomItem[];
  process: string[];
  sizes: { label: string; bust: number; waist: number; hip: number; remark: string }[];
  spec: { label: string; value: string }[];
  note: string;
}

const optLabel = (g: keyof DesignParams, v: string, fallback = '') => {
  const list = (OPTIONS as Record<string, { v: string; label: string }[]>)[g];
  if (!list) return fallback;
  return list.find((o) => o.v === v)?.label || fallback;
};

export function buildTechpack(title: string, params: DesignParams, body?: BodyMeasurement | null): TechPack {
  const fabric = FABRICS.find((f) => f.id === params.fabric) || FABRICS[0];
  const bom: BomItem[] = [
    { name: '主面料', spec: `${fabric.name}（${fabric.weight}）`, qty: params.category === 'coat' ? '2.6m' : params.category === 'dress' ? '2.2m' : params.category === 'pants' ? '1.6m' : '1.4m' },
    { name: '主色', spec: `${params.color.toUpperCase()}` },
  ];
  if (params.pattern !== 'none') bom.push({ name: '印花', spec: `${optLabel('printPos', params.printPos, '满印')} · 图案编号 P-${params.pattern.toUpperCase()}` });
  if (params.lining !== 'none') bom.push({ name: '里衬', spec: optLabel('lining', params.lining) + ' · 平纹里布' });
  if (params.buttons !== 'none') bom.push({ name: '纽扣', spec: optLabel('buttons', params.buttons), qty: params.placket === 'double' ? '6颗' : params.placket === 'single' ? '3颗' : '—' });
  if (params.zipper !== 'none') bom.push({ name: '拉链', spec: optLabel('zipper', params.zipper), qty: '1条' });
  if (params.ornament === 'embroidery') bom.push({ name: '刺绣', spec: '机绣花卉 · 胸口左' });
  if (params.ornament === 'lace') bom.push({ name: '蕾丝花边', spec: '下摆滚边' });
  if (params.ornament === 'pearls') bom.push({ name: '珍珠', spec: '领口点缀' });
  if (params.stitch === 'contrast') bom.push({ name: '撞色线', spec: `线色 ${params.accent.toUpperCase()}` });

  const process = [
    '面料预缩与验布 → 排版裁剪',
    params.dart !== 'none' ? `收省（${optLabel('dart', params.dart)}）` : '省略省道',
    `缝合侧缝/肩缝（缝线：${optLabel('stitch', params.stitch, '暗缝')}）`,
    `装领：${optLabel('collar', params.collar)}`,
    params.category === 'dress' || params.category === 'shirt' || params.category === 'coat' || params.category === 'suit' ? `装袖：${optLabel('sleeve', params.sleeve)}` : '（无袖型结构）',
    params.pleat !== 'none' ? `裙身褶皱处理（${optLabel('pleat', params.pleat)}）` : '裙身平整处理',
    params.zipper !== 'none' ? `装拉链（${optLabel('zipper', params.zipper)}）` : '免拉链设计',
    `下摆处理（${optLabel('hem', params.hem)}）+ 整烫`,
    '质检：尺寸偏差 ≤5mm → 包装出货',
  ].filter(Boolean);

  const base = { bust: body?.bust ?? 84, waist: body?.waist ?? 64, hip: body?.hip ?? 90 };
  const sizes = ['XS', 'S', 'M', 'L', 'XL'].map((label, i) => {
    const d = i - 1;
    return {
      label,
      bust: Math.round(base.bust + d * 4),
      waist: Math.round(base.waist + d * 3.5),
      hip: Math.round(base.hip + d * 4),
      remark: label === 'M' && body ? '基础码（按体模）' : '',
    };
  });

  const styleParts: string[] = [];
  styleParts.push(optLabel('collar', params.collar, ''));
  if (['dress', 'shirt', 'coat', 'suit'].includes(params.category)) styleParts.push(optLabel('sleeve', params.sleeve, ''));
  styleParts.push(optLabel('fit', params.fit));
  if (['dress', 'skirt', 'coat', 'pants'].includes(params.category)) styleParts.push(`${LENGTH_LABEL(params.category, params.lengthCm)} ${params.lengthCm}cm`);
  styleParts.push(optLabel('waist', params.waist, ''));

  return {
    title: title || '未命名设计',
    categoryLabel: CATEGORY_LABELS[params.category],
    styleSummary: styleParts.filter(Boolean).join(' · '),
    bom,
    process,
    sizes,
    spec: [
      { label: '品类', value: CATEGORY_LABELS[params.category] },
      { label: '面料克重', value: fabric.weight },
      { label: '印花位置', value: params.pattern === 'none' ? '无' : optLabel('printPos', params.printPos) },
      { label: '里衬', value: optLabel('lining', params.lining, '无') },
      { label: '扣合方式', value: params.placket === 'none' ? '无' : optLabel('placket', params.placket) },
      { label: '装饰', value: optLabel('ornament', params.ornament, '无') },
      { label: '缝线', value: optLabel('stitch', params.stitch, '暗缝') },
    ],
    note: body
      ? `本款已按体型（H${body.height}/B${body.bust}/W${body.waist}/H${body.hip}）生成「一人一版」基准码 M，工厂按此放码。`
      : '建议先录入体型数据以生成「一人一版」基准尺寸。',
  };
}

export const techpackOfGroups = Object.keys(GROUP_LABELS).length;
