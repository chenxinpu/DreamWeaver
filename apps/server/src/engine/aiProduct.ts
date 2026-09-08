/**
 * AI 商品详情页生成（SPEC §3.3）：由 WindowMaterial + Work + 关联素材生成 Product.aiDetail。
 */
import { db } from '../db/store';
import type { Product, WindowMaterial, Work, AiDetail } from '../types';

const CAT_CN: Record<string, string> = {
  连衣裙: '连衣裙', 衬衫: '衬衫', 半裙: '半裙', 外套: '外套', 裤装: '裤装', 套装: '套装',
};

/** 取制造商默认 */
export function defaultManufacturer(): string {
  return '织梦柔性智造工厂 · 华东1号';
}

export function defaultProdDays(category: string): number {
  if (category === '外套' || category === '套装') return 12;
  if (category === '裤装') return 8;
  return 9;
}

/** 面料措辞（按部件面料名渲染） */
function fabricSentence(fabric: string): string {
  const f = fabric;
  if (f.includes('真丝') || f.includes('桑蚕丝')) return '真丝自带柔和光泽与良好垂坠，贴身亲肤透气，抗静电不闷汗；建议轻柔手洗、阴干。';
  if (f.includes('羊毛')) return '羊毛纤维卷曲回弹，挺括有型且保暖不透风，经防缩处理后打理更省心。';
  if (f.includes('亚麻')) return '亚麻天然粗犷的纹理自带松弛感，吸湿排汗性能出色，越穿越柔软。';
  if (f.includes('棉')) return '高支精梳棉触感细腻，吸湿透气，久穿不易起球变形。';
  if (f.includes('醋酸') || f.includes('缎')) return '醋酸缎面垂坠流动、光泽内敛，抗皱易打理，是通勤与约会的稳妥之选。';
  if (f.includes('针织') || f.includes('毛')) return '亲肤软糯的针织肌理，弹力适中包裹不勒，春秋叠穿利器。';
  return '面料经过起毛起球与色牢度测试，触感与耐久度俱佳。';
}

/** 生成 aiDetail */
export function buildAiDetail(win: WindowMaterial, work: Work): AiDetail {
  const category = CAT_CN[win.category] || win.category || '成衣';
  const styleStr = (win.styleTags || []).slice(0, 3).join('·');
  const title = win.productName || work.title;
  const matTitles = (ids: number[]) => ids.map((id) => db.materials.find((m) => m.id === id)?.fileName).filter(Boolean) as string[];
  const patternFiles = matTitles(win.patternMatIds);
  const modelFiles = matTitles(win.modelMatIds);
  const photoN = win.photos.length;

  const intro =
    `把「${styleStr || '原创'}」穿在身上：${title}，来自${(db.users.find((u) => u.id === win.creatorId)?.nickname) || '织梦创作者'}的原创${category}。` +
    `版型在虚拟试衣中反复校正，上身不挑比例；${photoN > 0 ? `${photoN} 组真人实拍场景照，所见即所得。` : '细节经多重质检，所见即所得。'}`;

  const designTool = modelFiles.length ? (modelFiles[0].toLowerCase().includes('.zprj') ? 'CLO 3D' : 'CLO/建模软件') : '设计软件';
  const patternTool = patternFiles.length ? 'DXF(R12)' : 'DXF';
  const story =
    `【从设计到生产】\n` +
    `① 设计：灵感与款式稿在 ${designTool} 中完成结构推敲，风格标签「${styleStr}」。\n` +
    `② 打版：版片以 ${patternTool} 输出并逐线校对（${patternFiles.length ? `版片文件：${patternFiles.join('、')}；` : ''}含刀口/对位点/缝份标注），确保工厂可直接套版。\n` +
    `③ 3D 试穿：用 ${modelFiles.length ? modelFiles.join('、') + ' 与 ' : ''}CLO 3D 质检版型与垂坠效果，虚拟真人模特多尺码试穿通过后才放样。\n` +
    `④ 排产：柔性工厂 C2M 小单快反排产，按单生产减少库存浪费。\n` +
    `⑤ 质检：成衣经面料成分、车缝线距、尺寸偏差三项出厂质检（附质检报告）。\n` +
    `⑥ 发货：独立包装，从华东仓发出。`;

  const sections: AiDetail['sections'] = [];
  // 面料
  const partLines = win.partsFabric.map((pf) => {
    const extra = pf.note ? `（${pf.note}）` : '';
    return `· ${pf.part}：${pf.fabric}${extra}——${fabricSentence(pf.fabric)}`;
  });
  sections.push({
    icon: 'fabric',
    title: '部件与面料',
    body:
      `面料克重与垂坠度经实测后确认，部件用料如下：\n${partLines.join('\n') || '· 面料：优质成衣面料，触感与耐久度俱佳。'}\n` +
      `色牢度≥4 级，起毛起球测试达标，细节可放心。`,
  });
  // 工艺
  sections.push({
    icon: 'craft',
    title: '工艺与版型',
    body:
      `版片经 DXF 刀口、对位点与缝份标注校对，车缝采用${win.category === '外套' ? '平缝+包边' : '锁边+平缝'}工艺，针距 3cm/12-14 针；` +
      `关键受力部位（肩缝/侧缝/袖窿）双线加固，袖窿与领口顺滑不硌。放码按国际尺码换算，见下方规格表。`,
  });
  // 规格
  const chartText = (win.spec.sizeChart || []).map((r) => {
    const bits = [
      r.bust !== undefined ? `胸围 ${r.bust}` : '',
      r.waist !== undefined ? `腰围 ${r.waist}` : '',
      r.hip !== undefined ? `臀围 ${r.hip}` : '',
      r.shoulder !== undefined ? `肩宽 ${r.shoulder}` : '',
      r.sleeve !== undefined ? `袖长 ${r.sleeve}` : '',
      r.length !== undefined ? `衣长 ${r.length}` : '',
    ].filter(Boolean).join(' / ');
    return `· ${r.size}：${bits}`;
  }).join('\n');
  sections.push({
    icon: 'size',
    title: '尺码与规格',
    body:
      `单位为 cm（成衣平铺）。${win.spec.label || '标准版型'}。\n${chartText || '· 规格表以商品页为准。'}\n` +
      `尺寸按国际尺码换算（如 M≈国际 M / 英码 10），选购拿不准可在商城「私人定制」录入体型，系统自动推荐基码并提示不合适部位。`,
  });
  // 生产
  sections.push({
    icon: 'factory',
    title: '生产与交付',
    body: `生产商：${defaultManufacturer()}；生产周期 ${win.prodDays ?? defaultProdDays(win.category)} 天内完成（定制顺延）。本商品由创作者 + 平台柔性供应链共同履约。`,
  });

  const baseFeeNote =
    `基础费用（定制专用，下单即付）说明：用于私人定制产生的加工与试错成本——` +
    `① 个性化工时与改版 ② 材料（版片损耗/试样面料） ③ 人工（量体对版/车缝） ④ 质检与定制包装。` +
    `定制商品支持「退货退原价、基础费用不退」，退货自动进入二手集市，规则见购物条款。`;

  return {
    intro,
    story,
    sections,
    sizeChart: win.spec.sizeChart || [],
    partsFabric: partLines,
    manufacturer: defaultManufacturer(),
    prodDays: win.prodDays ?? defaultProdDays(win.category),
    baseFeeNote,
  };
}

/** 依据 WindowMaterial+Work 生成 Product（不含入库存放） */
export function buildProduct(win: WindowMaterial, work: Work): Omit<Product, 'id'> {
  const aiDetail = buildAiDetail(win, work);
  return {
    creatorId: win.creatorId,
    workId: win.workId,
    windowId: win.id,
    title: win.productName || work.title,
    category: win.category,
    styleTags: win.styleTags || work.styleTags || [],
    price: win.price,
    baseFee: win.baseFee,
    cover: (win.photos[0] as string) || work.cover,
    images: win.photos.length ? win.photos : [work.cover, ...(work.mediaImages || [])],
    patternMatIds: win.patternMatIds.length ? win.patternMatIds : work.patternMatIds,
    modelMatIds: win.modelMatIds.length ? win.modelMatIds : work.modelMatIds,
    aiDetail,
    views: 0,
    sales: 0,
    status: 'onSale',
    createdAt: win.updatedAt || win.createdAt,
    prodDays: aiDetail.prodDays,
    likedBy: [],
  };
}
