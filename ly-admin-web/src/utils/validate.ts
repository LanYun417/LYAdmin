/**
 * 表单校验工具：常用正则、轻量判定函数与 Element Plus 表单规则。
 * 规则统一允许空值（必填交由 `requiredRule` 或表单 `required` 控制），避免「先报格式错、再报必填错」。
 */
import type { FormItemRule } from 'element-plus';

/** 手机号正则 */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;
/** 邮箱正则 */
export const EMAIL_REGEX = /^[\w.-]+@[\w-]+(\.[\w-]+)+$/;
/** 用户名正则：3-20 位字母、数字、下划线 */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
/**
 * 密码正则：8-20 位，且至少包含字母和数字。
 * 需与后端 `ly-admin-api/src/common/auth/password-policy.ts` 保持一致
 * （后端可用 PASSWORD_MIN_LENGTH / PASSWORD_REQUIRE_COMPLEXITY 调整，前端为固定提示口径）。
 */
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[a-zA-Z0-9_!@#$%^&*.]{8,20}$/;

/** 密码规则提示文案（三处复用，避免各写一份后走样）。 */
export const PASSWORD_MESSAGE = '密码为 8-20 位，且至少包含字母和数字';

/** 是否手机号 */
export function isPhone(value: string): boolean {
  return PHONE_REGEX.test(value);
}

/** 是否邮箱 */
export function isEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/** 是否外部链接 */
export function isExternal(path: string): boolean {
  return /^https?:\/\//.test(path);
}

/** 必填规则 */
export function requiredRule(message = '该项为必填项'): FormItemRule {
  return { required: true, message, trigger: 'blur' };
}

/** 用户名规则 */
export const usernameRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    if (!value) {
      return callback();
    }
    return USERNAME_REGEX.test(String(value)) ? callback() : callback(new Error('用户名为 3-20 位字母、数字或下划线'));
  },
  trigger: 'blur',
};

/** 密码规则 */
export const passwordRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    if (!value) {
      return callback();
    }
    return PASSWORD_REGEX.test(String(value)) ? callback() : callback(new Error(PASSWORD_MESSAGE));
  },
  trigger: 'blur',
};

/** 手机号规则（可空） */
export const phoneRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    if (!value) {
      return callback();
    }
    return PHONE_REGEX.test(String(value)) ? callback() : callback(new Error('手机号格式不正确'));
  },
  trigger: 'blur',
};

/** 邮箱规则（可空） */
export const emailRule: FormItemRule = {
  validator: (_rule, value, callback) => {
    if (!value) {
      return callback();
    }
    return EMAIL_REGEX.test(String(value)) ? callback() : callback(new Error('邮箱格式不正确'));
  },
  trigger: 'blur',
};
