/**
 * 日志保留清理器（日志治理 ①②③）。
 * 模块职责：
 * - 按「保留天数」配置，对三张日志表（`sys_http_log` / `sys_operation_log` / `sys_login_log`）
 *   执行**分批 DELETE**（每批 1000 条，循环至无匹配），清除早于保留期的过期记录；
 * - 复用项目自研定时调度器（`scheduler.ts`）的 **`setTimeout` 自调度**模式：
 *   启动补跑一次 + 每日固定时刻（默认 00:10，避开 00:05 归档）触发，每次执行后重算延迟防漂移，
 *   **不引入 cron、不新增依赖**；
 * - 记录清理结果日志（分别删了多少行、耗时），失败**不阻塞启动**。
 *
 * 关键约束（安全优先）：
 * - **不使用 TRUNCATE**（会长时间锁表、影响在线请求）；只用带 `LIMIT` 的分批 `DELETE`，
 *   每批之间让出事件循环（`setTimeout` 0~50ms），避免长事务阻塞。
 * - 本模块是「按保留期的自动清理」；`log.service.ts` 的 `clearHttpLogs`（用户手动「清空所有日志」）
 *   是另一回事，其实现保持不动。
 * - 删除前对时间列做一次（非致命）索引探测，若缺失仅打印提示，不阻止清理。
 */
import dayjs from 'dayjs';
import { Op, type WhereOptions } from 'sequelize';
import { config } from '@/config';
import { sequelize } from '@/config/database';
import { HttpLog, LoginLog, OperationLog } from '@/models';
import { clearHttpLogCountCache } from './httpLogStore';

/** 单批删除行数：分批删除可缩短锁持有时间、避免长事务阻塞在线请求。 */
const DELETE_BATCH_SIZE = 1000;

/** 每批之间的让步间隔（毫秒，0~50）：让出事件循环，避免长时间占用连接。 */
const DELETE_YIELD_MS = 20;

/** 支持分批删除的日志模型（结构类型，避免为三张表重复声明签名）。 */
interface BatchDeleteModel {
  destroy(options: { where: WhereOptions; limit: number }): Promise<number>;
}

/** 单个日志表的保留清理目标。 */
interface RetentionTarget {
  /** 物理表名 */
  readonly table: string;
  /** 中文标签（日志输出用） */
  readonly label: string;
  /** Sequelize 时间属性名（用于构造 where 条件） */
  readonly timeAttribute: string;
  /** 数据库时间列名（用于索引探测） */
  readonly timeColumn: string;
  /** 保留天数 */
  readonly retentionDays: number;
  /** 目标模型 */
  readonly model: BatchDeleteModel;
}

/** 三张日志表的保留清理目标（保留天数取自 config，可由 .env 覆盖）。 */
const RETENTION_TARGETS: readonly RetentionTarget[] = [
  {
    table: 'sys_http_log',
    label: 'HTTP 访问日志',
    timeAttribute: 'time',
    timeColumn: 'time',
    retentionDays: config.log.httpLogRetentionDays,
    model: HttpLog,
  },
  {
    table: 'sys_operation_log',
    label: '操作日志',
    timeAttribute: 'createdAt',
    timeColumn: 'created_at',
    retentionDays: config.log.operationLogRetentionDays,
    model: OperationLog,
  },
  {
    table: 'sys_login_log',
    label: '登录日志',
    timeAttribute: 'loginAt',
    timeColumn: 'login_at',
    retentionDays: config.log.loginLogRetentionDays,
    model: LoginLog,
  },
];

/** 单个日志表的清理结果。 */
export interface RetentionResult {
  /** 物理表名 */
  table: string;
  /** 中文标签 */
  label: string;
  /** 保留天数 */
  retentionDays: number;
  /** 本次删除行数 */
  deleted: number;
  /** 实际执行的批次数 */
  batches: number;
  /** 耗时（ms） */
  durationMs: number;
  /** 时间列是否已建索引（true/false；探测失败为 null） */
  indexed: boolean | null;
}

/**
 * 构造「时间列早于 cutoff」的 where 条件。
 * @param timeAttribute Sequelize 时间属性名
 * @param cutoff 截止时间（早于该时间的记录将被清理）
 * @returns where 条件
 */
function buildCutoffWhere(timeAttribute: string, cutoff: Date): WhereOptions {
  const range: Record<string | symbol, Date> = { [Op.lt]: cutoff };
  const where: Record<string, Record<string | symbol, Date>> = { [timeAttribute]: range };
  return where as unknown as WhereOptions;
}

/**
 * 探测某表的时间列是否已建索引（非致命：任何异常返回 null）。
 * @param table 物理表名
 * @param column 列名
 * @returns 有索引 true / 无索引 false / 探测失败 null
 */
async function hasIndexOnColumn(table: string, column: string): Promise<boolean | null> {
  try {
    // 表名为代码内静态常量，无注入风险
    const [rows] = await sequelize.query(`SHOW INDEX FROM \`${table}\``);
    const list = rows as Array<Record<string, unknown>>;
    return list.some((row) => String(row.Column_name ?? row.column_name ?? '') === column);
  } catch {
    return null;
  }
}

/** 让出事件循环指定毫秒（避免长时间占用数据库连接）。 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * 按保留期分批清理三张日志表的过期记录。
 * 每张表独立容错：单表清理失败仅记录，不影响其它表，也绝不抛出（不得阻塞启动）。
 * @returns 每张表的清理结果
 */
export async function cleanupExpiredLogs(): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];

  for (const target of RETENTION_TARGETS) {
    const startedAt = Date.now();
    const indexed = await hasIndexOnColumn(target.table, target.timeColumn);

    let deleted = 0;
    let batches = 0;
    try {
      const cutoff = dayjs().subtract(target.retentionDays, 'day').toDate();
      const where = buildCutoffWhere(target.timeAttribute, cutoff);

      // 分批 DELETE：每批至多 DELETE_BATCH_SIZE 条，直到某批删除数 < 批量（无更多匹配）
      for (;;) {
        const affected = await target.model.destroy({ where, limit: DELETE_BATCH_SIZE });
        if (affected <= 0) {
          break;
        }
        deleted += affected;
        batches += 1;
        if (affected < DELETE_BATCH_SIZE) {
          break;
        }
        if (DELETE_YIELD_MS > 0) {
          await sleep(DELETE_YIELD_MS);
        }
      }

      // 清空 HTTP 日志计数缓存，避免清理后 30s 内仍返回陈旧 total
      if (target.table === 'sys_http_log') {
        clearHttpLogCountCache();
      }
    } catch (error) {
      console.error(`[LogRetention] 清理 ${target.table} 失败:`, error);
    }

    const durationMs = Date.now() - startedAt;
    results.push({
      table: target.table,
      label: target.label,
      retentionDays: target.retentionDays,
      deleted,
      batches,
      durationMs,
      indexed,
    });

    if (indexed === false) {
      console.warn(
        `[LogRetention] 提示：${target.table}.${target.timeColumn} 未建索引，按时间列清理可能全表扫描，建议评估加索引。`,
      );
    }
    console.log(
      `[LogRetention] ${target.label}（${target.table}）保留 ${target.retentionDays} 天：删除 ${deleted} 行（${batches} 批），耗时 ${durationMs}ms`,
    );
  }

  return results;
}

/** 当前定时器句柄（未调度时为 null）。 */
let timer: NodeJS.Timeout | null = null;

/**
 * 计算距离下一次清理时刻的毫秒数。
 * 若今日清理时刻已过，则顺延到次日同一时刻（与 `scheduler.ts` 的归档调度一致）。
 * @returns 毫秒延迟（> 0）
 */
function msUntilNextRun(): number {
  const now = dayjs();
  let next = now.hour(config.log.retentionHour).minute(config.log.retentionMinute).second(0).millisecond(0);
  if (!next.isAfter(now)) {
    next = next.add(1, 'day');
  }
  return Math.max(next.diff(now), 0);
}

/** 执行一次清理并输出汇总（异常仅记录，不抛出）。 */
async function runRetention(reason: string): Promise<void> {
  try {
    const startedAt = Date.now();
    const results = await cleanupExpiredLogs();
    const totalDeleted = results.reduce((sum, item) => sum + item.deleted, 0);
    console.log(
      `[LogRetention] ${reason}清理完成：共删除 ${totalDeleted} 行（${results.length} 张表），总耗时 ${Date.now() - startedAt}ms`,
    );
  } catch (error) {
    console.error(`[LogRetention] ${reason}清理失败:`, error);
  }
}

/** 调度下一次清理（每次重算延迟，规避 DST / 时钟漂移）。 */
function scheduleNext(): void {
  const delay = msUntilNextRun();
  timer = setTimeout(() => {
    void runRetention('定时').then(() => scheduleNext());
  }, delay);
}

/**
 * 启动日志保留清理调度器（幂等）。
 * ① 立即补跑一次清理（覆盖停机跨天场景）；② 调度到次日清理时刻。
 * 说明：清理按时间列为幂等操作，补跑安全。
 * 紧急刹车：`config.log.retentionEnabled=false` 时**不注册调度器、不执行清理**，并明确打印“已禁用”。
 */
export function startRetentionScheduler(): void {
  if (!config.log.retentionEnabled) {
    console.log('[LogRetention] 保留清理已禁用（LOG_RETENTION_ENABLED=false），不注册调度器、不执行清理');
    return;
  }

  if (timer) {
    return; // 已启动，避免重复调度
  }

  // 启动补跑：不阻塞启动流程
  void runRetention('启动补跑');

  scheduleNext();
  console.log(
    `[LogRetention] 已启动，下次清理: ${dayjs().add(msUntilNextRun(), 'millisecond').format('YYYY-MM-DD HH:mm:ss')}`,
  );
}

/**
 * 停止日志保留清理调度器，清理定时器（幂等）。
 * 供优雅退出时调用，确保进程退出时不残留悬挂 timer。
 */
export function stopRetentionScheduler(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
