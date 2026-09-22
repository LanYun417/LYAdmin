/**
 * 统一响应体、分页与各实体 DTO 类型定义。
 * 与架构文档第 5 节「接口清单」、第 6 节「统一约定」严格对齐。
 */

/** 统一响应体 */
export interface ApiResponse<T = unknown> {
  /** 业务码，200 表示成功 */
  code: number;
  /** 提示信息 */
  message: string;
  /** 业务数据 */
  data: T;
}

/** 分页响应体 */
export interface PageResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 分页请求基类 */
export interface PageQuery {
  /** 页码，从 1 开始 */
  page: number;
  /** 每页条数 */
  pageSize: number;
}

/* ------------------------------- 用户 ------------------------------- */

/** 用户简要信息 */
export interface UserBrief {
  id: number;
  username: string;
  nickname: string;
  avatar: string | null;
  email?: string | null;
  phone?: string | null;
  status?: number;
}

/** 用户详情 */
export interface UserDetail extends UserBrief {
  email: string | null;
  phone: string | null;
  status: number;
  lastLoginAt?: string | null;
  remark?: string | null;
  roleIds?: number[];
  roles?: RoleBrief[];
  createdAt?: string;
  updatedAt?: string;
}

/** 用户分页查询参数 */
export interface UserQuery extends PageQuery {
  username?: string;
  status?: number;
}

/** 用户新增 / 编辑参数 */
export interface UserUpsert {
  username?: string;
  password?: string;
  nickname: string;
  email?: string;
  phone?: string;
  status: number;
  roleIds: number[];
  remark?: string;
}

/* ------------------------------- 角色 ------------------------------- */

/** 角色简要信息（下拉用） */
export interface RoleBrief {
  id: number;
  roleName: string;
  roleCode: string;
}

/** 角色详情 */
export interface Role extends RoleBrief {
  sort: number;
  status: number;
  remark?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 角色分页查询参数 */
export interface RoleQuery extends PageQuery {
  roleName?: string;
  status?: number;
}

/** 角色新增 / 编辑参数 */
export interface RoleUpsert {
  roleName: string;
  roleCode?: string;
  sort: number;
  status: number;
  remark?: string;
}

/* ------------------------------- 菜单 ------------------------------- */

/** 菜单类型：M 目录 / C 菜单 / F 按钮 */
export type MenuType = 'M' | 'C' | 'F';

/** 菜单实体 */
export interface Menu {
  id: number;
  parentId: number;
  menuName: string;
  menuType: MenuType;
  path?: string | null;
  component?: string | null;
  icon?: string | null;
  permission?: string | null;
  sort: number;
  visible: number;
  status: number;
  redirect?: string | null;
  keepAlive: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 菜单树节点 */
export interface MenuNode extends Menu {
  children?: MenuNode[];
}

/** 菜单查询参数 */
export interface MenuQuery {
  menuName?: string;
  status?: number;
  tree?: number;
}

/** 菜单新增 / 编辑参数 */
export interface MenuUpsert {
  parentId: number;
  menuName: string;
  menuType: MenuType;
  path?: string;
  component?: string;
  icon?: string;
  permission?: string;
  sort: number;
  visible: number;
  status: number;
  redirect?: string;
  keepAlive: number;
}

/* ------------------------------- 日志 ------------------------------- */

/** 登录日志 */
export interface LoginLog {
  id: number;
  username: string;
  ip: string | null;
  userAgent: string | null;
  status: number;
  message: string | null;
  loginAt: string;
}

/** 登录日志查询参数 */
export interface LoginLogQuery extends PageQuery {
  username?: string;
  status?: number;
  startTime?: string;
  endTime?: string;
}

/** 操作日志 */
export interface OperationLog {
  id: number;
  userId: number | null;
  username: string | null;
  module: string;
  action: string;
  method: string;
  url: string;
  params: string | null;
  duration: number;
  result: number;
  errorMessage: string | null;
  ip: string | null;
  createdAt: string;
}

/** 操作日志查询参数 */
export interface OperationLogQuery extends PageQuery {
  module?: string;
  username?: string;
  result?: number;
  startTime?: string;
  endTime?: string;
}

/** HTTP 访问日志 */
export interface HttpLog {
  id?: number;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  time: string;
}

/** HTTP 日志查询参数 */
export interface HttpLogQuery extends PageQuery {
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
}

/* ------------------------------- 文件 ------------------------------- */

/** 文件实体 */
export interface FileItem {
  id: number;
  originName: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  uploaderId: number | null;
  createdAt: string;
}

/** 文件查询参数 */
export interface FileQuery extends PageQuery {
  originName?: string;
}

/* ------------------------------ 仪表盘 ------------------------------ */

/** 统计卡片 */
export interface DashboardStats {
  userTotal: number;
  roleTotal: number;
  menuTotal: number;
  todayLoginCount: number;
}

/** 登录趋势 */
export interface LoginTrend {
  dates: string[];
  counts: number[];
}

/** 名称-数值对（饼图） */
export interface NameValue {
  name: string;
  value: number;
}

/** 各角色用户数（柱状图） */
export interface RoleUserCount {
  names: string[];
  counts: number[];
}

/* ------------------------------- 认证 ------------------------------- */

/** 登录参数 */
export interface LoginParams {
  username: string;
  password: string;
}

/** 登录返回 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

/** 刷新 Token 返回 */
export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

/** 当前用户信息返回 */
export interface ProfileResult {
  user: UserDetail;
  roles: string[];
  permissions: string[];
}

/** 修改资料参数 */
export interface ProfileUpdateParams {
  nickname: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

/** 修改密码参数 */
export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
