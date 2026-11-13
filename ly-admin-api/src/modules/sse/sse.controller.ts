/**
 * SSE 实时推送控制器。
 *
 * 为什么不用 Nest 的 @Sse 装饰器：它要求 handler 返回 Observable<MessageEvent>，
 * 由框架托管流的生命周期；而本模块需要按 userId 分组管理连接、维护主题订阅与心跳，
 * 「控制器持有 res 直写」比把响应抛进 Observable 更可控。EventSource 只认标准
 * SSE 响应（`Content-Type: text/event-stream` + 分帧），手写同样满足标准。
 *
 * 鉴权：EventSource **无法携带 Authorization 头**，token 走 query（与静态资源
 * URL 同思路——authenticateRequest 的 extractToken 已支持 query.token）。
 */
import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsBoolean, IsIn } from 'class-validator';
import { Public } from '../../common/auth/auth.guard.js';
import { RawResponse } from '../../common/http/response.interceptor.js';
import { AuthGuard } from '../../common/auth/auth.guard.js';
import { JwtService } from '../../common/auth/jwt.service.js';
import { TokenBlacklistService } from '../../common/auth/token-blacklist.service.js';
import { AuthUserService } from '../../common/auth/auth-user.service.js';
import { SessionService } from '../../common/auth/session.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { authenticateRequest } from '../../common/auth/auth.guard.js';
import { SseService } from './sse.service.js';

/** 主题订阅开关入参。 */
export class SseTopicDto {
  @IsIn(['metrics'], { message: '仅支持订阅 metrics 主题' })
  topic!: 'metrics';

  @IsBoolean({ message: 'enabled 必须为布尔值' })
  enabled!: boolean;
}

@Controller('sse')
export class SseController {
  constructor(
    private readonly sseService: SseService,
    private readonly jwtService: JwtService,
    private readonly blacklist: TokenBlacklistService,
    private readonly authUserService: AuthUserService,
    private readonly sessionService: SessionService,
    private readonly redis: RedisService,
  ) {}

  /**
   * SSE 连接入口：`GET /sse/stream?token=<accessToken>`。
   * 前端 `new EventSource(url)` 即可；断线由浏览器自动重连（onerror 里兜底退避）。
   */
  @Public()
  @RawResponse()
  @Get('stream')
  async stream(@Req() req: Request, @Res() res: Response): Promise<void> {
    // 手动鉴权：EventSource 带不了 Authorization 头，token 在 query 里
    const { user } = await authenticateRequest(
      req,
      this.jwtService,
      this.blacklist,
      this.authUserService,
      this.sessionService,
      this.redis,
    );

    // 标准 SSE 响应头：不做缓冲、不压缩（压缩会缓冲打破实时性）
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // 关掉 Nginx/Apache 反代的响应缓冲（未配 X-Accel-Buffering 头的场景）
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.sseService.subscribe(Number(user.userId), res);
    // 不结束响应：连接生命周期由 SseService 的 close 监听管理
  }

  /** 订阅 / 退订主题（当前仅 metrics；前端监控页挂载/卸载时调用）。 */
  @UseGuards(AuthGuard)
  @Post('topics')
  setTopic(@Body() dto: SseTopicDto, @Req() req: { user?: { userId: number } }): { topic: string; enabled: boolean } {
    this.sseService.setTopic(Number(req.user?.userId ?? 0), dto.topic, dto.enabled);
    return { topic: dto.topic, enabled: dto.enabled };
  }

  /** 当前在线连接数（健康检查用：前端可对比判断 SSE 是否已断）。 */
  @UseGuards(AuthGuard)
  @Get('online-count')
  onlineCount(): { onlineUsers: number } {
    return { onlineUsers: this.sseService.onlineUserCount() };
  }
}
