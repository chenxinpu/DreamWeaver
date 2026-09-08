/** 路由总装配：每个路由文件内已使用完整 /xxx 路径，直接顺序挂载到 /api 前缀下 */
import { Router } from 'express';
import { authRouter } from './auth';
import { usersRouter } from './users';
import { materialsRouter } from './materials';
import { worksRouter } from './works';
import { feedRouter } from './feed';
import { poolRouter } from './pool';
import { windowRouter } from './window';
import { productsRouter } from './products';
import { customRouter } from './custom';
import { ordersRouter } from './orders';
import { resaleRouter } from './resale';
import { notificationsRouter } from './notifications';
import { creatorRouter } from './creator';
import { adminRouter } from './admin';

export function buildApiRouter(): Router {
  const api = Router();
  api.use(authRouter);            // /auth/login /auth/switch /me
  api.use(usersRouter);           // /users/:id
  api.use(materialsRouter);       // /materials*
  api.use(worksRouter);           // /works*
  api.use(feedRouter);            // /posts* /feed*
  api.use(poolRouter);            // /creator/pool /dev/eval-pool /pool/meta
  api.use(windowRouter);          // /creator/window*
  api.use(productsRouter);        // /mall/products /products/:id /creator/products*
  api.use(customRouter);          // /custom/*
  api.use(ordersRouter);          // /orders*
  api.use(resaleRouter);          // /mall/resale /resale/*
  api.use(notificationsRouter);   // /notifications*
  api.use(creatorRouter);         // /creator/overview dashboard commission bi
  api.use(adminRouter);           // /admin/* /dev/*
  return api;
}
