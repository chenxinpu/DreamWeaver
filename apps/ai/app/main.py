"""织梦 DreamWeaver Python AI 服务（FastAPI 入口）。

架构红线：**AI 生成类能力只由本服务实现**（原 ``apps/server/src/engine/{aiProduct,custom}.ts``
里的生成逻辑全部搬到 Python）；Java（``apps/core``）只负责组装请求、落库与驱动后续业务。

路由（与 ``apps/core/.../ai/AiServiceClient`` 严格对齐）：
  * ``GET  /health``            探活
  * ``POST /ai/product-detail`` 商品详情页文案生成（原 buildAiDetail）
  * ``POST /ai/custom/chat``    定制 AI 对话（原 customChat）
  * ``POST /ai/custom/variant`` 款式变体出图（原 genVariantSvg）

内部令牌：请求头 ``X-Internal-Token`` **缺失时照常放行**（便于本地 curl/探活），
**存在但不匹配时返回 401**；期望值取环境变量 ``DW_INTERNAL_TOKEN``，默认
``dw-internal-dev-token``（与 Java 的 ``dw.internal-token`` 默认值一致）。
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.custom_chat import custom_chat
from app.product_detail import build_ai_detail
from app.schemas import (
    AiDetail,
    ChatRequest,
    ChatResponse,
    ProductDetailRequest,
    VariantRequest,
    VariantResponse,
)
from app.variant import gen_variant_svg

SERVICE_NAME = "dreamweaver-ai"
SERVICE_VERSION = "2.0.0"
ENDPOINTS = [
    "GET /health",
    "POST /ai/product-detail",
    "POST /ai/custom/chat",
    "POST /ai/custom/variant",
]
DEFAULT_INTERNAL_TOKEN = "dw-internal-dev-token"
TOKEN_HEADER = "X-Internal-Token"

log = logging.getLogger("dreamweaver.ai")

app = FastAPI(
    title="DreamWeaver AI Service",
    description="织梦 AI 生成能力（详情页文案 / 定制对话 / 款式变体出图），供 Java core 内网调用。",
    version=SERVICE_VERSION,
)


def expected_token() -> str:
    """期望的内部令牌（支持用 ``DW_INTERNAL_TOKEN`` 覆盖）。"""
    return os.environ.get("DW_INTERNAL_TOKEN") or DEFAULT_INTERNAL_TOKEN


def _error(status_code: int, code: str, msg: str) -> JSONResponse:
    """统一错误响应：``{ok:false, code, msg}``（绝不吐 HTML）。"""
    return JSONResponse(status_code=status_code, content={"ok": False, "code": code, "msg": msg})


@app.middleware("http")
async def internal_token_guard(request: Request, call_next):
    """内部令牌校验：头缺失放行，头存在且不匹配 → 401。"""
    provided = request.headers.get(TOKEN_HEADER)
    if provided is not None and provided != expected_token():
        log.warning("[ai] 内部令牌不匹配 path=%s", request.url.path)
        return _error(401, "UNAUTHORIZED", "内部令牌（X-Internal-Token）不匹配，拒绝访问")
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def on_validation_error(request: Request, exc: RequestValidationError):
    """请求体/参数校验失败 → 422 JSON（不是 FastAPI 默认的 detail 结构）。"""
    return _error(422, "BAD_REQUEST", f"请求体校验失败：{_summarize_validation(exc)}")


@app.exception_handler(StarletteHTTPException)
async def on_http_error(request: Request, exc: StarletteHTTPException):
    """404/405 等 → JSON（而不是 HTML 错误页）。"""
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 401: "UNAUTHORIZED"}.get(
        exc.status_code, "HTTP_ERROR"
    )
    return _error(exc.status_code, code, str(exc.detail))


@app.exception_handler(Exception)
async def on_unhandled_error(request: Request, exc: Exception):
    """兜底 500 → JSON，并记录堆栈便于排查。"""
    log.exception("[ai] 未处理异常 path=%s", request.url.path)
    return _error(500, "INTERNAL", f"AI 服务内部错误：{type(exc).__name__}: {exc}")


def _summarize_validation(exc: RequestValidationError) -> str:
    """把 pydantic 校验错误压成一行中文可读信息。"""
    parts = []
    for err in exc.errors()[:5]:
        loc = ".".join(str(x) for x in err.get("loc", ()) if x != "body") or "body"
        parts.append(f"{loc}: {err.get('msg')}")
    return "；".join(parts) or "参数不合法"


@app.get("/health")
async def health():
    """探活（Java ``AiServiceClient.healthy()`` 也走这里）。"""
    return {
        "ok": True,
        "service": SERVICE_NAME,
        "version": SERVICE_VERSION,
        "endpoints": ENDPOINTS,
    }


@app.post("/ai/product-detail", response_model=AiDetail, response_model_exclude_none=True)
async def product_detail(req: ProductDetailRequest) -> AiDetail:
    """商品详情页文案生成（对应 aiProduct.buildAiDetail）。"""
    return build_ai_detail(req)


@app.post("/ai/custom/chat", response_model=ChatResponse)
async def custom_chat_route(req: ChatRequest) -> ChatResponse:
    """定制 AI 对话（对应 custom.customChat）。"""
    return custom_chat(req)


@app.post("/ai/custom/variant", response_model=VariantResponse)
async def custom_variant_route(req: VariantRequest) -> VariantResponse:
    """款式变体生成（对应 custom.genVariantSvg）。"""
    return gen_variant_svg(req)


if __name__ == "__main__":  # 允许 ``python app/main.py`` 直接起服务
    import uvicorn

    uvicorn.run(
        app,
        host=os.environ.get("DW_AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("DW_AI_PORT", "8789")),
    )
