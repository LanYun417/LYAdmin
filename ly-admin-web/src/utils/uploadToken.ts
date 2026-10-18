/**
 * 为同源 `/static` 静态资源附加访问令牌。
 *
 * 后端 `/static` 已启用鉴权（仅登录用户可访问，见后端
 * `src/common/http/static-auth.middleware.ts`，由 `app.module.ts` 的 configure 挂载）。
 * 但浏览器渲染 `<img>` / `<el-avatar>` / `<el-image>` 时
 * **不会**自动附带 `Authorization` 头，因此在此把当前 accessToken 以 `?token=`
 * 查询参数形式拼到资源 URL 上，由后端 `authenticateStatic` 中间件校验。
 *
 * 仅对同源且路径以 `/static` 开头的资源附加；跨域 / 外部 / 非上传资源原样返回，
 * 避免令牌外泄给第三方。无登录态时亦原样返回（由鉴权中间件统一返回 401）。
 */
import { getAccessToken } from '@/utils/auth';

/** 提取 URL 的 pathname（跨域/异常时回退空串）。 */
function toPath(url: string): string {
  if (url.startsWith('/')) {
    return url;
  }
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
}

/**
 * 为静态资源 URL 附加访问令牌（仅同源 `/static`）。
 * @param url 资源地址（可为相对路径或绝对地址）
 * @returns 处理后的地址；无需/无法附加时原样返回
 */
export function withUploadToken(url?: string | null): string {
  if (!url) {
    return '';
  }
  const token = getAccessToken();
  if (!token) {
    return url;
  }
  // 跨域 / 外部资源不附加令牌，避免泄露给第三方
  if (/^https?:\/\//i.test(url)) {
    try {
      if (new URL(url).origin !== window.location.origin) {
        return url;
      }
    } catch {
      return url;
    }
  }
  // 仅对同源 /static 资源附加
  if (!toPath(url).startsWith('/static')) {
    return url;
  }
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}
