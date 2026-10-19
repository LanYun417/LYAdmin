/**
 * 共享类型定义（后端内部）。
 * 模块职责：集中声明跨层复用的 TypeScript 接口与类型别名。
 */

/** JWT 载荷中的用户基础信息。 */
export interface JwtUserPayload {
  userId: number;
  username: string;
}

/** 解码后的 JWT 载荷（含签发/过期时间戳，单位秒）。 */
export interface JwtPayload extends JwtUserPayload {
  iat: number;
  exp: number;
  /**
   * 会话 id（登录时生成，access / refresh 共用同一个值）。
   *
   * 用途：在线会话列表把「一次登录」聚合成一条记录，强制下线即删除该会话记录，
   * 携带同一 sid 的令牌随后会被鉴权守卫判定为已失效——比按 jti（每次刷新都会变）
   * 精确，也不用给每个令牌单独维护黑名单。
   * 旧令牌没有该字段，守卫会跳过会话校验（向后兼容）。
   */
  sid?: string;
}

/** 鉴权后挂载到请求上下文的用户信息。 */
export interface AuthUserContext extends JwtUserPayload {
  roles: string[];
  permissions: string[];
  status: number;
  /** 当前用户所属部门 id（0 表示未分配，用于数据权限计算） */
  deptId: number;
  /** 当前用户所属部门名称（未分配为 null），用于个人中心展示与 HTTP 日志快照 */
  deptName: string | null;
  /** 令牌签发时间（秒），用于登出黑名单与改密失效判定 */
  tokenIat?: number;
}

/** 鉴权上下文（含完整用户字段，供 /auth/profile 直接复用，避免二次查库）。 */
export interface AuthContext {
  userId: number;
  username: string;
  roleCodes: string[];
  permissions: string[];
  status: number;
  deptId: number;
  deptName: string | null;
  /** 密码最后修改时间（改密后旧 Token 失效判定） */
  passwordChangedAt: Date | null;
  avatar: string | null;
  nickname: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  lastLoginAt: Date | null;
  remark: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 分页响应结构。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 树节点基础结构。 */
export interface TreeItem {
  id: number;
  parentId: number;
  sort?: number;
}

/** 部门树节点。 */
export interface DeptNode {
  id: number;
  parentId: number;
  /** 类型：1 部门 / 2 岗位 */
  deptType: number;
  deptName: string;
  sort: number;
  status: number;
  leader: string | null;
  phone: string | null;
  email: string | null;
  children?: DeptNode[];
}

/** 菜单树节点。 */
export interface MenuNode {
  id: number;
  parentId: number;
  menuName: string;
  menuType: string;
  path: string | null;
  component: string | null;
  icon: string | null;
  permission: string | null;
  sort: number;
  visible: number;
  status: number;
  redirect: string | null;
  keepAlive: number;
  children?: MenuNode[];
}

/** 用户简要信息（对外返回，不含敏感字段）。 */
export interface UserBrief {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  /** 性别（字典 sys_user_sex 的值） */
  gender: string | null;
  status: number;
  /** 部门 id（0 表示未分配） */
  deptId: number;
  /** 部门名称（冗余展示，未分配时为空） */
  deptName: string | null;
  lastLoginAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

/** 用户详情（含角色信息）。 */
export interface UserDetail extends UserBrief {
  remark: string | null;
  /** 是否超级管理员（内置 admin 账号，或持有 super_admin 角色） */
  isSuperAdmin: boolean;
  /** 角色对象数组（含 id 与名称） */
  roles: Array<{ id: number; roleName: string }>;
}

/** 登录图形验证码。 */
export interface CaptchaResult {
  enabled: boolean;
  captchaId: string | null;
  image: string | null;
}

/** 仪表盘统计卡片。 */
export interface DashboardStats {
  userTotal: number;
  roleTotal: number;
  menuTotal: number;
  todayLoginCount: number;
}

/** 带 children 的树节点。 */
export type WithChildren<T> = T & { children: WithChildren<T>[] };
