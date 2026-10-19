/**
 * 系统资源采样单测（只测纯计算，IO 由 e2e 覆盖）。
 *
 * 这些函数是"看起来对、实际错"的高发区：CPU 必须两次采样做差、cgroup 的哨兵值
 * （v1 的 limit 极大值、quota=-1）如果当正常值算，会直接显示出一个假的百分比。
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { SystemMetricsService } from '../src/modules/monitor/system-metrics.service.js';
import {
  computeCpuUsage,
  computeRate,
  computeUsage,
  parseCpuMax,
  parseMemoryLimit,
  parseProcNetDev,
  toCpuTimes,
  type CpuTimes,
} from '../src/modules/monitor/system-metrics.service.js';

describe('computeCpuUsage', () => {
  it('两次采样的差值 → 使用率', () => {
    // 新增 100s 时间里空闲 40s（idle 60→100）→ 使用率 1 - 40/100 = 60%
    const previous: CpuTimes = { idle: 60, total: 100 };
    const current: CpuTimes = { idle: 100, total: 200 };
    expect(computeCpuUsage(previous, current)).toBe(60);
  });

  it('完全空闲 → 0%', () => {
    expect(computeCpuUsage({ idle: 10, total: 100 }, { idle: 110, total: 200 })).toBe(0);
  });

  it('完全忙 → 100%（不会因浮点误差冒出 100.1）', () => {
    const value = computeCpuUsage({ idle: 0, total: 100 }, { idle: 0, total: 200 });
    expect(value).toBe(100);
  });

  it('Δtotal ≤ 0（无新样本）→ null，而不是 NaN/Infinity', () => {
    expect(computeCpuUsage({ idle: 5, total: 10 }, { idle: 5, total: 10 })).toBeNull();
    expect(computeCpuUsage({ idle: 6, total: 11 }, { idle: 5, total: 10 })).toBeNull();
  });
});

describe('toCpuTimes', () => {
  it('累加 user+nice+sys+idle+irq 作为总时间', () => {
    expect(toCpuTimes({ times: { user: 10, nice: 1, sys: 2, idle: 80, irq: 7 } })).toEqual({
      idle: 80,
      total: 100,
    });
  });
});

describe('computeUsage', () => {
  it('正常百分比，保留一位小数', () => {
    expect(computeUsage(50, 200)).toBe(25);
    expect(computeUsage(1, 3)).toBe(33.3);
  });

  it('总量不可用（0）→ null（而不是除零得 Infinity）', () => {
    expect(computeUsage(10, 0)).toBeNull();
    expect(computeUsage(10, -1)).toBeNull();
  });
});

describe('parseCpuMax（cgroup v2 cpu.max / v1 cfs 配额）', () => {
  it('"max 100000 100000" → 不限（null）', () => {
    expect(parseCpuMax('max 100000 100000')).toBeNull();
  });

  it('"200000 100000" → 2 核', () => {
    expect(parseCpuMax('200000 100000')).toBe(2);
  });

  it('"150000 100000" → 1.5 核', () => {
    expect(parseCpuMax('150000 100000')).toBe(1.5);
  });

  it('cgroup v1 的 "-1 100000"（不限）→ null，不能算出负核数', () => {
    expect(parseCpuMax('-1 100000')).toBeNull();
  });

  it('周期非法 → null', () => {
    expect(parseCpuMax('200000 0')).toBeNull();
    expect(parseCpuMax('abc def')).toBeNull();
    expect(parseCpuMax('')).toBeNull();
  });
});

describe('parseMemoryLimit（cgroup 内存上限）', () => {
  it('"max"（v2 不限）→ null', () => {
    expect(parseMemoryLimit('max')).toBeNull();
  });

  it('正常字节数', () => {
    expect(parseMemoryLimit('536870912')).toBe(536870912);
  });

  it('v1 的"无限制"哨兵值（1TiB 及以上）→ null', () => {
    // cgroup v1 无限制时会写 9223372036854771712，必须当成无限而不是真实配额
    expect(parseMemoryLimit('9223372036854771712')).toBeNull();
  });

  it('0 / 负数 / 非数字 → null', () => {
    expect(parseMemoryLimit('0')).toBeNull();
    expect(parseMemoryLimit('-1')).toBeNull();
    expect(parseMemoryLimit('abc')).toBeNull();
  });
});

/**
 * `/proc/net/dev` 的真实格式（本机 Windows 上没法读，故用 fixture 覆盖）。
 * 注意表头两行没有冒号、行首有空格、字段之间空格数不固定。
 */
const PROC_NET_DEV_FIXTURE = `Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000      10    0    0    0     0          0         0     1000      10    0    0    0     0       0          0
  eth0: 500000     400    1    2    0     0          0         0   300000     300    3    4    0     0       0          0
docker0: 200000     150    0    0    0     0          0         0   100000     100    0    0    0     0       0          0
`;

describe('parseProcNetDev', () => {
  it('解析每张网卡的收发字节/错误/丢包，并跳过表头', () => {
    const result = parseProcNetDev(PROC_NET_DEV_FIXTURE);
    expect(result.map((item) => item.name)).toEqual(['lo', 'eth0', 'docker0']);
    expect(result[1]).toEqual({
      name: 'eth0',
      rxBytes: 500000,
      rxErrors: 1,
      rxDropped: 2,
      txBytes: 300000,
      txErrors: 3,
      txDropped: 4,
    });
  });

  it('字段不足 16 个或含非数字的行被跳过，不抛错', () => {
    const broken = [
      '  eth0: 1 2 3',
      '  eth1: 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 abc',
      'garbage line without colon',
      '',
    ].join('\n');
    expect(parseProcNetDev(broken)).toEqual([]);
  });

  it('空内容返回空数组', () => {
    expect(parseProcNetDev('')).toEqual([]);
  });

  it('网卡名两侧的空白被去掉（行首缩进是常态）', () => {
    const result = parseProcNetDev('  eth0: 1 2 0 0 0 0 0 0 3 4 0 0 0 0 0 0\n');
    expect(result[0]?.name).toBe('eth0');
  });
});

describe('computeRate', () => {
  it('累计字节差 / 时间差 → 字节每秒', () => {
    // 3 秒里多收了 3000 字节 → 1000 B/s
    expect(computeRate(1000, 4000, 3000)).toBe(1000);
  });

  it('无变化 → 0（确实是"没流量"，与"没测到"不同）', () => {
    expect(computeRate(1000, 1000, 3000)).toBe(0);
  });

  it('时间差 ≤ 0 → null（除零防护）', () => {
    expect(computeRate(1000, 4000, 0)).toBeNull();
    expect(computeRate(1000, 4000, -1)).toBeNull();
  });

  it('计数器被重置（当前小于上次）→ null，而不是负速率', () => {
    // 网卡重载 / 容器重建 / 网卡名复用都会出现这种情况
    expect(computeRate(999999, 100, 3000)).toBeNull();
  });

  it('四舍五入到整数字节', () => {
    expect(computeRate(0, 100, 3000)).toBe(33);
  });
});

/**
 * 服务级验证：用 fixture 文件驱动真实实例，覆盖「探测 → 解析 → 算速率 → 进快照」整条链路。
 *
 * 为什么能这么测：`SystemMetricsService` 没有构造依赖（配置走 import、路径走 env），
 * 而 `NET_DEV_PATH` 允许把网卡计数文件换成夹具——于是本机 Windows 也能验证这条
 * 只有在 Linux 上才会真实触发的分支（真实 /proc/net/dev 的端到端由 CI 的 Linux runner 覆盖）。
 */
describe('SystemMetricsService 网络采集（fixture 驱动）', () => {
  const fixturePath = join(tmpdir(), `ly-admin-netdev-${process.pid}.fixture`);

  /** 按给定累计值渲染一份 /proc/net/dev 内容 */
  const render = (rx: number, tx: number): string =>
    [
      'Inter-|   Receive                                                |  Transmit',
      ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
      `    lo: ${rx * 2}  10    0    0    0     0          0         0   ${tx * 2}  10    0    0    0     0       0          0`,
      `  eth0: ${rx}  400    5    6    0     0          0         0   ${tx}  300    7    8    0     0       0          0`,
      '',
    ].join('\n');

  afterAll(() => {
    rmSync(fixturePath, { force: true });
    delete process.env.NET_DEV_PATH;
  });

  it('首次采样只建立基线，一个采样周期后给出 S 速率、累计与丢包错误合计', async () => {
    writeFileSync(fixturePath, render(500_000, 300_000));
    process.env.NET_DEV_PATH = fixturePath;

    const service = new SystemMetricsService();
    service.onModuleInit();

    // 首次快照：有累计值（来自文件），但速率还没有基线
    const first = service.getSnapshot().network;
    expect(first.supported).toBe(true);
    expect(first.reason).toBeNull();
    expect(first.rxRate).toBeNull();
    expect(first.txRate).toBeNull();
    expect(first.rxTotal).toBe(500_000);
    expect(first.txTotal).toBe(300_000);
    expect(first.rxErrors).toBe(5);
    expect(first.rxDropped).toBe(6);
    expect(first.txErrors).toBe(7);
    expect(first.txDropped).toBe(8);
    // lo 被排除：只统计 eth0
    expect(first.interfaces.map((item) => item.name)).toEqual(['eth0']);

    // 改夹具（多收 9000 字节 / 多发 3000 字节），等采样器下一个周期
    writeFileSync(fixturePath, render(509_000, 303_000));
    await new Promise((resolve) => setTimeout(resolve, 3600));

    const second = service.getSnapshot().network;
    expect(second.rxTotal).toBe(509_000);
    expect(second.rxRate).not.toBeNull();
    // 3s 里 9000 字节 → 约 3000 B/s；定时器有抖动，给一个宽松区间
    expect(second.rxRate as number).toBeGreaterThan(1000);
    expect(second.txRate as number).toBeGreaterThan(300);

    // 历史点里也要带上速率，趋势图才能画
    const lastPoint = service.getSnapshot().history.at(-1);
    expect(lastPoint?.rxRate).not.toBeNull();
    expect(lastPoint?.txRate).not.toBeNull();

    service.onModuleDestroy();
  }, 10_000);

  it('NET_DEV_PATH 指向不存在的文件 → 明确报不支持并带上原因', () => {
    process.env.NET_DEV_PATH = join(tmpdir(), 'definitely-not-exist-netdev');
    const service = new SystemMetricsService();
    service.onModuleInit();

    const network = service.getSnapshot().network;
    expect(network.supported).toBe(false);
    expect(network.reason).toContain('NET_DEV_PATH');
    expect(network.interfaces).toEqual([]);
    expect(network.rxRate).toBeNull();

    service.onModuleDestroy();
  });
});
