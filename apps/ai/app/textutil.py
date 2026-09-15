"""文本/编码工具。

对应原实现：
  * ``apps/server/src/utils/misc.ts`` 的 ``r2``、``svgDataUrl``。
  * 另外补充了 JS 基础语义的等价实现（``encodeURIComponent``、模板字符串 ``${}`` 的
    数值/字符串转换），以便 Python 端输出与原 TS 实现**逐字符一致**。

架构红线：AI 生成类能力只在 Python 侧实现；本模块不引入任何重型依赖。
"""

from __future__ import annotations

import math
import urllib.parse

# JS ``Number.EPSILON``
_NUMBER_EPSILON = 2.220446049250313e-16

# JS ``encodeURIComponent`` 不转义的额外字符（字母/数字与 ``-_.~`` 由 quote 默认保留）。
# 注意：Python ``urllib.parse.quote`` 的默认 safe 是 ``'/'``，**必须显式传入**本常量，
# 否则 ``/`` 不会被百分号编码，与 JS 语义不符。
_JS_URI_UNRESERVED_EXTRA = "-_.!~*'()"


def encode_uri_component(text: str) -> str:
    """等价于 JS ``encodeURIComponent(text)``。

    * 未保留字符：``A-Za-z0-9-_.!~*'()``（其余一律百分号编码）。
    * 非 ASCII 按 UTF-8 逐字节编码，十六进制**大写**（``%E4%B8%AD``）。

    差异说明：JS 对孤立代理项（lone surrogate）抛 ``URIError``；这里退化为按
    ``surrogatepass`` 编出字节，避免服务 500。
    """
    if text is None:  # 防御：调用方不应传 None
        text = ""
    try:
        return urllib.parse.quote(
            text, safe=_JS_URI_UNRESERVED_EXTRA, encoding="utf-8", errors="strict"
        )
    except UnicodeEncodeError:
        return urllib.parse.quote(
            text, safe=_JS_URI_UNRESERVED_EXTRA, encoding="utf-8", errors="surrogatepass"
        )


def svg_data_url(svg: str) -> str:
    """对应 TS ``svgDataUrl``：``data:image/svg+xml;charset=utf-8,`` + encodeURIComponent(svg)。"""
    return "data:image/svg+xml;charset=utf-8," + encode_uri_component(svg)


def r2(x) -> float:
    """对应 TS ``r2``：``Math.round((x + Number.EPSILON) * 100) / 100``。

    ``Math.round`` 是「四舍五入到 +∞」（half up），等价于 ``floor(v + 0.5)``。
    """
    if x is None:
        return 0.0
    return math.floor((float(x) + _NUMBER_EPSILON) * 100 + 0.5) / 100


def _normalize_exponent(text: str) -> str:
    """把 Python 的 ``1e-07`` 规范成 JS 的 ``1e-7``（仅影响极小/极大数）。"""
    if "e" not in text and "E" not in text:
        return text
    mant, _, exp = text.replace("E", "e").partition("e")
    sign = "-" if exp.startswith("-") else ""
    digits = exp.lstrip("+-").lstrip("0") or "0"
    return f"{mant}e{sign}{digits}"


def js_number_to_string(value) -> str:
    """等价于 JS ``String(number)``（模板字符串里 ``${数字}`` 的渲染结果）。

    关键点：Java 用 Jackson 把 ``Double 84.0`` 序列化成 ``84.0``，JS ``JSON.parse`` 得到
    数字 ``84`` 并渲染为 ``"84"``；Python ``json`` 会得到 ``float 84.0``，直接 f-string
    会渲染成 ``"84.0"``。本函数负责抹平这个差异。
    """
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    v = float(value)
    if math.isnan(v):
        return "NaN"
    if math.isinf(v):
        return "Infinity" if v > 0 else "-Infinity"
    if v == 0:
        return "0"  # 同时覆盖 -0.0（JS String(-0) === '0'）
    if v.is_integer() and abs(v) < 1e21:
        return str(int(v))
    return _normalize_exponent(repr(v))


def js_str(value) -> str:
    """模板字符串里 ``${值}`` 的字符串语义（防御版）。

    与原 TS 的差异：TS 域内这些字段都是必填 ``string``，不会出现 ``null``/``undefined``；
    Java 用 ``@JsonInclude(NON_NULL)`` 省略 null 字段，故这里把 ``None`` 渲染为 ``''``
    （而不是 JS 的 ``'undefined'``），以免产出 ``来自undefined的原创`` 这类脏文案。
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return js_number_to_string(value)
    return str(value)


def replace_first(text: str, old: str, new: str) -> str:
    """等价于 JS ``String.prototype.replace(old, new)``（替换**第一处**，不是全部）。"""
    idx = text.find(old)
    if idx < 0:
        return text
    return text[:idx] + new + text[idx + len(old):]


__all__ = [
    "encode_uri_component",
    "svg_data_url",
    "r2",
    "js_number_to_string",
    "js_str",
    "replace_first",
]
