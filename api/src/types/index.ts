/**
 * 共享类型定义。
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
}

/** 鉴权后挂载到 `req.user` 的上下文。 */
export interface AuthUserContext extends JwtUserPayload {
  roles: string[];
  permissions: string[];
  status: number;
  /** 当前用户所属部门 id（0 表示未分配，用于数据权限计算） */
  deptId: number;
  /** 当前用户所属部门名称（未分配为 null），用于个人中心展示与 HTTP 日志快照 */
  deptName: string | null;
}

/** 分页请求参数。 */
export interface PageQuery {
  page: number;
  pageSize: number;
}

/** 分页响应结构（统一约定 6.3）。 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 树节点基础结构。 */
export interface TreeNodeBase {
  id: number;
  parentId: number;
  children?: TreeNodeBase[];
}

/** 部门树节点。 */
export interface DeptNode {
  id: number;
  parentId: number;
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

/** 服务层统一返回包装（预留扩展）。 */
export interface ServiceResult<T> {
  data: T;
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
  /** 角色对象数组（含 id 与名称），替代原先的 roleIds/roleNames 平行数组 */
  roles: Array<{ id: number; roleName: string }>;
}

/** 仪表盘统计卡片。 */
export interface DashboardStats {
  userTotal: number;
  roleTotal: number;
  menuTotal: number;
  todayLoginCount: number;
}
