import { describe, expect, it } from 'vitest';
import type { FormItemRule } from 'element-plus';

import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  PHONE_REGEX,
  USERNAME_REGEX,
  emailRule,
  isEmail,
  isExternal,
  isPhone,
  passwordRule,
  requiredRule,
  usernameRule,
} from '@/utils/validate';

/** 把 Element Plus 的 callback 风格校验器包装成 Promise，便于断言。 */
function runValidator(rule: FormItemRule, value: unknown): Promise<Error | null> {
  return new Promise((resolve) => {
    const validator = (rule as { validator?: unknown }).validator as (
      _r: unknown,
      v: unknown,
      cb: (err?: Error) => void,
    ) => void;
    validator(null, value, (err?: Error) => resolve(err ?? null));
  });
}

describe('validate utils', () => {
  describe('regexes', () => {
    it('PHONE_REGEX matches Chinese mobile numbers', () => {
      expect(PHONE_REGEX.test('13800138000')).toBe(true);
      expect(PHONE_REGEX.test('12345')).toBe(false);
      expect(PHONE_REGEX.test('1380013800a')).toBe(false);
    });

    it('EMAIL_REGEX matches basic emails', () => {
      expect(EMAIL_REGEX.test('a@b.com')).toBe(true);
      expect(EMAIL_REGEX.test('a@b')).toBe(false);
      expect(EMAIL_REGEX.test('ab.com')).toBe(false);
    });

    it('USERNAME_REGEX allows 3-20 letters/digits/underscore', () => {
      expect(USERNAME_REGEX.test('abc_123')).toBe(true);
      expect(USERNAME_REGEX.test('ab')).toBe(false);
      expect(USERNAME_REGEX.test('a b')).toBe(false);
    });

    it('PASSWORD_REGEX requires 8-20 with letter and digit', () => {
      expect(PASSWORD_REGEX.test('Abcd1234')).toBe(true);
      expect(PASSWORD_REGEX.test('abcdefgh')).toBe(false);
      expect(PASSWORD_REGEX.test('12345678')).toBe(false);
      expect(PASSWORD_REGEX.test('Ab1')).toBe(false);
    });
  });

  describe('isPhone / isEmail / isExternal', () => {
    it('isPhone', () => {
      expect(isPhone('13800138000')).toBe(true);
      expect(isPhone('123')).toBe(false);
    });
    it('isEmail', () => {
      expect(isEmail('user@domain.com')).toBe(true);
      expect(isEmail('not-an-email')).toBe(false);
    });
    it('isExternal only matches http/https', () => {
      expect(isExternal('https://example.com')).toBe(true);
      expect(isExternal('http://example.com')).toBe(true);
      expect(isExternal('/relative/path')).toBe(false);
      expect(isExternal('ftp://example.com')).toBe(false);
    });
  });

  describe('form rules (callback style)', () => {
    it('requiredRule is required', () => {
      expect(requiredRule('必填').required).toBe(true);
    });

    it('usernameRule accepts valid and rejects invalid', async () => {
      expect(await runValidator(usernameRule, 'abc_123')).toBeNull();
      expect(await runValidator(usernameRule, 'ab')).toBeInstanceOf(Error);
      // 空值放行（必填由 requiredRule 控制）
      expect(await runValidator(usernameRule, '')).toBeNull();
    });

    it('passwordRule accepts valid and rejects invalid', async () => {
      expect(await runValidator(passwordRule, 'Abcd1234')).toBeNull();
      expect(await runValidator(passwordRule, 'abcdefgh')).toBeInstanceOf(Error);
      expect(await runValidator(passwordRule, '')).toBeNull();
    });

    it('emailRule accepts valid and rejects invalid', async () => {
      expect(await runValidator(emailRule, 'a@b.com')).toBeNull();
      expect(await runValidator(emailRule, 'nope')).toBeInstanceOf(Error);
      expect(await runValidator(emailRule, '')).toBeNull();
    });
  });
});
