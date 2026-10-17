/**
 * 统一成功状态码的 Express 适配器。
 *
 * 为什么需要它：本项目对外契约是**所有成功响应一律 HTTP 200**，业务结果由响应体
 * `{ code, message, data }` 表达。NestJS 默认按请求方法推导成功状态码（POST → 201 Created），
 * 与契约不符——调用方（前端 request.ts、脚本、第三方集成）都按 200 判断成功。
 *
 * 实现方式：只重写 `reply`，把状态码固定为 200（`reply` 是 Nest 写入响应的唯一入口）。
 * 三类路径不受影响：
 * - 用 `@Res()` 自行写响应的处理器（CSV 导出、文件下载）→ Nest 判定 isResponseHandled，不调用 reply；
 * - 异常路径 → 走 AllExceptionsFilter，同样不经过 reply；
 * - SSE / `@Redirect` → 走各自的适配器方法（sse / redirect），不经过 reply。
 *
 * 注意：HTTP 状态码只承担传输层与鉴权语义（401/403/404/500），业务错误码一律看响应体
 * `code` 字段；错误响应由异常过滤器写出，不在本适配器范围内。
 */
import { HttpStatus } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Response } from 'express';

export class OkExpressAdapter extends ExpressAdapter {
  /**
   * 写出响应：恒用 HTTP 200，忽略框架按请求方法推导出的状态码（POST 的 201）。
   * @param response Express 响应对象
   * @param body 已包装好的响应体
   * @param _statusCode 框架推导出的状态码（POST 为 201），此处刻意忽略
   */
  override reply(response: Response, body: unknown, _statusCode?: number): unknown {
    return super.reply(response, body, HttpStatus.OK);
  }
}
