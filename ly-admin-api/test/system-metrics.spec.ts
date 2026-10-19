/**
 * 系统资源采样单测（只测纯计算，IO 由 e2e 覆盖）。
 *
 * 这些函数是"看起来对、实际错"的高发区：CPU 必须两次采样做差、cgroup 的哨兵值
 * （v1 的 limit 极大值、quota=-1）如果当正常值算，会直接显示出一个假的百分比。
 */
import { describe, expect, it } from 'vitest';
import {
  computeCpuUsage,
  computeUsage,
  parseCpuMax,
  parseMemoryLimit,
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
