/**
 * 操作日志中间件。
 * 模块职责：拦截写操作（POST/PUT/PATCH/DELETE），记录模块/动作/参数（脱敏）/耗时/结果，
 * 在响应结束后异步落库至 `sys_operation_log`。
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { SENSITIVE_KEYS } from '@/constants';
import { createOperationLog } from '@/services/log.service';
import { getClientIp } from '@/utils/logger';

/** 解析得到的模块与动作。 */
interface OperationDescriptor {
  module: string;
  action: string;
}

/**
 * 路由规则：正则 + 模块/动作。
 * 导出供「留痕覆盖率守卫」（`docs/auditCoverage.ts`）复用，避免规则表与守卫各存一份产生漂移。
 */
export const OPERATION_RULES: Array<{ pattern: RegExp; module: string; action: string }> = [
  { pattern: /^\/api\/users\/\d+\/status$/, module: '用户管理', action: '启用禁用' },
  { pattern: /^\/api\/users\/\d+\/password$/, module: '用户管理', action: '重置密码' },
  { pattern: /^\/api\/users\/\d+\/roles$/, module: '用户管理', action: '分配角色' },
  { pattern: /^\/api\/users\/\d+$/, module: '用户管理', action: '' },
  { pattern: /^\/api\/users$/, module: '用户管理', action: '新增' },

  { pattern: /^\/api\/roles\/\d+\/menus$/, module: '角色管理', action: '授权菜单' },
  { pattern: /^\/api\/roles\/\d+$/, module: '角色管理', action: '' },
  { pattern: /^\/api\/roles$/, module: '角色管理', action: '新增' },

  { pattern: /^\/api\/menus\/\d+$/, module: '菜单管理', action: '' },
  { pattern: /^\/api\/menus$/, module: '菜单管理', action: '新增' },

  { pattern: /^\/api\/files\/upload$/, module: '文件管理', action: '上传' },
  { pattern: /^\/api\/files\/\d+$/, module: '文件管理', action: '删除' },

  { pattern: /^\/api\/profile\/password$/, module: '个人中心', action: '修改密码' },
  { pattern: /^\/api\/profile\/avatar$/, module: '个人中心', action: '更换头像' },
  { pattern: /^\/api\/profile$/, module: '个人中心', action: '修改资料' },

  // 高危破坏性操作：清空全量 HTTP 日志必须留痕（此前零留痕，属「操作可追溯」目标缺口）
  { pattern: /^\/api\/logs\/http$/, module: '日志管理', action: '清空' },
  // 代码生成三动作：会写源码目录 / 导出 / 预览，均须留痕
  { pattern: /^\/api\/gen\/create$/, module: '代码生成', action: '生成到项目' },
  { pattern: /^\/api\/gen\/preview$/, module: '代码生成', action: '预览代码' },
  { pattern: /^\/api\/gen\/download$/, module: '代码生成', action: '下载代码' },

  // [GEN-ANCHOR] 代码生成器自动插入位置，请勿删除（gen.writer 会在本行之前插入新模块操作日志规则）
];

/** 不纳入操作日志的路径（认证类单独记登录日志）。导出供留痕覆盖守卫复用，保持排除规则一致。 */
export const EXCLUDED_PREFIXES = ['/api/auth/'];

/**
 * 根据请求方法 + 路径推断模块与动作。
 * @returns 描述对象；无需记录时返回 null
 */
function resolveOperation(req: Request): OperationDescriptor | null {
  const method = req.method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null;
  }
  const path = req.originalUrl.split('?')[0];
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return null;
  }

  const rule = OPERATION_RULES.find((item) => item.pattern.test(path));
  if (!rule) {
    return null;
  }

  let action = rule.action;
  if (!action) {
    action = method === 'DELETE' ? '删除' : method === 'POST' ? '新增' : '编辑';
  }
  return { module: rule.module, action };
}

/** 递归脱敏敏感字段。 */
function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      result[key] = SENSITIVE_KEYS.includes(key) ? '***' : maskSensitive(val);
    });
    return result;
  }
  return value;
}

/**
 * 操作日志中间件工厂。
 * @returns Express 中间件
 */
export function operationLog(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const descriptor = resolveOperation(req);
    if (!descriptor) {
      next();
      return;
    }

    const startAt = Date.now();
    let responseMessage = '';

    // 捕获响应体 message，用于失败原因记录
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      if (body && typeof body === 'object' && 'message' in body) {
        responseMessage = String((body as { message?: unknown }).message ?? '');
      }
      return originalJson(body);
    };

    res.on('finish', () => {
      const duration = Date.now() - startAt;
      const success = res.statusCode < 400;
      const paramsValue = maskSensitive(req.body ?? {});
      const paramsText: string | null = ((): string | null => {
        try {
          return JSON.stringify(paramsValue);
        } catch {
          return null;
        }
      })();

      void createOperationLog({
        userId: req.user?.userId ?? null,
        username: req.user?.username ?? null,
        module: descriptor.module,
        action: descriptor.action,
        method: req.method.toUpperCase(),
        url: req.originalUrl,
        params: paramsText,
        duration,
        result: success ? 1 : 0,
        errorMessage: success ? null : responseMessage || `HTTP ${res.statusCode}`,
        ip: getClientIp(req),
      });
    });

    next();
  };
}
