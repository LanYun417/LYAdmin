/**
 * tar 归档参数构造单测（纯函数，无 IO）。
 *
 * 为什么要单测参数：Windows 上 GNU tar 把带盘符的绝对路径（C:\...）当成「主机:路径」
 * 解析，报 `tar (child): Cannot connect to C: resolve failed` 并以退出码 2 失败——
 * 这个坑只在 Windows 暴露，而 CI 跑在 Linux，靠「真机打包」测试钉不住。
 * 因此把参数构造抽成纯函数，用注入 platform 的方式跨平台断言。
 */
import { describe, expect, it } from 'vitest';
import { buildArchiveArgs } from '../src/common/log/file-logger.service.js';

const base = {
  tarPath: 'C:/logs/archive/2026-10-20/2026-10-20.tar.gz',
  workDir: 'C:/logs',
  names: ['app-2026-10-20.log', 'error-2026-10-20.log'],
};

describe('buildArchiveArgs', () => {
  it('win32 下加 --force-local（否则盘符路径被当成远程主机解析）', () => {
    expect(buildArchiveArgs({ ...base, platform: 'win32' })).toEqual([
      '--force-local',
      '-czf',
      base.tarPath,
      '-C',
      base.workDir,
      ...base.names,
    ]);
  });

  it('linux/mac 下不加 --force-local（BSD/bsdtar 不认这个 GNU 选项）', () => {
    for (const platform of ['linux', 'darwin']) {
      const args = buildArchiveArgs({ ...base, platform });
      expect(args).toEqual(['-czf', base.tarPath, '-C', base.workDir, ...base.names]);
      expect(args).not.toContain('--force-local');
    }
  });

  it('未传 platform 时回落到 process.platform', () => {
    const args = buildArchiveArgs(base);
    const expected = process.platform === 'win32' ? ['--force-local'] : [];
    expect(args).toEqual([...expected, '-czf', base.tarPath, '-C', base.workDir, ...base.names]);
  });

  it('--force-local 必须排在 -czf 之前，否则 GNU tar 把它当成待打包文件', () => {
    const args = buildArchiveArgs({ ...base, platform: 'win32' });
    expect(args.indexOf('--force-local')).toBe(0);
    expect(args.indexOf('-czf')).toBe(1);
  });
});
