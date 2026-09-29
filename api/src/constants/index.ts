/**
 * 全局常量：业务错误码、枚举、正则、白名单。
 * 模块职责：集中管理跨模块共享的魔法值与枚举，避免散落硬编码。
 */

/** 业务错误码（与第 6.2 节错误码表一一对应）。 */
export const ERROR_CODE = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

/** 统一提示文案。 */
export const ERROR_MESSAGE = {
  SUCCESS: 'success',
  BAD_REQUEST: '参数校验失败',
  UNAUTHORIZED: '未认证或登录已失效',
  LOGIN_FAILED: '账号或密码错误',
  ACCOUNT_DISABLED: '账号已被禁用',
  PASSWORD_CHANGED: '密码已变更，请重新登录',
  LOGOUT_INVALIDATED: '您已退出登录，请重新登录',
  FORBIDDEN: '无访问权限',
  NOT_FOUND: '资源不存在',
  CONFLICT: '数据已存在',
  TOO_MANY_REQUESTS: '请求过于频繁，请稍后再试',
  INTERNAL: '服务器内部错误',
} as const;

/** 通用状态枚举：1 启用/成功，0 禁用/失败。 */
export enum Status {
  DISABLED = 0,
  ENABLED = 1,
}

/** 菜单类型：M 目录 / C 菜单 / F 按钮。 */
export enum MenuType {
  DIRECTORY = 'M',
  MENU = 'C',
  BUTTON = 'F',
}

/** 日志结果：1 成功 / 0 失败。 */
export enum LogResult {
  FAIL = 0,
  SUCCESS = 1,
}

/** 超级管理员角色编码（不受权限裁剪）。 */
export const SUPER_ADMIN_ROLE = 'super_admin';

/**
 * 数据权限范围（RBAC 增强）。
 * - ALL：本人可看全部数据
 * - CUSTOM：仅看「自定义部门」及其下级
 * - DEPT_AND_CHILD：仅看「本部门及以下」
 * - SELF：仅看本人数据
 */
export enum DataScope {
  ALL = 1,
  CUSTOM = 2,
  DEPT_AND_CHILD = 3,
  SELF = 4,
}

/** 常用正则。 */
export const REGEX = {
  /** 账号：3~20 位字母/数字/下划线 */
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  /** 密码：6~20 位非空白字符 */
  PASSWORD: /^\S{6,20}$/,
  /** 手机号（中国大陆） */
  PHONE: /^1[3-9]\d{9}$/,
  /** 邮箱 */
  EMAIL: /^[\w.-]+@[\w-]+(\.[\w-]+)+$/,
} as const;

/** 密码类敏感字段名，日志中需脱敏。 */
export const SENSITIVE_KEYS = ['password', 'oldPassword', 'newPassword', 'confirmPassword'];

/** 上传允许的 MIME 类型白名单。 */
export const UPLOAD_ALLOWED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
];

/** 上传允许的扩展名白名单。 */
export const UPLOAD_ALLOWED_EXT = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.zip',
];

/** 分页默认值。 */
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
} as const;
