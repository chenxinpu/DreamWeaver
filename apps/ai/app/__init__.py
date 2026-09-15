"""织梦 DreamWeaver Python AI 服务包。

模块对应关系（原 Node 实现 → 本服务）：
  * ``app/product_detail.py`` ← ``apps/server/src/engine/aiProduct.ts``（buildAiDetail）
  * ``app/custom_chat.py``    ← ``apps/server/src/engine/custom.ts``（customChat）
  * ``app/variant.py``        ← ``apps/server/src/engine/custom.ts``（genVariantSvg）
  * ``app/textutil.py``       ← ``apps/server/src/utils/misc.ts``（r2 / svgDataUrl）
  * ``app/schemas.py``        ← ``apps/core/.../ai/AiDtos.java`` + ``domain/AiDetail.java``
"""

__version__ = "2.0.0"
