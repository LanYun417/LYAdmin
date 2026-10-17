/**
 * class-validator 通用中文文案。
 *
 * 背景：class-validator 在未自定义 message 时会漏出英文默认文案
 * （如 `username must be shorter than or equal to 20 characters`、`roleName must be a string`），
 * 而本项目所有对用户可见的提示都应为中文，故在此统一提供中文文案。
 *
 * 使用约定：
 * - 字段级的关键提示（如"账号不能为空"）仍在各 DTO 内联书写，保证语义精确；
 * - 本模块只承载**次要约束**（取值范围、类型、长度上限等）的通用文案，避免在 7 个 DTO 里
 *   重复写几十遍同样的句子。
 */
export const MSG = {
  /** @IsString */
  isString: '必须为字符串',
  /** @IsNotEmpty */
  notEmpty: '不能为空',
  /** @IsInt */
  isInt: '必须为整数',
  /** @IsArray */
  isArray: '必须为数组',
  /** @IsBoolean */
  isBoolean: '必须为布尔值',
  /** @IsEmail */
  isEmail: '邮箱格式不正确',
  /** @Min(n) */
  min: (n: number): string => `不能小于 ${n}`,
  /** @Max(n) */
  max: (n: number): string => `不能大于 ${n}`,
  /** @MinLength(n) */
  minLength: (n: number): string => `长度不能少于 ${n} 个字符`,
  /** @MaxLength(n) */
  maxLength: (n: number): string => `长度不能超过 ${n} 个字符`,
  /** @ArrayMaxSize(n) */
  arrayMaxSize: (n: number): string => `数量不能超过 ${n} 项`,
  /** @IsInt({ each: true }) */
  eachInt: '列表每项必须为整数',
  /** @Min(n, { each: true }) */
  eachMin: (n: number): string => `列表每项不能小于 ${n}`,
} as const;
