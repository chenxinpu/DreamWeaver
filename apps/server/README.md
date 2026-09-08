# 织梦 DreamWeaver v2 后端（apps/server）

Node 22 + Express + TypeScript 全栈后端。内存库 + `data/db.json` 原子写盘（变更 debounce 300ms）。
启动时无 db 自动跑演示 seed；提供 `POST /api/dev/reset` 重置。

## 运行

```bash
npm install
npm run dev      # tsx watch，端口 8787
npm run build    # tsc → dist/
npm start        # node dist/index.js
```

健康检查：`GET http://localhost:8787/api/health`

## 演示账号

| id | 昵称 | 角色 | 说明 |
|---|---|---|---|
| 1 | 小织 | creator | 演示主创作者（素材/作品/池/橱窗/商品/看板） |
| 2 | 鹿屿Lu | creator | 大衣创作者 |
| 3 | 云端裁缝铺 | creator | 泡泡纱衬衫创作者 |
| 4-13,15-18 | 达人/消费者 | creator/consumer | 参与 P60 分布/订单买家 |
| 14 | 我的小号 | consumer | 默认消费者身份，预置体型（可演示定制退货） |
| 99 | 平台审核专员 | auditor | 橱窗 force 审核 / dev reset |

登录：`POST /api/auth/login {"userId":1}` → `{token,user}`；后续请求带 `Authorization: Bearer <token>`。
除 `/api/health`、`/api/auth/login|switch` 外全部需要登录。

## 自检

```bash
cd apps/server && node ../official 无；参考 tools/ 下前端 dev
python3 /tmp/v2test.py   # 36 项全流程 API 自检（先自行登录导 token）
```

## 示例文件

seed 自动生成到 `apps/server/samples/`：dress-front-pattern.dxf（bulge 圆弧前片）、
shirt-front.dxf、dress.obj（参数化网格 102 顶点/190 面）、floral-print.svg。
可用 `GET /api/materials/import-help` 获取说明，`GET /api/materials/sample-content?file=…` 拉取原文做导入演示。

## 已知偏差（相对 ITER_V2_SPEC）

- 佣金「收货 T+7 结算」按真实时钟判定；演示结算可在 `GET /creator/commission` 时惰性触发（幂等写流水）。
- 被拒橱窗材料 seed 中保留 `status:'rejected'` 便于界面展示历史，创作者 PATCH 后重提即回 draft。
- 审核中的橱窗 seed 状态为 `submitted`（模拟提交后待系统 24h 内自动审核）；每日 00:05 调度或审核员
  `POST /api/admin/window/:id/force` 会将其转 approved → 自动上架。
- 点赞数为“放大演示值”，likedBy 仅记录实际互动用户（保持 demo 观感与真实交互一致）。
