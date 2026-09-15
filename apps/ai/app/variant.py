"""款式变体生成（纯 SVG data-url 出图）。

对应原实现：``apps/server/src/engine/custom.ts`` 的 ``genVariantSvg``
（``STYLE_HEX`` 配色、``silhouette`` 裙装轮廓 path、``labels`` 定位、
各 ``optionKey`` 前缀分支、``applied`` 文案、最终 svg 拼接 + ``svgDataUrl``）。

出图不用任何图像库，纯字符串拼接；``image`` 必须是
``data:image/svg+xml;charset=utf-8,`` + JS ``encodeURIComponent`` 语义的百分号编码。
"""

from __future__ import annotations

from typing import List, Tuple

from app.schemas import ProductBrief, VariantRequest, VariantResponse
from app.textutil import js_number_to_string, js_str, replace_first, svg_data_url

# 风格标签 → 主色（对应 TS STYLE_HEX）
STYLE_HEX = {
    "法式": "#D44771",
    "碎花": "#E88DA6",
    "韩系": "#8A9BC0",
    "复古": "#B9816B",
    "极简": "#4A4A52",
    "甜美": "#F2B8C0",
    "通勤": "#7C8AA0",
    "东方": "#7C8A6F",
}


def gen_variant_svg(req: VariantRequest) -> VariantResponse:
    """对应 TS ``genVariantSvg(product, optionKey)``。"""
    product: ProductBrief = req.product
    style_tags = list(product.styleTags or [])
    option_key = js_str(req.optionKey)
    title = js_str(product.title)

    # 等价于 TS ``STYLE_HEX[(styleTags||[]).find(t => STYLE_HEX[t]) || ''] || '#D44771'``
    main = next((STYLE_HEX[t] for t in style_tags if STYLE_HEX.get(t)), None) or "#D44771"
    accent = "#E85C87"

    # 简易裙装轮廓
    silhouette = (
        f'<path d="M130 40 C 60 44 58 96 96 108 C 80 128 84 158 118 166 L 66 220 C 40 246 46 270 88 262 '
        f'L 176 262 C 218 270 224 246 198 220 L 146 166 C 180 158 184 128 168 108 C 206 96 204 44 134 40 Z" '
        f'fill="{main}" opacity="0.16" stroke="{main}" stroke-width="2"/>'
    )

    labels: List[Tuple[int, int, str]] = [(152, 28, "正面款式草图")]
    applied: List[str] = []

    if option_key.startswith("sleeve"):
        labels.append((106, 120, "▲ 袖型调整"))
        labels.append((158, 120, "▲ 袖型调整"))
        suffix = replace_first(option_key, "sleeve-", "")
        applied.append(
            f"袖型 → {'泡泡袖' if suffix == 'puff' else '灯笼袖' if suffix == 'lantern' else '直筒袖'}"
        )
    if option_key.startswith("neck"):
        labels.append((152, 84, "领口调整 →"))
        suffix = replace_first(option_key, "neck-", "")
        applied.append(
            f"领口 → {'V领' if suffix == 'v' else '方领' if suffix == 'square' else '半高领' if suffix == 'high' else '圆领'}"
        )
    if option_key.startswith("len"):
        labels.append((152, 288, "↓ 长度示意"))
        suffix = replace_first(option_key, "len-", "")
        applied.append(
            f"长度 → {'及膝偏短' if suffix == 'mini' else '长款及踝' if suffix == 'maxi' else '中长及小腿'}"
        )
    if option_key.startswith("waist"):
        labels.append((152, 168, "✂ 腰线"))
        suffix = replace_first(option_key, "waist-", "")
        applied.append(
            f"腰线 → {'修身收腰' if suffix == 'fit' else '高腰' if suffix == 'empire' else '宽松直筒'}"
        )
    if option_key.startswith("fab"):
        labels.append((152, 220, "面料采样"))
        suffix = replace_first(option_key, "fab-", "")
        applied.append(
            f"面料 → {'真丝' if suffix == 'silk' else '高支棉' if suffix == 'cotton' else '亚麻' if suffix == 'linen' else '羊毛混纺'}"
        )
    if option_key.startswith("print") or option_key.startswith("color"):
        labels.append((152, 190, "印花/配色"))
        applied.append("图案 → 花型" if option_key.startswith("print") else "配色 → 净色")
    if not applied:
        applied.append("样式微调")

    text_els = "".join(
        f'<text x="{js_number_to_string(x)}" y="{js_number_to_string(y)}" text-anchor="middle" '
        f'font-size="11" fill="#565B63">{t}</text>'
        for (x, y, t) in labels
    )
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">'
        + '<rect width="300" height="300" fill="#FFF9F7"/>'
        + silhouette
        + text_els
        + f'<rect x="20" y="272" width="10" height="10" fill="{accent}"/>'
        + f'<text x="36" y="281" font-size="10" fill="#8A8F98">织梦 AI 款式预览 · {title}</text>'
        + "</svg>"
    )

    return VariantResponse(
        image=svg_data_url(svg),
        title=" · ".join(applied),
        desc=(
            f"{'、'.join(applied)}已生成参变化预览（非最终成衣图）。"
            "确认后将在定制订单中应用，材料类变更（面料/印花/换版）将同步触发橱窗重新审核。"
        ),
        applied=applied,
    )


def gen_variant_svg_legacy(product: ProductBrief, option_key: str) -> VariantResponse:
    """便捷入口：``genVariantSvg(product, optionKey)`` 风格调用。"""
    return gen_variant_svg(
        VariantRequest(product=product or ProductBrief(), optionKey=option_key)
    )


__all__ = ["STYLE_HEX", "gen_variant_svg", "gen_variant_svg_legacy"]
