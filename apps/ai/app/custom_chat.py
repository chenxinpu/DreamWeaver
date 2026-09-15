"""AI 量体裁衣助手对话（规则模板）。

对应原实现：``apps/server/src/engine/custom.ts`` 的 ``customChat``
（``INSTRUCTION`` 常量、``matchAny``、袖/领/长/腰/面料/印花 六个分支 + 兜底）。

规则与文案逐字符搬运：分支判定顺序、options 的 key/title/desc、reply 全文
（含 emoji、全角标点、``￥`` 数值渲染）必须与原 TS 完全一致。
"""

from __future__ import annotations

from typing import List, Optional

from app.schemas import ChatOption, ChatRequest, ChatResponse, ChatTurn, ProductBrief
from app.textutil import js_number_to_string, js_str

# 对应 TS ``INSTRUCTION``（原样保留，供后续接入真实 LLM 时作为 system prompt）
INSTRUCTION = "你是织梦「AI 量体裁衣助手」。用户在与创作者合作对商品做私人定制：可改部件（领口/袖型/裙长/腰线）、设计元素、面料等。你给出可落地建议并用简短中文回复。"


def match_any(text: str, words: List[str]) -> bool:
    """对应 TS ``matchAny``：``words.some((w) => text.includes(w))``。"""
    return any(w in text for w in words)


def custom_chat(req: ChatRequest) -> ChatResponse:
    """对应 TS ``customChat(product, history)``。"""
    product: ProductBrief = req.product
    title = js_str(product.title)
    # 等价于 TS ``[...history].reverse().find(h => h.role === 'user')?.content || ''``
    last = ""
    for turn in reversed(list(req.history or [])):
        if turn.role == "user":
            last = js_str(turn.content)
            break

    def has(words: List[str]) -> bool:
        return match_any(last, words)

    options: List[ChatOption] = []

    if has(["袖", "泡泡袖", "喇叭袖", "袖型", "袖子"]):
        options.extend(
            [
                ChatOption(key="sleeve-puff", title="改泡泡袖", desc="袖山抽褶，甜美复古，适合肩部较窄"),
                ChatOption(key="sleeve-straight", title="改直筒袖", desc="利落通勤，简洁不挑场合"),
                ChatOption(key="sleeve-lantern", title="改灯笼袖", desc="上窄下宽，藏肉显仙气"),
            ]
        )
        return ChatResponse(
            reply=(
                f"关于「{title}」的袖型：我可以帮你调整为更适合体型的袖型。"
                "若肩偏窄选泡泡袖/灯笼袖增加轮廓；若要利落干练选直筒袖。选择下方方案我会立即生成预览图。"
            ),
            options=options,
        )

    if has(["领", "领口", "方领", "V领", "圆领", "一字肩", "高领"]):
        options.extend(
            [
                ChatOption(key="neck-square", title="方领", desc="显锁骨，复古法式感"),
                ChatOption(key="neck-v", title="V 领", desc="拉长颈线，适合圆脸/短脖"),
                ChatOption(key="neck-round", title="圆领", desc="日常百搭，不挑人"),
                ChatOption(key="neck-high", title="半高领", desc="秋冬保暖，优雅知性"),
            ]
        )
        return ChatResponse(
            reply=(
                "领口是影响上身比例的关键。"
                + ("这件法式风格可优先考虑方领" if "法式" in (product.styleTags or []) else "根据脸型与颈长选择")
                + "：V 领最显修长，方领复古，圆领最稳妥。选择后可生成图预览。"
            ),
            options=options,
        )

    if has(["长", "裙长", "衣长", "短一点", "长一点", "膝"]):
        options.extend(
            [
                ChatOption(key="len-mini", title="及膝偏短", desc="活泼俏皮，显腿长"),
                ChatOption(key="len-midi", title="中长(及小腿肚)", desc="优雅通勤，遮小腿"),
                ChatOption(key="len-maxi", title="长款(及踝)", desc="飘逸度假，显高挑"),
            ]
        )
        return ChatResponse(
            reply="衣长调整会同步影响版片裁切与排料。参考身高与比例：155-160cm 选及膝，160-168 中长更修饰，168+ 可大胆长款。",
            options=options,
        )

    if has(["腰", "收腰", "腰线", "高腰", "A字", "版型"]):
        options.extend(
            [
                ChatOption(key="waist-fit", title="修身收腰", desc="勾勒曲线，正装/约会"),
                ChatOption(key="waist-empire", title="高腰线", desc="拉长腿部比例，显高"),
                ChatOption(key="waist-relax", title="宽松直筒", desc="舒适日常，遮小腹"),
            ]
        )
        return ChatResponse(
            reply="腰线设计决定整体廓形。收腰显身材、高腰显腿长、直筒最舒适。结合你的腰臀差可给出最合适版型。",
            options=options,
        )

    if has(["面", "料", "材质", "真丝", "棉", "羊毛", "缎", "透气", "厚"]):
        options.extend(
            [
                ChatOption(key="fab-silk", title="真丝/桑蚕丝", desc="光泽垂坠，贵气（+¥120）"),
                ChatOption(key="fab-cotton", title="高支棉", desc="亲肤透气易打理（+¥0）"),
                ChatOption(key="fab-linen", title="亚麻", desc="松弛度假感，吸湿快干（+¥0）"),
                ChatOption(key="fab-wool", title="羊毛混纺", desc="挺括保暖，适合秋冬（+¥90）"),
            ]
        )
        return ChatResponse(
            reply="面料可替换，影响质感/克重/护理方式；替换面料将触发「材料变更 → 重新走橱窗审核」，已按默认加价给出方案。",
            options=options,
        )

    if has(["碎花", "印花", "波点", "图案", "颜色", "配色"]):
        options.extend(
            [
                ChatOption(key="print-floral", title="碎花印花", desc="浪漫复古（花位可指定）"),
                ChatOption(key="print-dot", title="波点", desc="经典俏皮"),
                ChatOption(key="color-solid", title="净色(米白/雾蓝/黑)", desc="极简高级，好搭配"),
            ]
        )
        return ChatResponse(
            reply="印花/配色素材可从「素材库 SVG/图片」带入；若替换设计元素同样需要重新审核材料。你可以从下方选择或描述想要的花型。",
            options=options,
        )

    # 兜底：把可改维度都列出来引导
    options.extend(
        [
            ChatOption(key="sleeve-puff", title="改袖型（泡泡袖等）", desc="甜美/复古/干练风格随你"),
            ChatOption(key="neck-v", title="改领口", desc="V领/方领/圆领可选"),
            ChatOption(key="len-midi", title="改裙长/衣长", desc="调整廓形比例"),
            ChatOption(key="fab-silk", title="换面料", desc="材料变更需重新审核"),
        ]
    )
    return ChatResponse(
        reply=(
            "我是织梦 AI 量体裁衣助手 ✂️。"
            f"当前商品「{title}」（￥{js_number_to_string(product.price)}，定制基础费 ￥{js_number_to_string(product.baseFee)}）。"
            "你可以直接说想改哪里，例如「袖子改成泡泡袖」「换成V领」「面料想透气些」；也可以从下方入口开始。"
            "定制确认后先付全款，退货仅退原价、基础费用不退（详见条款）。"
        ),
        options=options,
    )


def custom_chat_legacy(product: ProductBrief, history: Optional[List[ChatTurn]] = None) -> ChatResponse:
    """便捷入口：``customChat(product, history)`` 风格调用。"""
    return custom_chat(
        ChatRequest(product=product or ProductBrief(), history=list(history or []))
    )


__all__ = ["INSTRUCTION", "match_any", "custom_chat", "custom_chat_legacy"]
