/**
 * 定时任务定义与注册表。
 * 模块职责：声明「有哪些定时任务、它们各自的调度方式与执行体」，是任务定义的**唯一事实来源**。
 *
 * 为什么任务定义写在代码里而不是数据库：
 * - 任务定义（含执行体）本质上就是代码，存进库也无法改变行为；
 * - 存两套（代码 + 库）必然漂移：改了代码里的 cron，库里那份不会跟着变，
 *   运维看到的「任务配置」与真实运行的就对不上；
 * - 本项目在角色授权上已踩过「双份数据静默漂移」的坑（见 MEMORY.md），此处不再重复。
 *
 * 需要运行时可配的，应改**环境变量**（见 config.ts），而不是另建一张任务表。
 */
import { config } from '../../common/config/config.js';

/** 定时任务上下文。 */
export interface TaskContext {
  /** 任务标识（与 sys_task_log.task_name 一致） */
  name: string;
  /** 任务名称（写入日志的快照） */
  title: string;
}

/**
 * 任务的调度方式。
 *
 * 刻意把「调度语义」与「cron 字符串」分开建模：cron 表达式是由调度方式**推导**出来的，
 * 而不是反过来从 cron 字符串里反推调度语义（反推需要解析 cron，且遇到非常规表达式就失效）。
 */
export type TaskSchedule =
  /** 每日定点执行 */
  | { kind: 'daily'; hour: number; minute: number }
  /** 每 N 小时执行一次 */
  | { kind: 'everyHours'; hours: number };

/** 单个定时任务的定义。 */
export interface TaskDefinition {
  /** 任务标识（英文 kebab-case，全局唯一；亦作为 SchedulerRegistry 中的 job 名） */
  name: string;
  /** 任务名称（中文，展示用） */
  title: string;
  /** 任务说明（管理端展示） */
  description: string;
  /** 调度方式（cron 表达式由它推导，见 cronOf） */
  schedule: TaskSchedule;
  /** cron 表达式（6 位：秒 分 时 日 月 周） */
  cron: string;
  /**
   * 是否启用。
   * 为 false 时**不注册**到 SchedulerRegistry（任务不会自动跑），
   * 但仍会出现在管理端列表里并标记为「已停用」——运维需要看到「有这个任务但它没跑」。
   */
  enabled: boolean;
  /** 执行体：抛异常即视为执行失败（错误信息会记入 sys_task_log） */
  handler: (ctx: TaskContext) => Promise<void>;
}

/**
 * 由调度方式推导 cron 表达式。
 *
 * 用 6 位（秒 分 时 日 月 周）格式，秒固定 0：cron 的 5 位格式里分钟在第一位，
 * 与「时:分」的自然顺序相反，写成 5 位容易被误读。
 */
export function cronOf(schedule: TaskSchedule): string {
  if (schedule.kind === 'daily') {
    return `0 ${schedule.minute} ${schedule.hour} * * *`;
  }
  // 小时位用步长写法（0 0 ␟/N ␟* * *，␟ 代表斜杠）：
  // N 必须是 24 的约数才能整除（1/2/3/4/6/8/12），
  // 否则（如 N=5）cron 会在当天内触发 5 次但跨天对不齐——这是 cron 表达式的固有语义，
  // 故对不整除的 N 归一到最近的约数，保证「每天触发次数 × N ≈ 24 小时」这一直觉成立。
  const divisors = [1, 2, 3, 4, 6, 8, 12];
  const safe = Math.max(1, Math.floor(schedule.hours));
  const picked = divisors.find((d) => d >= safe) ?? 12;
  return `0 0 */${picked} * * *`;
}

/** 任务执行体所依赖的业务服务。 */
export interface TaskDeps {
  /** 日志归档（FileLoggerService.archiveYesterday） */
  archiveLogs: () => Promise<void>;
  /** 清理过期数据库日志（FileLoggerService.cleanExpiredLogs） */
  cleanLogs: () => Promise<void>;
  /** 缩略图缓存清理（ImageScaleService.sweep） */
  sweepImageCache: () => Promise<void>;
}

/** 任务注册表条目（描述 + 执行体工厂）。 */
export interface TaskRegistryItem {
  name: string;
  title: string;
  description: string;
  schedule: TaskSchedule;
  enabled: boolean;
  /** 执行体工厂：由 TaskService 注入真实服务后调用 */
  create: (deps: TaskDeps) => (ctx: TaskContext) => Promise<void>;
}

/**
 * 构造任务注册表。
 *
 * 单独抽成函数（而非模块级常量）是因为 cron 表达式依赖 config：
 * config 在模块加载时求值，而配置文件里可能有环境变量覆盖，
 * 抽成函数可确保读到的是**调用时刻**的配置值。
 */
export function buildTaskRegistry(): TaskRegistryItem[] {
  return [
    {
      name: 'log-archive',
      title: '日志归档',
      description: '将前一日的应用/错误/访问/慢 SQL 日志打包为 tar.gz 存入归档目录，并按配置删除源文件。',
      schedule: { kind: 'daily', hour: config.log.archiveHour, minute: config.log.archiveMinute },
      enabled: true,
      create: (deps) => async () => {
        await deps.archiveLogs();
      },
    },
    {
      name: 'log-retention',
      title: '日志保留清理',
      description: '按保留天数分批删除过期的 HTTP 访问日志、操作日志与登录日志。',
      schedule: { kind: 'daily', hour: config.log.retentionHour, minute: config.log.retentionMinute },
      enabled: config.log.retentionEnabled,
      create: (deps) => async () => {
        await deps.cleanLogs();
      },
    },
    {
      name: 'image-cache-sweep',
      title: '缩略图缓存清理',
      description: '按 TTL 与体积上限清理图片缩略图缓存目录，释放磁盘占用。',
      schedule: { kind: 'everyHours', hours: config.upload.cacheSweepIntervalHours },
      enabled: config.upload.cacheSweepEnabled,
      create: (deps) => async () => {
        await deps.sweepImageCache();
      },
    },
  ];
}
