"""逐字符对齐自检（不依赖 pytest，纯标准库 + 本服务代码）。

运行：``apps/ai/.venv/bin/python -m app.selftest``

参照物 ``app/reference_fixtures.json`` 是**由原 TS 实现直接执行**生成的
（``apps/server/src/engine/aiProduct.ts`` / ``custom.ts`` 经 esbuild 转译后用 Node 跑一遍，
 输出原文），因此本自检等价于「Python 版输出 === 原 Node 版输出」的逐字符比对：

  * ``detail``  ：5 组商品详情页（含 CAT_CN 命中/未命中、空素材、prodDays=0/缺省/15、
                  面料 6 个分支、story ③ 的可选片段）→ 整个 AiDetail 深比较
  * ``chat``    ：45 组定制对话（6 个规则分支 + 兜底 + 空历史 + 末条非 user）→ 整个 ChatResponse 深比较
  * ``variant`` ：59 组款式变体（各 optionKey 前缀分支 + 非法 key 兜底 + 无风格标签）→
                  title/desc/applied 深比较 + **image 的 sha256**（覆盖 svg 拼接 + svgDataUrl 编码）
  * ``encode``  ：7 组 ``encodeURIComponent`` 参考值（含整段 svg data-url）

另有硬编码断言：``svg_data_url('<svg>')`` 必须等于
``data:image/svg+xml;charset=utf-8,%3Csvg%3E``。
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

from app.custom_chat import custom_chat
from app.product_detail import build_ai_detail
from app.schemas import ChatRequest, ProductBrief, ProductDetailRequest, VariantRequest
from app.textutil import encode_uri_component, r2, svg_data_url
from app.variant import gen_variant_svg

FIXTURES = Path(__file__).with_name("reference_fixtures.json")

_failures: list[str] = []
_checks = 0


def _expect(label: str, actual, expected) -> None:
    global _checks
    _checks += 1
    if actual != expected:
        _failures.append(f"{label}\n  期望: {expected!r}\n  实际: {actual!r}")


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def check_encoding_hardcoded() -> None:
    """硬编码的 encodeURIComponent 断言（与 JS ``encodeURIComponent('<svg>')`` 一致）。"""
    _expect(
        "svg_data_url('<svg>')",
        svg_data_url("<svg>"),
        "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
    )
    _expect("encodeURIComponent('/')", encode_uri_component("/"), "%2F")
    _expect("encodeURIComponent(\"'\")", encode_uri_component("'"), "'")
    _expect("encodeURIComponent('中')", encode_uri_component("中"), "%E4%B8%AD")
    _expect(
        "encodeURIComponent 未保留字符集",
        encode_uri_component("abcXYZ019-_.!~*'()"),
        "abcXYZ019-_.!~*'()",
    )


def check_r2() -> None:
    """r2 的 JS ``Math.round`` 语义抽查（期望值取自 Node 直接执行原 ``misc.ts``）。"""
    cases = [
        (1.005, 1.01),
        (2.675, 2.68),
        (378, 378),
        (0.1 + 0.2, 0.3),
        (-1.005, -1),
        (-2.675, -2.67),
        (84.0, 84),
        (199.5, 199.5),
        (1e-7, 0),
        (123456789.123, 123456789.12),
        (0, 0),
        (-0.5, -0.5),
        (2.5, 2.5),
        (-2.5, -2.5),
        (33.333333, 33.33),
        (1 / 3, 0.33),
    ]
    for value, expected in cases:
        _expect(f"r2({value!r})", r2(value), expected)


def check_encoding_fixtures(data: dict) -> None:
    for case in data["encode"]:
        _expect(f"encodeURIComponent({case['raw'][:24]!r}…)", encode_uri_component(case["raw"]), case["encoded"])


def check_detail(data: dict) -> None:
    for case in data["detail"]:
        req = ProductDetailRequest.model_validate(case["request"])
        actual = build_ai_detail(req).model_dump(exclude_none=True)
        _expect(f"product-detail[{case['name']}]", actual, case["expected"])


def check_chat(data: dict) -> None:
    for case in data["chat"]:
        req = ChatRequest(product=ProductBrief.model_validate(case["product"]), history=case["history"])
        actual = custom_chat(req).model_dump()
        _expect(f"custom/chat[{case['name']}]", actual, case["expected"])


def check_variant(data: dict) -> None:
    for case in data["variant"]:
        req = VariantRequest(product=ProductBrief.model_validate(case["product"]), optionKey=case["optionKey"])
        got = gen_variant_svg(req)
        exp = case["expected"]
        _expect(f"custom/variant[{case['name']}].title", got.title, exp["title"])
        _expect(f"custom/variant[{case['name']}].desc", got.desc, exp["desc"])
        _expect(f"custom/variant[{case['name']}].applied", got.applied, exp["applied"])
        _expect(f"custom/variant[{case['name']}].imageLen", len(got.image), exp["imageLength"])
        _expect(f"custom/variant[{case['name']}].imageSha256", _sha256(got.image), exp["imageSha256"])
        if "image" in exp:  # 代表用例保留整段 image，做整串比对
            _expect(f"custom/variant[{case['name']}].image", got.image, exp["image"])


def main() -> int:
    if not FIXTURES.exists():
        print(f"[selftest] 缺少参照物 {FIXTURES}，无法自检", file=sys.stderr)
        return 2
    data = json.loads(FIXTURES.read_text(encoding="utf-8"))
    print(f"[selftest] 参照物：{data['source']}")
    print(
        f"[selftest] 用例数：detail={len(data['detail'])} chat={len(data['chat'])} "
        f"variant={len(data['variant'])} encode={len(data['encode'])}"
    )

    check_encoding_hardcoded()
    check_r2()
    check_encoding_fixtures(data)
    check_detail(data)
    check_chat(data)
    check_variant(data)

    print(f"[selftest] 断言 {_checks} 条，失败 {len(_failures)} 条")
    for f in _failures[:20]:
        print("  ✗ " + f)
    if _failures:
        print("[selftest] 结果：FAILED")
        return 1
    print("[selftest] 结果：OK —— 与原 Node/TS 实现逐字符一致")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
