import type { Request, Response, NextFunction } from 'express';

/** 统一响应：{ok:true,data} / {ok:false,code,msg} */
export const ok = (data: unknown) => ({ ok: true as const, data });

export const fail = (code: string, msg: string) => ({ ok: false as const, code, msg });

/** 业务异常：throw 后由全局错误中间件转换为 JSON */
export class HttpError extends Error {
  code: string;
  status: number;
  constructor(code: string, msg: string, status = 200) {
    super(msg);
    this.code = code;
    this.status = status;
  }
}

export const bad = (code: string, msg: string): never => { throw new HttpError(code, msg, 400); };
export const deny = (msg = '无权限操作'): never => { throw new HttpError('FORBIDDEN', msg, 403); };
export const notFound = (msg = '资源不存在'): never => { throw new HttpError('NOT_FOUND', msg, 404); };

/** async 路由包装：异常交给错误中间件 */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/** 全局错误中间件 */
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, code: err.code, msg: err.message });
    return;
  }
  const e = err as Error;
  // JSON 过大/解析错误等
  if ((e as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ ok: false, code: 'PAYLOAD_TOO_LARGE', msg: '上传内容过大，图片请控制在 3MB 以内' });
    return;
  }
  res.status(500).json({ ok: false, code: 'INTERNAL', msg: `服务异常：${e?.message || '未知错误'}` });
}
