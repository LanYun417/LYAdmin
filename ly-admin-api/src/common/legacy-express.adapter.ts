/**
 * Express 适配器（对齐原 Express 版的响应语义）。
 *
 * 为什么需要它：原 Express 版的 `ok(res, data, message)` 对所有成功响应一律
 * `res.status(200).json(...)`——**不区分请求方法**，POST 也回 200。而 NestJS 默认会给
 * POST 处理器回 201 Created，与既有契约不一致（前端 request.ts 及外部调用方都按 200 处理）。
 *
 * 实现方式：只重写 `reply`，把状态码固定为 200（`reply` 是 Nest 写入响应的唯一入口）。
 * 三类路径不受影响：
 * - 用 `@Res()` 自行写响应的处理器（CSV 导出、文件下载）→ Nest 判定 isResponseHandled，不调用 reply；
 * - 异常路径 → 走 AllExceptionsFilter，同样不经过 reply；
 * - SSE / `@Redirect` → 走各自的适配器方法（sse / redirect），不经过 reply。
 *
 * 注意：业务错误码仍走响应体 `code` 字段（如 401/403/500），HTTP 状态码仅用于
 * 鉴权与网络层语义，这一点与旧版一致（旧版错误走 `fail(res, code, message, httpStatus)`，
 * 由异常过滤器负责，不在本适配器范围内）。
 */
import { HttpStatus } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { Response } from 'express';

export class LegacyExpressAdapter extends ExpressAdapter {
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
