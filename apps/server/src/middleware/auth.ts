/** 鉴权：内存 token → userId；Bearer 读取；角色守卫 */
import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../db/store';
import type { Role } from '../types';
import { fail } from '../utils/resp';

export const tokens = new Map<string, number>();

export function issueToken(userId: number): string {
  const t = crypto.randomBytes(16).toString('hex');
  tokens.set(t, userId);
  return t;
}

export function userIdOf(token: string): number | null {
  return tokens.get(token) ?? null;
}

export function bearerToken(req: Request): string | null {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

/** 需要登录的中间件 */
export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const t = bearerToken(req);
  const uid = t ? userIdOf(t) : null;
  if (!uid) {
    res.status(401).json(fail('UNAUTHORIZED', '请先登录（POST /api/auth/login {userId} 获取 token）'));
    return;
  }
  const user = db.users.find((u) => u.id === uid);
  if (!user) {
    res.status(401).json(fail('UNAUTHORIZED', '用户不存在，请重新登录'));
    return;
  }
  (req as Request & { userId: number }).userId = uid;
  next();
}

export function currentUserId(req: Request): number {
  return (req as Request & { userId: number }).userId;
}

/** 角色守卫 */
export function guardRoles(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const uid = currentUserId(req);
    const user = db.users.find((u) => u.id === uid);
    if (!user || !roles.includes(user.role)) {
      next(Object.assign(new Error('当前账号角色无权操作该接口'), { code: 'FORBIDDEN', status: 403 }));
      return;
    }
    next();
  };
}

export const guardCreator = guardRoles('creator', 'auditor', 'admin');
export const guardConsumer = guardRoles('consumer', 'creator', 'auditor', 'admin');
export const guardStaff = guardRoles('auditor', 'admin');
