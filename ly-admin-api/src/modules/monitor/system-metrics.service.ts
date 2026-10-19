/**
 * 系统资源采样服务（CPU / 内存 / 磁盘 / 负载 / 进程）。
 * 模块职责：后台按固定间隔采样，供「监控管理 → 系统监控」页面轮询取用。
 *
 * 三个关键设计（都是在"看起来能跑、实际会误导人"的地方踩过的坑）：
 *
 * 1. **CPU 使用率必须两次采样做差**：`os.cpus()` 返回的是**开机累计时间**，
 *    单次调用算不出"当前使用率"。因此本服务在进程内做采样器（默认 3s），
 *    首次采样只建立基线（`usage = null`，页面显示"采样中"），第二次起才有真实值。
 *
 * 2. **容器里不能直接信 `os.totalmem()`**：Node 读 `/proc/meminfo`，在容器中拿到的仍是
 *    **宿主机**内存，而容器往往被限制在几百 MB —— 显示"16G 用了 3G"但实际 512M 就 OOM，
 *    这种数字比没有数字更危险。所以优先读 cgroup 的限制：
 *    cgroup v2（`memory.current`/`memory.max`、`cpu.max`）→ 回退 cgroup v1 → 最后才用 os.*，
 *    并在响应里用 `scope` 明确标注口径（container / host）。
 *
 * 3. **采样定时器必须 `unref()`**：否则测试进程（e2e 会启动完整 AppModule）会一直挂着不退出。
 *
 * 磁盘用量取的是**上传目录**所在文件系统，而不是任意路径：磁盘写满时最先出问题的地方就是它。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { readFileSync, statfsSync } from 'node:fs';
import { hostname, arch, platform, cpus, freemem, totalmem, loadavg, release } from 'node:os';
import { config } from '../../common/config/config.js';

/** 采样间隔（毫秒）。3s 兼顾曲线平滑度与读取开销。 */
const SAMPLE_INTERVAL_MS = 3000;
/** 环形缓冲保留的采样点数（120 × 3s ≈ 6 分钟）。 */
const HISTORY_SIZE = 120;

/** 累积 CPU 时间（秒）。 */
export interface CpuTimes {
  /** 空闲时间 */
  idle: number;
  /** 全部时间 */
  total: number;
}

/** CPU 指标。 */
export interface CpuMetric {
  /** 型号（取第一核） */
  model: string;
  /** 逻辑核数 */
  cores: number;
  /** 总使用率 0~100；首次采样为 null（尚无基线） */
  usage: number | null;
  /** 各核使用率 0~100 */
  perCore: Array<number | null>;
  /** 容器 CPU 配额折算的核数（如 1.5）；不在容器内为 null */
  quotaCores: number | null;
}

/** 内存指标（字节）。 */
export interface MemoryMetric {
  used: number;
  total: number;
  /** 0~100；总量拿不到时为 null */
  usage: number | null;
}

/** 磁盘指标（字节）。 */
export interface DiskMetric {
  /** 被统计的目录（上传目录） */
  path: string;
  used: number;
  total: number;
  usage: number | null;
}

/** 进程内存指标（字节）。 */
export interface ProcessMetric {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  /** 进程运行时长（秒） */
  uptime: number;
}

/** 单个采样点（图表用）。 */
export interface MetricsPoint {
  /** 采样时刻（毫秒时间戳） */
  at: number;
  /** CPU 使用率；首次为 null */
  cpu: number | null;
  /** 内存使用率 0~100 */
  memory: number | null;
}

/** 一次快照（接口响应体）。 */
export interface ServerMetrics {
  /** 指标口径：container = 读的是 cgroup 限制；host = 读的是宿主机 */
  scope: 'container' | 'host';
  cpu: CpuMetric;
  memory: MemoryMetric;
  disk: DiskMetric;
  /** 1/5/15 分钟平均负载；Windows 恒为 0，故不支持时为 null */
  load: [number, number, number] | null;
  process: ProcessMetric;
  system: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    nodeVersion: string;
    /** 应用版本（镜像构建时注入，便于确认线上跑的是哪个构建） */
    appVersion: string;
  };
  /** 最近若干个采样点 */
  history: MetricsPoint[];
  /** 是否还在预热（首次采样已建立基线但尚无使用率） */
  warmingUp: boolean;
  sampledAt: string;
}

/* ------------------------------------------------------------------ */
/* 纯函数：便于单测，不碰 IO                                                */
/* ------------------------------------------------------------------ */

/** 把 os.cpus() 的一行 times 转成累积 {idle,total}。 */
export function toCpuTimes(entry: {
  times: { user: number; nice: number; sys: number; idle: number; irq: number };
}): CpuTimes {
  const { user, nice, sys, idle, irq } = entry.times;
  return { idle, total: user + nice + sys + idle + irq };
}

/** 使用率（0~100，保留 1 位小数）；Δtotal ≤ 0 时返回 null 而不是 NaN。 */
export function computeCpuUsage(previous: CpuTimes, current: CpuTimes): number | null {
  const deltaTotal = current.total - previous.total;
  const deltaIdle = current.idle - previous.idle;
  if (deltaTotal <= 0) {
    return null;
  }
  const usage = (1 - deltaIdle / deltaTotal) * 100;
  return round1(clamp(usage));
}

/** 总量 → 使用率百分比；总量不可用（非 0）时返回 null。 */
export function computeUsage(used: number, total: number): number | null {
  if (total <= 0) {
    return null;
  }
  return round1(clamp((used / total) * 100));
}

/**
 * 解析 cgroup 的 cpu.max：`"max 100000 100000"`（不限）或 `"200000 100000"`（2 核）。
 * @returns 配额核数；不限或格式异常返回 null
 */
export function parseCpuMax(content: string): number | null {
  const [quotaRaw, periodRaw] = content.trim().split(/\s+/);
  if (!quotaRaw || quotaRaw === 'max') {
    return null;
  }
  const quota = Number(quotaRaw);
  const period = Number(periodRaw);
  // cgroup v1 的 cpu.cfs_quota_us 在不限时写 -1，必须当无限制处理（否则会算出负核数）
  if (!Number.isFinite(quota) || !Number.isFinite(period) || quota <= 0 || period <= 0) {
    return null;
  }
  return round1(quota / period);
}

/**
 * 解析 cgroup 内存上限文件内容。
 * v1 的 limit 在"无限制"时会写成一个极大值（≥1TB），需当作无限制处理。
 * @returns 字节数；无限制或非法返回 null
 */
export function parseMemoryLimit(content: string): number | null {
  const text = content.trim();
  if (text === 'max') {
    return null;
  }
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  if (value >= 1024 ** 4) {
    // v1 的"无限制"哨兵值（1TiB 及以上），不是真实配额
    return null;
  }
  return value;
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* 服务                                                                  */
/* ------------------------------------------------------------------ */

@Injectable()
export class SystemMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemMetricsService.name);

  /** 采样定时器 */
  private timer: NodeJS.Timeout | null = null;
  /** 上一次采样（用于 CPU 做差） */
  private previous: CpuTimes[] = [];
  /** 环形缓冲 */
  private history: MetricsPoint[] = [];
  /** 最近一次快照 */
  private latest: ServerMetrics | null = null;
  /** cgroup 探测结果（只探一次，避免每次采样都去摸 4 个文件） */
  private cgroup: { version: 2 | 1 | null; memoryLimit: number | null; cpuQuota: number | null } = {
    version: null,
    memoryLimit: null,
    cpuQuota: null,
  };

  onModuleInit(): void {
    this.probeCgroup();
    this.tick();
    this.timer = setInterval(() => this.tick(), SAMPLE_INTERVAL_MS);
    // 不让采样定时器吊住进程（测试/优雅退出都靠它）
    this.timer.unref();
    this.logger.log(`[SystemMetrics] 系统指标采样已启动，间隔 ${SAMPLE_INTERVAL_MS}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 取最近一次快照。
   * 尚未采样过（理论上只在模块初始化前）时同步采一次，避免接口返回空。
   */
  getSnapshot(): ServerMetrics {
    if (!this.latest) {
      this.tick();
    }
    return this.latest!;
  }

  /** 采集一次并更新缓存。 */
  private tick(): void {
    try {
      this.latest = this.collect();
    } catch (error) {
      // 采样失败不应影响接口可用性：返回上一次快照，没有则抛出由全局过滤器处理
      this.logger.error(`[SystemMetrics] 采集失败: ${error instanceof Error ? error.message : String(error)}`);
      if (!this.latest) {
        throw error;
      }
    }
  }

  /** 执行一次采集（纯读，不改采样器状态以外的东西）。 */
  private collect(): ServerMetrics {
    const coreEntries = cpus();
    const current = coreEntries.map((entry) => toCpuTimes(entry));
    const previous = this.previous;

    const perCore = current.map((item, index) => {
      const before = previous[index];
      return before ? computeCpuUsage(before, item) : null;
    });

    // 总量用所有核的 Δ 累加（比"平均各核"更贴近整体负载）
    let usage: number | null = null;
    if (previous.length === current.length && previous.length > 0) {
      let deltaIdle = 0;
      let deltaTotal = 0;
      for (let index = 0; index < current.length; index += 1) {
        deltaIdle += current[index]!.idle - previous[index]!.idle;
        deltaTotal += current[index]!.total - previous[index]!.total;
      }
      usage = deltaTotal > 0 ? round1(clamp((1 - deltaIdle / deltaTotal) * 100)) : null;
    }

    this.previous = current;

    const memory = this.readMemory();
    const disk = this.readDisk();
    const loadValues = loadavg();
    // Windows 上 loadavg 恒为 [0,0,0]，报 0 会被误读成"负载为零"，不如明确置 null
    const isWindows = platform() === 'win32';
    const usageMemory = process.memoryUsage();

    const at = Date.now();
    this.history.push({ at, cpu: usage, memory: memory.usage });
    if (this.history.length > HISTORY_SIZE) {
      this.history.splice(0, this.history.length - HISTORY_SIZE);
    }

    return {
      scope: this.cgroup.memoryLimit === null ? 'host' : 'container',
      cpu: {
        model: coreEntries[0]?.model.trim() ?? 'unknown',
        cores: coreEntries.length || 1,
        usage,
        perCore,
        quotaCores: this.cgroup.cpuQuota,
      },
      memory,
      disk,
      load: isWindows ? null : [round1(loadValues[0]), round1(loadValues[1]), round1(loadValues[2])],
      process: {
        rss: usageMemory.rss,
        heapUsed: usageMemory.heapUsed,
        heapTotal: usageMemory.heapTotal,
        uptime: Math.floor(process.uptime()),
      },
      system: {
        hostname: hostname(),
        platform: platform(),
        release: release(),
        arch: arch(),
        nodeVersion: process.version,
        appVersion: process.env.APP_VERSION ?? 'dev',
      },
      history: [...this.history],
      warmingUp: usage === null,
      sampledAt: new Date(at).toISOString(),
    };
  }

  /** 读内存：cgroup 优先，其次宿主机。 */
  private readMemory(): MemoryMetric {
    const limit = this.cgroup.memoryLimit;
    if (limit !== null) {
      const used = this.readNumberFile(
        this.cgroup.version === 2 ? '/sys/fs/cgroup/memory.current' : '/sys/fs/cgroup/memory/memory.usage_in_bytes',
      );
      if (used !== null && used > 0) {
        return { used, total: limit, usage: computeUsage(used, limit) };
      }
    }
    const total = totalmem();
    const used = total - freemem();
    return { used, total, usage: computeUsage(used, total) };
  }

  /**
   * 读磁盘：只统计上传目录所在文件系统（写满时最先出问题的地方）。
   * 用同步 statfs —— 采样在后台定时器里跑（每 3s 一次），不需要为它引入异步链路。
   */
  private readDisk(): DiskMetric {
    const path = config.upload.dir;
    try {
      const stats = statfsSync(path);
      const total = stats.blocks * stats.bsize;
      const used = (stats.blocks - stats.bfree) * stats.bsize;
      return { path, used, total, usage: computeUsage(used, total) };
    } catch (error) {
      // 目录不存在 / 无权限时不该让整个接口挂掉
      this.logger.debug(`[SystemMetrics] 磁盘信息读取失败（${path}）：${String(error)}`);
      return { path, used: 0, total: 0, usage: null };
    }
  }

  /** 探测 cgroup 版本与限制（只执行一次）。 */
  private probeCgroup(): void {
    // cgroup v2：memory.max / memory.current / cpu.max
    const v2Max = this.readTextFile('/sys/fs/cgroup/memory.max');
    if (v2Max !== null) {
      const cpuMax = this.readTextFile('/sys/fs/cgroup/cpu.max');
      this.cgroup = {
        version: 2,
        memoryLimit: parseMemoryLimit(v2Max),
        cpuQuota: cpuMax === null ? null : parseCpuMax(cpuMax),
      };
      return;
    }
    // cgroup v1：memory.limit_in_bytes / cpu.cfs_quota_us + cpu.cfs_period_us
    const v1Limit = this.readTextFile('/sys/fs/cgroup/memory/memory.limit_in_bytes');
    if (v1Limit !== null) {
      const quota = this.readTextFile('/sys/fs/cgroup/cpu/cpu.cfs_quota_us');
      const period = this.readTextFile('/sys/fs/cgroup/cpu/cpu.cfs_period_us');
      this.cgroup = {
        version: 1,
        memoryLimit: parseMemoryLimit(v1Limit),
        cpuQuota: quota === null || period === null ? null : parseCpuMax(`${quota} ${period}`),
      };
      return;
    }
    this.cgroup = { version: null, memoryLimit: null, cpuQuota: null };
  }

  /** 同步读文本文件（失败返回 null；探测只做一次，同步足够）。 */
  private readTextFile(path: string): string | null {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  }

  /** 读一个纯数字文件。 */
  private readNumberFile(path: string): number | null {
    const text = this.readTextFile(path);
    if (text === null) {
      return null;
    }
    const value = Number(text.trim());
    return Number.isFinite(value) ? value : null;
  }
}
