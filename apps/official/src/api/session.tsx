/* ============================================================================
 * 织梦 · 用户会话（useMe）—— 登录态 / /api/me 刷新 / 未读通知数 / 登出切换
 * MeProvider 需要挂在路由之上；各页面用 useMe() 获取会话。
 * ==========================================================================*/
import React from 'react';
import { api, getToken, setToken, ApiError } from './client';
import type { User } from './types';

interface SessionState {
  user: User | null;
  loading: boolean;
  /** 未读通知数（/api/me 聚合，读取后可本地刷新） */
  unread: number;
  login: (userId: number) => Promise<User>;
  logout: () => void;
  /** 重新拉取 /api/me */
  refresh: () => Promise<User | null>;
  setUnread: (n: number) => void;
  /** 是否已有本地 token（用于决定是否强制引导到登录页） */
  hasToken: boolean;
}

const SessionContext = React.createContext<SessionState>({
  user: null, loading: true, unread: 0,
  login: async () => { throw new Error('no provider'); },
  logout: () => {},
  refresh: async () => null,
  setUnread: () => {},
  hasToken: false,
});

export function MeProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState<boolean>(() => !!getToken());

  const refresh = React.useCallback(async (): Promise<User | null> => {
    if (!getToken()) { setUser(null); setLoading(false); return null; }
    try {
      const payload = await api.me();
      // 容错：后端可能直接返回 user，也可能返回 {user, unread,...}
      const u: User = (payload as { user?: User }).user || (payload as unknown as User);
      setUser(u);
      const n = (payload as { unread?: number }).unread;
      if (typeof n === 'number') setUnread(n);
      setLoading(false);
      return u;
    } catch (e) {
      const code = (e as ApiError).code;
      const msg = (e as ApiError).message || '';
      if (code === '401' || /未登录|登录已过期|token|凭证/i.test(msg)) {
        setToken(null);
        setUser(null);
      }
      setLoading(false);
      return null;
    }
  }, []);

  const login = React.useCallback(async (userId: number): Promise<User> => {
    const res = await api.auth.login(userId);
    setToken(res.token);
    setUser(res.user);
    setLoading(false);
    return res.user;
  }, []);

  const logout = React.useCallback(() => {
    setToken(null);
    setUser(null);
    setUnread(0);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (getToken()) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = React.useMemo<SessionState>(() => ({
    user, loading, unread, login, logout, refresh, setUnread, hasToken: !!getToken(),
  }), [user, loading, unread, login, logout, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useMe(): SessionState {
  return React.useContext(SessionContext);
}

/** 未读角标 >99 → 99+ */
export const unreadText = (n: number) => (n > 99 ? '99+' : n > 0 ? String(n) : '');
