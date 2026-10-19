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
/** Linux 网卡累计计数文件（每行一张网卡）。 */
const PROC_NET_DEV = '/proc/net/dev';

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

/** 单个网卡的累计计数（`/proc/net/dev` 的一行）。 */
export interface NetCounters {
  name: string;
  rxBytes: number;
  rxErrors: number;
  rxDropped: number;
  txBytes: number;
  txErrors: number;
  txDropped: number;
}

/** 网络活动指标。 */
export interface NetworkMetric {
  /**
   * 当前平台是否支持采集。
   *
   * 只有 Linux（含容器）能拿到真实的网卡计数：`/proc/net/dev` 的累计字节数是精确值，
   * 两次采样做差即速率。**Windows / macOS 上 Node 核心库没有任何网络计数 API**，
   * 若去解析 `netstat -e` 会踩"表头本地化"（中文 Windows 是"收到的字节数"）与版本差异，
   * 宁可明确报"不支持"，也不给一个会静默出错或不准确的数字。
   */
  supported: boolean;
  /** 不支持时的原因（直接展示给运维看） */
  reason: string | null;
  /** 采样间隔内的平均速率（字节/秒）；首次采样为 null */
  rxRate: number | null;
  txRate: number | null;
  /** 自网卡启动以来的累计流量（字节） */
  rxTotal: number;
  txTotal: number;
  /** 累计错误 / 丢包（排查网络问题的关键指标） */
  rxErrors: number;
  txErrors: number;
  rxDropped: number;
  txDropped: number;
  /** 每张网卡的明细（速率与累计），便于解释合计值是怎么来的 */
  interfaces: Array<{
    name: string;
    rxRate: number | null;
    txRate: number | null;
    rxTotal: number;
    txTotal: number;
  }>;
}

/** 单个采样点（图表用）。 */
export interface MetricsPoint {
  /** 采样时刻（毫秒时间戳） */
  at: number;
  /** CPU 使用率；首次为 null */
  cpu: number | null;
  /** 内存使用率 0~100 */
  memory: number | null;
  /** 下行速率（字节/秒）；平台不支持或首次采样为 null */
  rxRate: number | null;
  /** 上行速率（字节/秒）；平台不支持或首次采样为 null */
  txRate: number | null;
}

/** 一次快照（接口响应体）。 */
export interface ServerMetrics {
  /** 指标口径：container = 读的是 cgroup 限制；host = 读的是宿主机 */
  scope: 'container' | 'host';
  cpu: CpuMetric;
  memory: MemoryMetric;
  disk: DiskMetric;
  network: NetworkMetric;
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

/**
 * 解析 `/proc/net/dev`。
 *
 * 文件形如（前两行是表头，可跳过）：
 * ```
 *   eth0: 1234 10 0 0 0 0 0 0   5678 20 0 0 0 0 0 0
 * ```
 * 冒号后共 16 个数字：接收 {bytes,packets,errs,drop,fifo,frame,compressed,multicast}
 * 与发送 {bytes,packets,errs,drop,fifo,colls,carrier,compressed}。
 *
 * @param content 文件内容
 * @returns 每张网卡的累计计数（无法解析的行会被跳过，不抛错——采样失败不该拖垮整个指标接口）
 */
export function parseProcNetDev(content: string): NetCounters[] {
  const result: NetCounters[] = [];
  for (const rawLine of content.split('\n')) {
    const colon = rawLine.indexOf(':');
    if (colon <= 0) {
      // 表头行（Inter-| Receive ...）与"总计"行没有冒号，直接跳过
      continue;
    }
    const name = rawLine.slice(0, colon).trim();
    const fields = rawLine
      .slice(colon + 1)
      .trim()
      .split(/\s+/)
      .map((value) => Number(value));
    if (!name || fields.length < 16 || fields.some((value) => !Number.isFinite(value))) {
      continue;
    }
    result.push({
      name,
      rxBytes: fields[0]!,
      rxErrors: fields[2]!,
      rxDropped: fields[3]!,
      txBytes: fields[8]!,
      txErrors: fields[10]!,
      txDropped: fields[11]!,
    });
  }
  return result;
}

/**
 * 两次累计值 → 速率（单位/秒）。
 *
 * 返回 null 的两种情况都要当心，不能当成 0：
 * - `elapsedMs <= 0`：没有时间差，速率无意义（除零）；
 * - `delta < 0`：计数器被重置（网卡重载、容器重建、网卡名复用），此时"负速率"是脏数据。
 */
export function computeRate(previous: number, current: number, elapsedMs: number): number | null {
  if (elapsedMs <= 0) {
    return null;
  }
  const delta = current - previous;
  if (delta < 0) {
    return null;
  }
  return Math.round((delta / elapsedMs) * 1000);
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
  /** 上一次网卡累计计数（用于算速率） */
  private previousNet: NetCounters[] | null = null;
  /** 上一次采样时刻（算速率需要时间差） */
  private previousAt = 0;
  /** 网卡计数文件路径；null = 当前环境不支持采集 */
  private netDevPath: string | null = null;
  /** 不支持采集时的原因（展示给运维） */
  private netReason: string | null = null;
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
    this.probeNetwork();
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
    const network = this.collectNetwork(at);
    this.history.push({ at, cpu: usage, memory: memory.usage, rxRate: network.rxRate, txRate: network.txRate });
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
      network,
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
   * 探测网络计数是否可用，并记下要读的文件路径。
   *
   * 只认 `/proc/net/dev`：它是 Linux（含容器）里唯一**精确且零依赖**的网卡计数来源，
   * 容器里读到的是自己 network namespace 的接口（也就是本服务的真实流量）。
   * Windows / macOS 明确不采集——解析 `netstat -e` 之类输出会踩表头本地化与版本差异，
   * 与其给出可能错的数字，不如在界面上如实说"不支持"。
   *
   * `NET_DEV_PATH` 可覆盖路径：一是便于非 Linux 环境做集成测试，
   * 二是容器用 host 网络命名空间时可指向挂载进来的宿主机 `/proc/net/dev`。
   */
  private probeNetwork(): void {
    const override = process.env.NET_DEV_PATH?.trim();
    if (override) {
      try {
        readFileSync(override, 'utf8');
        this.netDevPath = override;
        this.netReason = null;
        return;
      } catch {
        this.netDevPath = null;
        this.netReason = `NET_DEV_PATH 指向的文件不可读：${override}`;
        return;
      }
    }

    if (platform() !== 'linux') {
      this.netDevPath = null;
      this.netReason = `当前平台（${platform()}）不支持采集网卡计数：Node 核心库无跨平台网络计数 API，Linux 走 /proc/net/dev`;
      return;
    }

    try {
      readFileSync(PROC_NET_DEV, 'utf8');
      this.netDevPath = PROC_NET_DEV;
      this.netReason = null;
    } catch {
      this.netDevPath = null;
      this.netReason = `${PROC_NET_DEV} 不可读（容器可能未挂载 /proc）`;
    }
  }

  /**
   * 采集网络活动：把每张网卡的累计计数做差得到速率。
   *
   * 两个刻意的口径：
   * - **排除 `lo`（环回）**：本机进程间通信也走环回，算进"网络活动"会虚高，
   *   且与真实网卡重复计数（如 docker0 + eth0 转发同一份流量）；
   * - 速率可能为 null（首次采样无基线、或计数器被重置）——**不当成 0**：
   *   界面显示"采样中"而不是"0 KB/s"，避免把"没测到"说成"没流量"。
   */
  private collectNetwork(at: number): NetworkMetric {
    const empty: NetworkMetric = {
      supported: false,
      reason: this.netReason,
      rxRate: null,
      txRate: null,
      rxTotal: 0,
      txTotal: 0,
      rxErrors: 0,
      txErrors: 0,
      rxDropped: 0,
      txDropped: 0,
      interfaces: [],
    };

    if (!this.netDevPath) {
      return empty;
    }

    // 不写初始值：catch 分支直接 return，初始值永远用不到（会被 lint 判为无用赋值）
    let counters: NetCounters[];
    try {
      counters = parseProcNetDev(readFileSync(this.netDevPath, 'utf8'));
    } catch (error) {
      this.logger.debug(`[SystemMetrics] 网卡计数读取失败：${String(error)}`);
      return { ...empty, reason: '网卡计数读取失败' };
    }

    const elapsedMs = this.previousAt > 0 ? at - this.previousAt : 0;
    const previousMap = new Map((this.previousNet ?? []).map((item) => [item.name, item]));
    const usable = counters.filter((item) => item.name !== 'lo');

    const interfaces = usable.map((item) => {
      const before = previousMap.get(item.name);
      return {
        name: item.name,
        rxRate: before ? computeRate(before.rxBytes, item.rxBytes, elapsedMs) : null,
        txRate: before ? computeRate(before.txBytes, item.txBytes, elapsedMs) : null,
        rxTotal: item.rxBytes,
        txTotal: item.txBytes,
      };
    });

    /** 逐网卡速率求和；全部为 null（首次采样）时合计也为 null，而不是 0 */
    const sumRates = (pick: (item: (typeof interfaces)[number]) => number | null): number | null => {
      const values = interfaces.map(pick).filter((value): value is number => value !== null);
      return values.length > 0 ? values.reduce((total, value) => total + value, 0) : null;
    };
    const sumTotals = (pick: (item: NetCounters) => number): number =>
      usable.reduce((total, item) => total + pick(item), 0);

    this.previousNet = counters;
    this.previousAt = at;

    return {
      supported: true,
      reason: null,
      rxRate: sumRates((item) => item.rxRate),
      txRate: sumRates((item) => item.txRate),
      rxTotal: sumTotals((item) => item.rxBytes),
      txTotal: sumTotals((item) => item.txBytes),
      rxErrors: sumTotals((item) => item.rxErrors),
      txErrors: sumTotals((item) => item.txErrors),
      rxDropped: sumTotals((item) => item.rxDropped),
      txDropped: sumTotals((item) => item.txDropped),
      interfaces,
    };
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
