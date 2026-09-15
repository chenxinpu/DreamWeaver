"""商品详情页文案生成。

对应原实现：``apps/server/src/engine/aiProduct.ts`` 的 ``buildAiDetail``
（``CAT_CN`` / ``defaultManufacturer`` / ``defaultProdDays`` / ``fabricSentence`` /
 intro / story 六段 / 四个 sections / baseFeeNote）。

与原 TS 的唯一差别（由 Java 侧 ``AiServiceClient.buildProductDetail`` 承担，属于架构分工）：
  * ``db.materials`` 查表（``patternMatIds``/``modelMatIds`` → 文件名）→ 请求体传入
    ``patternFiles``/``modelFiles``。
  * ``db.users`` 查表（``creatorId`` → 昵称）→ 请求体传入 ``creatorNickname``。
  * ``win.photos.length`` → 请求体传入 ``photosCount``。
文案本身逐字符搬运，未作任何改写。
"""

from __future__ import annotations

from typing import List, Optional

from app.schemas import AiDetail, AiSection, ProductDetailRequest
from app.textutil import js_number_to_string, js_str

# 中文品类映射（对应 TS 的 CAT_CN）
CAT_CN = {
    "连衣裙": "连衣裙",
    "衬衫": "衬衫",
    "半裙": "半裙",
    "外套": "外套",
    "裤装": "裤装",
    "套装": "套装",
}

_MANUFACTURER = "织梦柔性智造工厂 · 华东1号"


def default_manufacturer() -> str:
    """对应 TS ``defaultManufacturer``。"""
    return _MANUFACTURER


def default_prod_days(category: Optional[str]) -> int:
    """对应 TS ``defaultProdDays``：外套/套装 → 12，裤装 → 8，其他 → 9。"""
    if category == "外套" or category == "套装":
        return 12
    if category == "裤装":
        return 8
    return 9


def fabric_sentence(fabric: Optional[str]) -> str:
    """对应 TS ``fabricSentence``：按部件面料名渲染面料措辞（分支顺序必须一致）。"""
    f = js_str(fabric)
    if "真丝" in f or "桑蚕丝" in f:
        return "真丝自带柔和光泽与良好垂坠，贴身亲肤透气，抗静电不闷汗；建议轻柔手洗、阴干。"
    if "羊毛" in f:
        return "羊毛纤维卷曲回弹，挺括有型且保暖不透风，经防缩处理后打理更省心。"
    if "亚麻" in f:
        return "亚麻天然粗犷的纹理自带松弛感，吸湿排汗性能出色，越穿越柔软。"
    if "棉" in f:
        return "高支精梳棉触感细腻，吸湿透气，久穿不易起球变形。"
    if "醋酸" in f or "缎" in f:
        return "醋酸缎面垂坠流动、光泽内敛，抗皱易打理，是通勤与约会的稳妥之选。"
    if "针织" in f or "毛" in f:
        return "亲肤软糯的针织肌理，弹力适中包裹不勒，春秋叠穿利器。"
    return "面料经过起毛起球与色牢度测试，触感与耐久度俱佳。"


def build_ai_detail(req: ProductDetailRequest) -> AiDetail:
    """对应 TS ``buildAiDetail(win, work)``（这里入参已由 Java 侧拍平成请求体）。"""
    category = CAT_CN.get(js_str(req.category)) or js_str(req.category) or "成衣"
    style_str = "·".join((req.styleTags or [])[:3])
    title = js_str(req.productName) or js_str(req.title)
    pattern_files = [js_str(x) for x in (req.patternFiles or [])]
    model_files = [js_str(x) for x in (req.modelFiles or [])]
    photo_n = req.photosCount or 0

    intro = (
        f"把「{style_str or '原创'}」穿在身上：{title}，来自{js_str(req.creatorNickname) or '织梦创作者'}的原创{category}。"
        + "版型在虚拟试衣中反复校正，上身不挑比例；"
        + (
            f"{photo_n} 组真人实拍场景照，所见即所得。"
            if photo_n > 0
            else "细节经多重质检，所见即所得。"
        )
    )

    design_tool = (
        ("CLO 3D" if ".zprj" in model_files[0].lower() else "CLO/建模软件")
        if model_files
        else "设计软件"
    )
    pattern_tool = "DXF(R12)" if pattern_files else "DXF"
    # ② 里的「版片文件：…；」与 ③ 里的「… 与 」都是原实现的条件片段
    pattern_part = f"版片文件：{'、'.join(pattern_files)}；" if pattern_files else ""
    model_part = f"{'、'.join(model_files)} 与 " if model_files else ""
    story = (
        "【从设计到生产】\n"
        + f"① 设计：灵感与款式稿在 {design_tool} 中完成结构推敲，风格标签「{style_str}」。\n"
        + f"② 打版：版片以 {pattern_tool} 输出并逐线校对（{pattern_part}含刀口/对位点/缝份标注），确保工厂可直接套版。\n"
        + f"③ 3D 试穿：用 {model_part}CLO 3D 质检版型与垂坠效果，虚拟真人模特多尺码试穿通过后才放样。\n"
        + "④ 排产：柔性工厂 C2M 小单快反排产，按单生产减少库存浪费。\n"
        + "⑤ 质检：成衣经面料成分、车缝线距、尺寸偏差三项出厂质检（附质检报告）。\n"
        + "⑥ 发货：独立包装，从华东仓发出。"
    )

    sections: List[AiSection] = []

    # 面料
    part_lines: List[str] = []
    for pf in req.partsFabric or []:
        note = js_str(pf.note)
        extra = f"（{note}）" if note else ""
        part_lines.append(
            f"· {js_str(pf.part)}：{js_str(pf.fabric)}{extra}——{fabric_sentence(pf.fabric)}"
        )
    sections.append(
        AiSection(
            icon="fabric",
            title="部件与面料",
            body=(
                "面料克重与垂坠度经实测后确认，部件用料如下：\n"
                + ("\n".join(part_lines) if part_lines else "· 面料：优质成衣面料，触感与耐久度俱佳。")
                + "\n色牢度≥4 级，起毛起球测试达标，细节可放心。"
            ),
        )
    )

    # 工艺
    sections.append(
        AiSection(
            icon="craft",
            title="工艺与版型",
            body=(
                f"版片经 DXF 刀口、对位点与缝份标注校对，车缝采用{'平缝+包边' if req.category == '外套' else '锁边+平缝'}工艺，针距 3cm/12-14 针；"
                + "关键受力部位（肩缝/侧缝/袖窿）双线加固，袖窿与领口顺滑不硌。放码按国际尺码换算，见下方规格表。"
            ),
        )
    )

    # 规格
    chart_rows: List[str] = []
    for r in req.sizeChart or []:
        bits = [
            f"胸围 {js_number_to_string(r.bust)}" if r.bust is not None else "",
            f"腰围 {js_number_to_string(r.waist)}" if r.waist is not None else "",
            f"臀围 {js_number_to_string(r.hip)}" if r.hip is not None else "",
            f"肩宽 {js_number_to_string(r.shoulder)}" if r.shoulder is not None else "",
            f"袖长 {js_number_to_string(r.sleeve)}" if r.sleeve is not None else "",
            f"衣长 {js_number_to_string(r.length)}" if r.length is not None else "",
        ]
        chart_rows.append(f"· {js_str(r.size)}：{' / '.join([b for b in bits if b])}")
    chart_text = "\n".join(chart_rows)
    sections.append(
        AiSection(
            icon="size",
            title="尺码与规格",
            body=(
                f"单位为 cm（成衣平铺）。{js_str(req.specLabel) or '标准版型'}。\n"
                + (chart_text if chart_text else "· 规格表以商品页为准。")
                + "\n尺寸按国际尺码换算（如 M≈国际 M / 英码 10），选购拿不准可在商城「私人定制」录入体型，系统自动推荐基码并提示不合适部位。"
            ),
        )
    )

    # 生产
    prod_days = req.prodDays if req.prodDays is not None else default_prod_days(req.category)
    sections.append(
        AiSection(
            icon="factory",
            title="生产与交付",
            body=f"生产商：{default_manufacturer()}；生产周期 {prod_days} 天内完成（定制顺延）。本商品由创作者 + 平台柔性供应链共同履约。",
        )
    )

    base_fee_note = (
        "基础费用（定制专用，下单即付）说明：用于私人定制产生的加工与试错成本——"
        + "① 个性化工时与改版 ② 材料（版片损耗/试样面料） ③ 人工（量体对版/车缝） ④ 质检与定制包装。"
        + "定制商品支持「退货退原价、基础费用不退」，退货自动进入二手集市，规则见购物条款。"
    )

    return AiDetail(
        intro=intro,
        story=story,
        sections=sections,
        sizeChart=list(req.sizeChart or []),
        partsFabric=part_lines,
        manufacturer=default_manufacturer(),
        prodDays=int(prod_days),
        baseFeeNote=base_fee_note,
    )


__all__ = [
    "CAT_CN",
    "default_manufacturer",
    "default_prod_days",
    "fabric_sentence",
    "build_ai_detail",
]
