/**
 * 操作日志服务：写入 sys_operation_log。
 * 模块职责：把写操作的模块/动作/参数/耗时/结果落库，失败不阻断业务。
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SENSITIVE_KEYS } from './constants.js';

/** 写入操作日志的入参。 */
export interface OperationLogInput {
  userId: number | null;
  username: string | null;
  module: string;
  action: string;
  method: string;
  url: string;
  params: string | null;
  duration: number;
  result: number;
  errorMessage: string | null;
  ip: string | null;
  location: string | null;
}

/**
 * 递归脱敏：命中敏感键名（password/oldPassword/newPassword/confirmPassword）
 * 的值整体替换为 `***`。大小写敏感、精确匹配。
 */
export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = (SENSITIVE_KEYS as string[]).includes(key) ? '***' : maskSensitive(item);
    }
    return result;
  }
  return value;
}

@Injectable()
export class OperationLogService {
  private readonly logger = new Logger(OperationLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 写入操作日志（吞异常）。
   *
   * 全包 try/catch：日志写失败只 console.error，**绝不影响业务响应**。
   */
  async createOperationLog(input: OperationLogInput): Promise<void> {
    try {
      await this.prisma.operationLog.create({
        data: {
          userId: input.userId === null ? null : BigInt(input.userId),
          username: input.username,
          module: input.module,
          action: input.action,
          method: input.method,
          url: input.url.slice(0, 255),
          params: input.params,
          duration: input.duration,
          result: input.result,
          errorMessage: input.errorMessage ? input.errorMessage.slice(0, 500) : null,
          ip: input.ip ? input.ip.slice(0, 50) : null,
          location: input.location ? input.location.slice(0, 100) : null,
        },
      });
    } catch (error) {
      this.logger.error(`[LogService] 写入操作日志失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 序列化请求体（脱敏 + 循环引用保护）。 */
  static serializeParams(body: unknown): string | null {
    if (body === undefined || body === null) {
      return null;
    }
    try {
      return JSON.stringify(maskSensitive(body));
    } catch {
      // 循环引用等无法序列化的情况：返回 null 而非抛错
      return null;
    }
  }
}
