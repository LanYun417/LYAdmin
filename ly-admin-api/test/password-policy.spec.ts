/**
 * 口令策略单测。
 * 重点锁住「与账号互相包含」这条跨字段规则——它不在 DTO 装饰器里，最容易被后续改动漏掉。
 */
import { describe, expect, it } from 'vitest';
import {
  assertPasswordNotContainsAccount,
  PASSWORD_COMPLEXITY_REGEX,
  PASSWORD_LENGTH_MESSAGE,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../src/common/auth/password-policy.js';

describe('口令策略常量', () => {
  it('长度边界自洽（min ≤ max，且提示文案跟随实际取值）', () => {
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(6);
    expect(PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(PASSWORD_MIN_LENGTH);
    expect(PASSWORD_LENGTH_MESSAGE).toContain(String(PASSWORD_MIN_LENGTH));
    expect(PASSWORD_LENGTH_MESSAGE).toContain(String(PASSWORD_MAX_LENGTH));
  });

  it('复杂度正则要求字母与数字同时出现', () => {
    expect(PASSWORD_COMPLEXITY_REGEX.test('abcd1234')).toBe(true);
    expect(PASSWORD_COMPLEXITY_REGEX.test('abcd_1234')).toBe(true);
    expect(PASSWORD_COMPLEXITY_REGEX.test('abcdefgh')).toBe(false);
    expect(PASSWORD_COMPLEXITY_REGEX.test('12345678')).toBe(false);
  });
});

describe('assertPasswordNotContainsAccount', () => {
  it('口令包含账号 → 400', () => {
    expect(() => assertPasswordNotContainsAccount('admin123', 'admin')).toThrowError(/密码不能包含登录账号/);
  });

  it('账号包含口令 → 400（反向也要拦，防「口令是账号片段」）', () => {
    expect(() => assertPasswordNotContainsAccount('adm', 'administrator')).toThrowError(/密码不能包含登录账号/);
  });

  it('大小写与首尾空白不影响判定', () => {
    expect(() => assertPasswordNotContainsAccount('  ADMIN123  ', 'admin')).toThrowError(/密码不能包含登录账号/);
  });

  it('无包含关系时放行', () => {
    expect(() => assertPasswordNotContainsAccount('Ly_2026pwd', 'zhangsan')).not.toThrow();
  });

  it('账号缺省或为空时跳过检查（如按 id 重置密码只拿到口令）', () => {
    expect(() => assertPasswordNotContainsAccount('anything123', undefined)).not.toThrow();
    expect(() => assertPasswordNotContainsAccount('anything123', '   ')).not.toThrow();
  });
});
