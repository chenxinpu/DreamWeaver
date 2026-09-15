"""Pydantic 数据模型 —— 严格对应 Java 侧契约。

对应原实现：
  * ``apps/core/src/main/java/com/dreamweaver/core/ai/AiDtos.java``（请求/响应 DTO）
  * ``apps/core/src/main/java/com/dreamweaver/core/domain/AiDetail.java``（AiDetail）
  * ``apps/core/src/main/java/com/dreamweaver/core/domain/AiSection.java``（AiSection）
  * ``apps/core/src/main/java/com/dreamweaver/core/domain/SizeChartRow.java``（SizeChartRow）

约束（与原 TS ``types.ts`` / Java 实体一致）：
  * 字段名一律 camelCase（Java 直接按字段名做 JSON 反序列化，字段名 = 契约）。
  * Java 侧 ``@JsonInclude(NON_NULL)`` 会省略 null 字段，因此这里全部给默认值，
    并在响应上用 ``exclude_none=True`` 复刻「省略而不是写 null」的行为。
  * 额外字段一律忽略（``extra="ignore"``），保证 Java 侧扩展字段不会把服务打挂。
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class _Model(BaseModel):
    """统一配置：忽略未知字段，允许按字段名填充。"""

    model_config = ConfigDict(extra="ignore")


# ============================ 请求：商品详情页生成 ============================


class FabricPartReq(_Model):
    """对应 AiDtos.FabricPartReq（部件 / 面料 / 备注）。"""

    part: Optional[str] = None
    fabric: Optional[str] = None
    note: Optional[str] = None


class SizeChartRow(_Model):
    """对应 domain.SizeChartRow（尺码表行，缺项为 None → 响应中省略）。"""

    size: str = ""
    bust: Optional[float] = None
    waist: Optional[float] = None
    hip: Optional[float] = None
    shoulder: Optional[float] = None
    sleeve: Optional[float] = None
    length: Optional[float] = None


class ProductDetailRequest(_Model):
    """对应 AiDtos.ProductDetailRequest。

    Java 侧 ``AiServiceClient.buildProductDetail`` 已在 Java 内完成「素材 id → 文件名」、
    「创作者昵称」「照片数量」等查表，Python 侧只做纯文案生成（原 ``buildAiDetail`` 的
    非查表部分）。
    """

    title: Optional[str] = None
    category: Optional[str] = None
    productName: Optional[str] = None
    styleTags: List[str] = Field(default_factory=list)
    photosCount: int = 0
    creatorNickname: Optional[str] = None
    partsFabric: List[FabricPartReq] = Field(default_factory=list)
    sizeChart: List[SizeChartRow] = Field(default_factory=list)
    specLabel: Optional[str] = None
    patternFiles: List[str] = Field(default_factory=list)
    modelFiles: List[str] = Field(default_factory=list)
    prodDays: Optional[int] = None


# ============================ 响应：商品详情页生成 ============================


class AiSection(_Model):
    """对应 domain.AiSection（详情页图文段落）。"""

    icon: Optional[str] = None
    title: str = ""
    body: str = ""


class AiDetail(_Model):
    """对应 domain.AiDetail —— 字段名/顺序与 Java 完全一致。

    注意 ``partsFabric`` 这里是**字符串数组**（``· 前片：真丝（19姆米）——…``），
    与请求里的对象数组同名但不同型。
    """

    intro: str = ""
    story: str = ""
    sections: List[AiSection] = Field(default_factory=list)
    sizeChart: List[SizeChartRow] = Field(default_factory=list)
    partsFabric: List[str] = Field(default_factory=list)
    manufacturer: str = ""
    prodDays: int = 0
    baseFeeNote: str = ""


# ============================ 定制对话 / 款式变体 ============================


class ProductBrief(_Model):
    """对应 AiDtos.ProductBrief（商品摘要，避免整包 Product 过线）。"""

    id: int = 0
    title: Optional[str] = None
    price: float = 0.0
    baseFee: float = 0.0
    category: Optional[str] = None
    styleTags: List[str] = Field(default_factory=list)


class ChatTurn(_Model):
    """对应 AiDtos.ChatTurn（历史消息一条）。"""

    role: Optional[str] = None
    content: Optional[str] = None


class ChatRequest(_Model):
    """对应 AiDtos.ChatRequest。"""

    product: ProductBrief = Field(default_factory=ProductBrief)
    history: List[ChatTurn] = Field(default_factory=list)


class ChatOption(_Model):
    """对应 AiDtos.ChatOption（可点选方案）。"""

    key: str = ""
    title: str = ""
    desc: str = ""


class ChatResponse(_Model):
    """对应 AiDtos.ChatResponse。"""

    reply: str = ""
    options: List[ChatOption] = Field(default_factory=list)


class VariantRequest(_Model):
    """对应 AiDtos.VariantRequest。"""

    product: ProductBrief = Field(default_factory=ProductBrief)
    optionKey: Optional[str] = None


class VariantResponse(_Model):
    """对应 AiDtos.VariantResponse。"""

    image: str = ""
    title: str = ""
    desc: str = ""
    applied: List[str] = Field(default_factory=list)


__all__ = [
    "FabricPartReq",
    "SizeChartRow",
    "ProductDetailRequest",
    "AiSection",
    "AiDetail",
    "ProductBrief",
    "ChatTurn",
    "ChatRequest",
    "ChatOption",
    "ChatResponse",
    "VariantRequest",
    "VariantResponse",
]
