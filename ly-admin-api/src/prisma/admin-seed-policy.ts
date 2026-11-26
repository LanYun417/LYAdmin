/**
 * 超管种子的口令治理策略（纯函数，无 IO、无 Prisma 依赖）。
 *
 * 拆成独立模块的原因：策略判定需要在单测里直接覆盖（生产拒绝默认口令是硬规则），
 * 而 `seed.service.ts` 顶层 import 了 PrismaService → config → JWT 必填校验，
 * 测试 import 它会连带要求 JWT 环境变量。纯函数单独放文件，两边都干净。
 */

/** 种子超管口令的默认值（仅本地开发便利，生产部署必须用 `SEED_ADMIN_PASSWORD` 覆盖）。 */
export const DEFAULT_SEED_ADMIN_PASSWORD = '123456';

/** 口令治理决策输入。 */
export interface AdminSeedDecisionInput {
  /** 运行环境（process.env.NODE_ENV） */
  env: string;
  /** 运维配置的种子口令（process.env.SEED_ADMIN_PASSWORD，未配置为 undefined） */
  configured: string | undefined;
  /** 数据库中是否已存在 admin 账号 */
  exists: boolean;
}

/** 口令治理决策结果。 */
export interface AdminSeedDecision {
  /** 实际使用口令（refuse 时为空串） */
  password: string;
  /** 是否置「登录后强制改密」标记 */
  mustChangePassword: boolean;
  /** 是否拒绝继续种子（生产首启未配置口令） */
  refuse: boolean;
}

/**
 * 超管种子口令决策：
 * - 配置了 `SEED_ADMIN_PASSWORD` → 用配置值，不标记强制改密（运维显式设置的即「已知口令」）；
 * - 未配置：
 *   · 生产环境且账号尚不存在 → **拒绝**：默认弱口令 + 公网可达 = 默认口令事故，
 *     与其启动后补救，不如让部署在第一次启动就失败并提示补齐环境变量；
 *   · 生产环境且账号已存在 → 放行并 warn（存量部署不能被种子升级卡住，账号大概率早已改密）；
 *   · 开发环境 → 用默认口令，但置 `mustChangePassword`，登录时前端强制改密。
 */
export function decideAdminSeed(input: AdminSeedDecisionInput): AdminSeedDecision {
  const configured = input.configured?.trim();
  if (configured) {
    return { password: configured, mustChangePassword: false, refuse: false };
  }
  if (input.env === 'production' && !input.exists) {
    return { password: '', mustChangePassword: false, refuse: true };
  }
  return { password: DEFAULT_SEED_ADMIN_PASSWORD, mustChangePassword: true, refuse: false };
}
