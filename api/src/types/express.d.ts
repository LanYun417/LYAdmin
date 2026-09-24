/**
 * Express 类型扩展。
 * 模块职责：为 `Request` 注入鉴权上下文与 Token 签发时间，供中间件与控制器使用。
 */
import type { AuthContext } from '@/services/auth.service';
import type { AuthUserContext } from '@/types';

declare global {
  namespace Express {
    interface Request {
      /** 鉴权通过后的当前用户上下文 */
      user?: AuthUserContext;
      /**
       * 鉴权中间件一次性加载的完整上下文（含 `User` 实例与角色关联）。
       * 供控制器（如 `getProfile`/`getUserMenus`）复用，避免重复调用 `loadAuthUser`。
       */
      authContext?: AuthContext;
      /** 当前 accessToken 的签发时间（秒），用于改密失效校验 */
      tokenIat?: number;
    }
  }
}

export {};
