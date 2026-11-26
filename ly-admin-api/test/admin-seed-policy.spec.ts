/**
 * 超管种子口令治理策略（纯函数单测，无需数据库）。
 *
 * 覆盖三条硬规则：
 * 1. 配置了 SEED_ADMIN_PASSWORD → 用配置值、不强制改密；
 * 2. 生产首启未配置 → 拒绝种子（默认口令不上生产）；
 * 3. 开发环境未配置 → 默认口令 + 强制改密标记（登录后前端强制改密）。
 */
import { decideAdminSeed, DEFAULT_SEED_ADMIN_PASSWORD } from '../src/prisma/admin-seed-policy.js';
import { describe, expect, it } from 'vitest';

describe('decideAdminSeed', () => {
  it('配置了口令：用配置值，不标记强制改密', () => {
    const result = decideAdminSeed({ env: 'production', configured: 'Strong-P@ss-2026', exists: false });
    expect(result).toEqual({ password: 'Strong-P@ss-2026', mustChangePassword: false, refuse: false });
  });

  it('生产首启未配置：拒绝种子', () => {
    const result = decideAdminSeed({ env: 'production', configured: undefined, exists: false });
    expect(result.refuse).toBe(true);
    expect(result.password).toBe('');
  });

  it('生产未配置但账号已存在：放行并标记强制改密（不卡住存量部署）', () => {
    const result = decideAdminSeed({ env: 'production', configured: undefined, exists: true });
    expect(result.refuse).toBe(false);
    expect(result.password).toBe(DEFAULT_SEED_ADMIN_PASSWORD);
    expect(result.mustChangePassword).toBe(true);
  });

  it('开发环境未配置：默认口令 + 强制改密', () => {
    const result = decideAdminSeed({ env: 'development', configured: undefined, exists: false });
    expect(result).toEqual({
      password: DEFAULT_SEED_ADMIN_PASSWORD,
      mustChangePassword: true,
      refuse: false,
    });
  });

  it('空白字符串配置视为未配置', () => {
    const result = decideAdminSeed({ env: 'development', configured: '   ', exists: false });
    expect(result.password).toBe(DEFAULT_SEED_ADMIN_PASSWORD);
    expect(result.mustChangePassword).toBe(true);
  });
});
