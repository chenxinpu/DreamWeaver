# apps/ai —— 织梦 DreamWeaver Python AI 服务

**定位**：架构里的 **AI 生成能力服务**。按架构红线，所有「AI 生成类」逻辑只能由 Python 实现，
Java 后端（`apps/backend`）不内联任何生成逻辑，只通过 `dreamweaver.ai.AiServiceClient` 调用本服务。

| 角色 | 技术 | 职责 |
| --- | --- | --- |
| Node `apps/gateway` | BFF/网关/实时 | 聚合、鉴权透传、WebSocket |
| Java `apps/backend` | 全部业务 | 领域规则、落库、审核/下单流程、REST/BFF/WebSocket；通过 `dreamweaver.ai.AiServiceClient` 调本服务 |
| **Python `apps/ai`（本服务）** | FastAPI | 详情页文案生成、AI 定制对话、款式变体出图 |

## 1. 与原实现的对应关系（原 TS 是唯一事实来源）

| 原 Node 实现 | 本服务 | 说明 |
| --- | --- | --- |
| 原 Node 实现 `apps/server/src/engine/（该目录已在架构重构中移除，路径仅作溯源）aiProduct.ts` · `buildAiDetail` | `app/product_detail.py` | `CAT_CN`、`fabricSentence` 六个面料分支、story ①~⑥、四个 sections、`baseFeeNote`、`defaultManufacturer`、`defaultProdDays`（外套/套装 12、裤装 8、其他 9）、`prodDays ?? default` |
| 原 Node 实现 `apps/server/src/engine/（该目录已在架构重构中移除，路径仅作溯源）custom.ts` · `customChat` | `app/custom_chat.py` | `INSTRUCTION`、`matchAny`、袖/领/长/腰/面料/印花 六个分支 + 兜底 |
| 原 Node 实现 `apps/server/src/engine/（该目录已在架构重构中移除，路径仅作溯源）custom.ts` · `genVariantSvg` | `app/variant.py` | `STYLE_HEX`、`silhouette` path、`labels` 定位、各 `optionKey` 前缀分支、`applied`、svg 拼接 |
| 原 Node 实现 `apps/server/src/utils/（同上）misc.ts` · `svgDataUrl` / `r2` | `app/textutil.py` | 百分号编码、`Math.round` 语义、JS 数值渲染 |
| `apps/backend/.../ai/AiDtos.java`、`model/AiDetail.java` | `app/schemas.py` | 请求/响应契约（字段名 = camelCase，与 Java 逐字段一致） |

Java 侧 `AiServiceClient.buildProductDetail` 已承担「素材 id → 文件名」「创作者昵称」「照片数量」等查表，
因此请求体直接把 `patternFiles` / `modelFiles` / `creatorNickname` / `photosCount` 传进来，
Python 只做纯文案生成（对应 `buildAiDetail` 的非查表部分）。

## 2. 目录结构

```
apps/ai/
├── README.md
├── requirements.txt              # fastapi / uvicorn[standard] / pydantic（无 numpy、无 torch）
├── run.sh                        # 创建/复用 .venv 并监听 127.0.0.1:8789
├── .gitignore
└── app/
    ├── __init__.py
    ├── main.py                   # FastAPI 应用 + 路由 + 令牌校验 + 统一异常
    ├── schemas.py                # Pydantic 模型（对应 AiDtos.java / AiDetail.java）
    ├── product_detail.py         # 对应 aiProduct.ts
    ├── custom_chat.py            # 对应 custom.ts 的 customChat
    ├── variant.py                # 对应 custom.ts 的 genVariantSvg
    ├── textutil.py               # svg_data_url / encode_uri_component / r2 / JS 数值语义
    ├── selftest.py               # 与原 TS 的逐字符等价自检（不需要 pytest）
    └── reference_fixtures.json   # 参照物：由原 TS 实现直接执行生成（见 §6）
```

## 3. 接口契约

服务监听 `127.0.0.1:8789`，请求/响应均为 JSON（UTF-8）。
请求头：`Content-Type: application/json;charset=UTF-8`、`X-Internal-Token: dw-internal-dev-token`（与 Java 一致）。

| 方法 | 路径 | 入参 | 出参 |
| --- | --- | --- | --- |
| GET | `/health` | — | `{ok, service, version, endpoints}` |
| POST | `/ai/product-detail` | `ProductDetailRequest` | `AiDetail` |
| POST | `/ai/custom/chat` | `ChatRequest` | `ChatResponse` |
| POST | `/ai/custom/variant` | `VariantRequest` | `VariantResponse` |

> 三个 AI 接口**直接返回领域对象本身**（没有 `{ok,data}` 信封），因为 Java 侧是
> `json.readValue(res.body(), AiDetail.class)` 直接反序列化。

### 3.1 `POST /ai/product-detail`

```json
{
  "title": "法式碎花连衣裙", "category": "连衣裙", "productName": "法式碎花连衣裙",
  "styleTags": ["法式", "甜美", "碎花"], "photosCount": 3, "creatorNickname": "林小满",
  "partsFabric": [{"part": "前片", "fabric": "真丝", "note": "19姆米"}],
  "sizeChart": [{"size": "S", "bust": 84, "waist": 66, "hip": 90, "shoulder": 38, "sleeve": 20, "length": 100}],
  "specLabel": "标准版型", "patternFiles": ["front.dxf"], "modelFiles": ["jacket.zprj"], "prodDays": null
}
```

响应 `AiDetail`（**`partsFabric` 是字符串数组**，与请求里的对象数组同名不同型）：

```json
{
  "intro": "把「法式·甜美·碎花」穿在身上：法式碎花连衣裙，来自林小满的原创连衣裙。版型在虚拟试衣中反复校正，上身不挑比例；3 组真人实拍场景照，所见即所得。",
  "story": "【从设计到生产】\n① 设计：灵感与款式稿在 CLO 3D 中完成结构推敲，风格标签「法式·甜美·碎花」。\n② …",
  "sections": [{"icon": "fabric", "title": "部件与面料", "body": "…"}, {"icon": "craft", "…": "…"}, {"icon": "size", "…": "…"}, {"icon": "factory", "…": "…"}],
  "sizeChart": [{"size": "S", "bust": 84.0, "waist": 66.0, "hip": 90.0, "shoulder": 38.0, "sleeve": 20.0, "length": 100.0}],
  "partsFabric": ["· 前片：真丝（19姆米）——真丝自带柔和光泽与良好垂坠，贴身亲肤透气，抗静电不闷汗；建议轻柔手洗、阴干。"],
  "manufacturer": "织梦柔性智造工厂 · 华东1号",
  "prodDays": 9,
  "baseFeeNote": "基础费用（定制专用，下单即付）说明：用于私人定制产生的加工与试错成本——① 个性化工时与改版 ② 材料（版片损耗/试样面料） ③ 人工（量体对版/车缝） ④ 质检与定制包装。定制商品支持「退货退原价、基础费用不退」，退货自动进入二手集市，规则见购物条款。"
}
```

要点（逐字符对齐原实现）：
* `category` 先过 `CAT_CN`，未命中则原样使用，空则 `成衣`；
* `intro` 用 `styleTags` 前 3 个 `join('·')`、`creatorNickname`、`photosCount>0` 两个分支；
* `story` 的 `designTool` = 有 `modelFiles` 时（首个文件名含 `.zprj` → `CLO 3D`，否则 `CLO/建模软件`），无则 `设计软件`；`patternTool` = 有版片文件 `DXF(R12)` 否则 `DXF`；②/③ 的条件片段（`版片文件：…；`、`… 与 `）与空数组分支一致；
* 工艺段落按**原始** `category === '外套'` 取 `平缝+包边`，否则 `锁边+平缝`；
* `prodDays` = 请求值（`0` 也生效，等价 TS 的 `??`）否则按品类默认（外套/套装 12、裤装 8、其他 9）。

### 3.2 `POST /ai/custom/chat`

```json
{"product": {"id": 1, "title": "法式碎花连衣裙", "price": 299, "baseFee": 79, "category": "连衣裙", "styleTags": ["法式"]},
 "history": [{"role": "user", "content": "袖子想改泡泡袖"}]}
```

响应：

```json
{"reply": "关于「法式碎花连衣裙」的袖型：我可以帮你调整为更适合体型的袖型。若肩偏窄选泡泡袖/灯笼袖增加轮廓；若要利落干练选直筒袖。选择下方方案我会立即生成预览图。",
 "options": [{"key": "sleeve-puff", "title": "改泡泡袖", "desc": "袖山抽褶，甜美复古，适合肩部较窄"},
             {"key": "sleeve-straight", "title": "改直筒袖", "desc": "利落通勤，简洁不挑场合"},
             {"key": "sleeve-lantern", "title": "改灯笼袖", "desc": "上窄下宽，藏肉显仙气"}]}
```

* 「最近一条 `role == "user"` 的 content」作为输入（无 user 消息时按空串走兜底）；
* 分支判定顺序固定：袖 → 领 → 长 → 腰 → 面料 → 印花 → 兜底；
* 领口分支按 `styleTags` 是否含「法式」切换文案。

### 3.3 `POST /ai/custom/variant`

```json
{"product": {"id": 1, "title": "法式碎花连衣裙", "price": 299, "baseFee": 79, "category": "连衣裙", "styleTags": ["法式"]},
 "optionKey": "sleeve-puff"}
```

响应：

```json
{"image": "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22…",
 "title": "袖型 → 泡泡袖",
 "desc": "袖型 → 泡泡袖已生成参变化预览（非最终成衣图）。确认后将在定制订单中应用，材料类变更（面料/印花/换版）将同步触发橱窗重新审核。",
 "applied": ["袖型 → 泡泡袖"]}
```

* `image` = `data:image/svg+xml;charset=utf-8,` + **JS `encodeURIComponent` 语义**的百分号编码：
  未保留字符集为 `A-Za-z0-9-_.!~*'()`，其余（含 `/`）一律 `%XX`（**大写十六进制**），非 ASCII 走 UTF-8 逐字节。
  实现见 `textutil.encode_uri_component`（Python `quote` 的默认 `safe='/'` 与 JS 不同，这里显式传入 `safe="-_.!~*'()"`）；
* 主色取 `styleTags` 中第一个命中 `STYLE_HEX` 的标签，否则 `#D44771`；未知 `optionKey` 前缀 → `applied = ["样式微调"]`。

### 3.4 错误与令牌

* 统一错误体 `{"ok": false, "code": "...", "msg": "..."}`，**永不返回 HTML**：
  401 `UNAUTHORIZED`（令牌不匹配）、404 `NOT_FOUND`、405 `METHOD_NOT_ALLOWED`、
  422 `BAD_REQUEST`（请求体/JSON 校验失败）、500 `INTERNAL`。
* `X-Internal-Token`：**头缺失时放行**（便于 curl / `healthy()` 探活），**头存在且不匹配时 401**。
  期望值取环境变量 `DW_INTERNAL_TOKEN`，默认 `dw-internal-dev-token`（与 Java `dw.internal-token` 默认值一致）。

## 4. 运行

```bash
cd apps/ai
./run.sh                      # 创建/复用 .venv 并启动 http://127.0.0.1:8789
```

等价的手动方式：

```bash
cd apps/ai
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8789
```

环境变量：`DW_AI_HOST`（默认 `127.0.0.1`）、`DW_AI_PORT`（默认 `8789`）、`DW_INTERNAL_TOKEN`、`PYTHON`。

> 本机到 `pypi.org` 直连很慢/易超时（实测多次 `incomplete-download`），
> 若安装失败可用镜像：`PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/ .venv/bin/pip install -r requirements.txt`
> （pip 自动读取 `PIP_INDEX_URL`，`run.sh` 无需改动）。
> 实测可用版本：Python 3.13.5 + fastapi 0.141.1 / pydantic 2.13.5 / uvicorn 0.52.4 / starlette 1.6.0。

Java 侧配置（`apps/backend/src/main/resources/application.yml`）：

```yaml
dw:
  ai-base-url: ${DW_AI_BASE_URL:http://127.0.0.1:8789}
  internal-token: ${DW_INTERNAL_TOKEN:dw-internal-dev-token}
```

## 5. 自测

### 5.1 与原实现逐字符等价的回归自检（推荐先跑这个）

```bash
cd apps/ai && .venv/bin/python -m app.selftest
```

输出（实测）：

```
[selftest] 参照物：原 Node 实现的 engine/aiProduct.ts + engine/custom.ts（经 esbuild 转译后由 Node 直接执行，输出即参考基准）
[selftest] 用例数：detail=5 chat=45 variant=59 encode=7
[selftest] 断言 382 条，失败 0 条
[selftest] 结果：OK —— 与原 Node/TS 实现逐字符一致
```

其中包含硬编码断言（`app/selftest.py::check_encoding_hardcoded`，与 JS `encodeURIComponent` 实测输出一致）：

```
svg_data_url('<svg>') == 'data:image/svg+xml;charset=utf-8,%3Csvg%3E'   ✅
encodeURIComponent('/')  == '%2F'      encodeURIComponent("'") == "'"     ✅
encodeURIComponent('中') == '%E4%B8%AD'                                    ✅
encodeURIComponent('abcXYZ019-_.!~*\'()') == 原样                          ✅
```

`variant` 用例对 `image` 做 **sha256 比对**（14 个代表用例额外保留整段 `image` 做整串比对），
因此 svg 拼接与百分号编码都是逐字节校验的。

### 5.2 接口冒烟

```bash
curl -s http://127.0.0.1:8789/health
curl -s -X POST http://127.0.0.1:8789/ai/product-detail -H 'Content-Type: application/json' -d '{…}'
curl -s -X POST http://127.0.0.1:8789/ai/custom/chat    -H 'Content-Type: application/json' -d '{…}'
curl -s -X POST http://127.0.0.1:8789/ai/custom/variant -H 'Content-Type: application/json' -d '{…}'
```

## 6. `reference_fixtures.json` 是怎么来的

参考基准不是手写的，而是**直接执行原 TS 实现**得到的（脚本只在 `/tmp` 临时存在，未入库）：

1. 用 `apps/server/node_modules/.bin/esbuild` 把 `aiProduct.ts` / `custom.ts` / `utils/misc.ts`
   转成 CJS（`--platform=node --target=node20`），`import { db } from '../db/store'` 用只含
   `materials` / `users` 内存桩的 `store.js` 顶替（因此不需要启动原 Node 服务、不触碰原工程文件）；
2. 用 Java `AiServiceClient.buildProductDetail` 的等价逻辑组装出扁平化请求体（素材 id → 文件名等查表），
   保证「请求体 + Python 输出」与「原 TS 入参 + 原 TS 输出」配对；
3. `buildAiDetail` / `customChat` / `genVariantSvg` / `r2` / `encodeURIComponent` 的返回值原样落盘为 fixtures。

覆盖：面料 6 个分支 + 兜底、`CAT_CN` 命中/未命中、`prodDays` 缺省/`0`/显式、`photosCount` 0 与非 0、
空/非空 `patternFiles`/`modelFiles`（含 `.zprj` 判定）、空 `styleTags`、空 `sizeChart`、
空历史/末条非 user/无「法式」标签、26 个 `optionKey`（含非法 key 与空 key）、特殊字符标题
（引号、`&`、`%`、中文）的百分号编码。

## 7. 已知差异与遗留风险

1. **`None` → `''`（而非 JS 的 `'undefined'`）**：TS 域内这些字段都是必填 `string`，不会出现 `undefined`；
   Java 用 `@JsonInclude(NON_NULL)` 省略 null。`textutil.js_str` 把 `None` 渲染成空串以避免
   「来自undefined的原创」这类脏文案。若 Java 侧真的传来 null（数据损坏），输出会与旧 Node 实现不同（更干净）。
2. **`sizeChart` 回显的数值形态**：请求里的 `84` 经 pydantic 变 `float`，响应 JSON 为 `84.0`（Java `Double` 正常接收）。
   旧 Node 输出 `84`。数值等价，若前端做**字符串**比对需注意。
3. **极小/极大数的 JS 数值写法**：`js_number_to_string` 已把 `1e-07` 规范成 `1e-7`，但 `≥1e21` 或
   超长有效位场景与 JS `Number#toString` 仍可能有理论差异（本服务的价格/尺码场景不涉及）。
4. **孤立代理项**：JS `encodeURIComponent` 对 lone surrogate 抛 `URIError`；这里退化为 `surrogatepass`
   逐字节编码，不抛异常（避免 500）。正常 UTF-8 输入无差异。
5. **无真实 LLM**：完全沿用原实现的**规则模板**（`INSTRUCTION` 已原样保留在 `app/custom_chat.py`，
   便于后续替换为真实模型），生成的详情页文案/对话/预览图为确定性结果，不含真实 AIGC 推理。
6. **无并发/限流保护**：服务为纯 CPU 轻量字符串处理，未加限流；若后续接入真实模型需补超时与并发控制。
7. **契约手写同步**：`schemas.py` 与 `AiDtos.java` 是人手对齐的，Java 侧改字段时需同步此文件
   （`extra="ignore"` 只保证新增字段不会打挂服务，不保证语义正确）。
8. **`reference_fixtures.json` 不会自动再生**：它依赖原 `apps/server` 的 TS 源码与 esbuild；
   若将来 Node 服务目录被删除，请在删除前重新生成一次 fixtures。
