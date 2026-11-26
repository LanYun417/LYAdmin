/**
 * 通用任务队列控制器：任务查询、入队、重放、手动消费。
 * 管理后台「任务队列」页消费这些接口。
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.guard.js';
import { OperationLog } from '../log/operation-log.decorator.js';
import { IdParamDto } from '../dto/id-param.dto.js';
import { QueueService } from './queue.service.js';
import { EnqueueJobDto, QueueJobQueryDto } from './queue.dto.js';
import type { AuthUserContext } from '../types.js';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  /** 任务分页列表。 */
  @Get('jobs')
  listJobs(@Query() query: QueueJobQueryDto): Promise<unknown> {
    return this.queue.list(query as unknown as Record<string, unknown>);
  }

  /** 入队（幂等键命中时直接返回已有任务，不重复执行）。 */
  @Post('jobs')
  @OperationLog('任务队列', '入队')
  enqueue(@Body() dto: EnqueueJobDto, @CurrentUser() user: AuthUserContext): Promise<unknown> {
    return this.queue.enqueue({
      type: dto.type,
      title: dto.title,
      payload: dto.payload,
      idemKey: dto.idemKey,
      maxAttempts: dto.maxAttempts,
      createdBy: user.userId,
    });
  }

  /** 重放（dead / done → pending 重新执行）。 */
  @Put('jobs/:id/replay')
  @OperationLog('任务队列', '重放')
  replay(@Param() params: IdParamDto, @CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.queue.replay(params.id);
  }

  /** 手动触发一次消费（运维排障用，绕过调度周期）。 */
  @Post('consume')
  @OperationLog('任务队列', '手动消费')
  consume(@CurrentUser() _user: AuthUserContext): Promise<unknown> {
    return this.queue.consumeDue();
  }
}
