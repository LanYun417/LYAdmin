/**
 * 静态资源 URL 透传。
 *
 * 历史：后端 `/static` 曾启用鉴权（仅登录用户可访问），而浏览器渲染 `<img>` /
 * `<el-avatar>` / `<el-image>` 时无法自动带 `Authorization` 头，故前端在此把
 * accessToken 拼成 `?token=` 查询参数，由静态鉴权中间件校验。
 *
 * 现 `/static` 已改为「仅 Referer 防盗链 + 图片按需缩放、免登录」，
 * 不再需要携带令牌，故此处直接原样返回资源 URL（`?scale=` 等参数由调用方/服务端自然透传）。
 * 保留函数名与所有调用点不变，仅去掉令牌拼接。
 */
export function withUploadToken(url?: string | null): string {
  return url ?? '';
}
