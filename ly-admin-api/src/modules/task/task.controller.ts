/**
 * 定时任务控制器。
 * 模块职责：对外暴露定时任务的查询与手动触发能力。
 *
 * 权限码（需在菜单里授权给相应角色）：
 * - `system:task:list` 查看任务列表与执行记录
 * - `system:task:run` 手动触发任务
 */
import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';
import { OperationLog } from '../../common/log/operation-log.decorator.js';
import { RequirePermissions } from '../../common/auth/permission.guard.js';
import { CurrentUser } from '../../common/auth/auth.guard.js';
import { type AuthUserContext } from '../../common/types.js';
import { TaskRunStatus, TaskTrigger } from '../../common/config/constants.js';
import { TaskService, type TaskItem, type TaskLogItem, type TaskRunResult } from './task.service.js';

/** 任务标识路径参数（英文 kebab-case，与注册表中的 name 一致）。 */
export class TaskNameParamDto {
  @IsString({ message: '任务标识非法' })
  @Matches(/^[a-z][a-z0-9-]*$/, { message: '任务标识非法' })
  name!: string;
}

@Controller('tasks')
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  /** 定时任务列表（含调度状态与上次执行摘要）。 */
  @Get()
  @RequirePermissions('system:task:list')
  list(): Promise<TaskItem[]> {
    return this.taskService.listTasks();
  }

  /**
   * 某任务的执行记录（分页）。
   *
   * 查询参数用 `Record<string, unknown>` 而非 DTO：全局 ValidationPipe 开了 whitelist，
   * DTO 里未声明的字段（page / pageSize）会被剥掉，导致分页参数丢失。
   * 故与日志模块保持一致，筛选条件的解析放在 service 层。
   */
  @Get(':name/logs')
  @RequirePermissions('system:task:list')
  listLogs(
    @Param() params: TaskNameParamDto,
    @Query() query: Record<string, unknown>,
  ): Promise<{ list: TaskLogItem[]; total: number; page: number; pageSize: number }> {
    return this.taskService.listTaskLogs(params.name, query);
  }

  /** 手动触发任务（同步等待执行结果）。 */
  @Post(':name/run')
  @RequirePermissions('system:task:run')
  @OperationLog('定时任务', '手动执行')
  async run(
    @Param() params: TaskNameParamDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<{ __raw: true; data: TaskRunResult; message: string }> {
    const result = await this.taskService.runTask(params.name, TaskTrigger.MANUAL, user.username);
    const message = result.status === TaskRunStatus.SUCCESS ? '任务执行成功' : '任务执行失败';
    return { __raw: true, data: result, message };
  }
}
