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
  /** 性别（字典 sys_user_sex 的值：1 男 / 2 女 / 0 未知） */
  gender?: string | null;
  status?: number;
  /** 部门 id（0 表示未分配） */
  deptId?: number;
  /** 部门名称（未分配时为空） */
  deptName?: string | null;
}

/** 用户详情 */
export interface UserDetail extends UserBrief {
  email: string | null;
  phone: string | null;
  status: number;
  lastLoginAt?: string | null;
  remark?: string | null;
  roles?: RoleBrief[];
  createdAt?: string;
  updatedAt?: string;
}

/** 用户分页查询参数 */
export interface UserQuery extends PageQuery {
  username?: string;
  status?: number;
  deptId?: number;
}

/** 用户新增 / 编辑参数 */
export interface UserUpsert {
  username?: string;
  password?: string;
  nickname: string;
  email?: string;
  phone?: string;
  /** 性别（字典 sys_user_sex 的值），空串表示未设置 */
  gender?: string;
  status: number;
  roleIds: number[];
  /** 部门 id（0 表示未分配） */
  deptId?: number;
  remark?: string;
}

/* ------------------------------- 角色 ------------------------------- */

/** 角色简要信息（下拉用） */
export interface RoleBrief {
  id: number;
  roleName: string;
  roleCode: string;
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope?: number;
  /** 自定义部门 id 列表（仅 dataScope=2 时非空） */
  deptIds?: number[];
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
  /** 数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人 */
  dataScope?: number;
  /** 自定义部门 id 列表（dataScope=2 时生效） */
  deptIds?: number[];
  remark?: string;
}

/** 数据权限范围选项（1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人） */
export const DATA_SCOPE_OPTIONS = [
  { value: 1, label: '全部数据' },
  { value: 2, label: '自定义部门' },
  { value: 3, label: '本部门及以下' },
  { value: 4, label: '仅本人' },
] as const;

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

/* ------------------------------- 部门 ------------------------------- */

/** 部门树节点 */
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

/** 部门查询参数 */
export interface DeptQuery {
  deptName?: string;
  status?: number;
  tree?: number;
}

/** 部门新增 / 编辑参数 */
export interface DeptUpsert {
  parentId: number;
  deptName: string;
  leader?: string;
  phone?: string;
  email?: string;
  sort: number;
  status: number;
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
  /** 原始 User-Agent（列表 tooltip 展示） */
  userAgent?: string;
  /** 操作用户 id（0 表示匿名 / 未登录） */
  userId?: number;
  /** 操作账号快照，空串表示匿名 */
  username?: string;
  /** 所属部门 id 快照（0 表示无部门） */
  deptId?: number;
  /** 所属部门名称快照 */
  deptName?: string;
  /** 浏览器名称 + 版本（未识别为空串） */
  browser?: string;
  /** 操作系统名称 + 版本（未识别为空串） */
  os?: string;
  /** 请求查询参数（已脱敏） */
  query?: Record<string, unknown> | null;
  /** 请求体（已脱敏、截断） */
  reqBody?: string | null;
  /** 响应内容（已截断；二进制为占位说明） */
  resBody?: string | null;
}

/** HTTP 日志查询参数 */
export interface HttpLogQuery extends PageQuery {
  method?: string;
  statusCode?: number;
  startTime?: string;
  endTime?: string;
  /** 操作账号模糊匹配 */
  username?: string;
  /** 所属部门 id（0 表示无部门） */
  deptId?: number;
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
  hash?: string | null;
  uploaderId: number | null;
  createdAt: string;
  /** 本次保存是否复用了既有物理文件（秒传/去重） */
  deduplicated?: boolean;
}

/** 文件查询参数 */
/** 文件查询参数（多条件 AND 组合） */
export interface FileQuery extends PageQuery {
  originName?: string;
  /** 文件类型（MIME）精确匹配；可选值由 GET /files/types 动态提供，不硬编码 */
  mimeType?: string;
  /** 上传人 id；可选值由 GET /files/uploaders 动态提供 */
  uploaderId?: number;
  /** 上传时间起（ISO 8601） */
  startTime?: string;
  /** 上传时间止（ISO 8601） */
  endTime?: string;
  /** 最小文件大小（字节） */
  minSize?: number;
  /** 最大文件大小（字节） */
  maxSize?: number;
}

/** 上传人选项（库内去重 + 关联用户表，动态生成） */
export interface FileUploaderOption {
  id: number;
  username: string;
  nickname: string;
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

/* ------------------------------- 字典 ------------------------------- */

/** 字典类型（= 字典分类 / 分组） */
export interface DictType {
  id: number;
  dictName: string;
  /** 字典类型编码（业务引用键，创建后不可修改） */
  dictType: string;
  status: number;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 字典类型查询参数 */
export interface DictTypeQuery extends PageQuery {
  dictName?: string;
  dictType?: string;
  status?: number;
}

/** 字典类型新增 / 编辑参数（编辑时不提交 dictType） */
export interface DictTypeUpsert {
  dictName: string;
  dictType?: string;
  status: number;
  remark?: string;
}

/** 字典项 */
export interface DictItem {
  id: number;
  dictType: string;
  /** 标签（展示文案） */
  dictLabel: string;
  /** 值（业务存储值） */
  dictValue: string;
  sort: number;
  status: number;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 字典项查询参数（dictType 必填） */
export interface DictItemQuery extends PageQuery {
  dictType: string;
  dictLabel?: string;
  status?: number;
}

/** 字典项新增 / 编辑参数（编辑时不提交 dictType） */
export interface DictItemUpsert {
  dictType?: string;
  dictLabel: string;
  dictValue: string;
  sort: number;
  status: number;
  remark?: string;
}

/** 业务字典数据项（按类型取，仅标签与值） */
export interface DictDataItem {
  label: string;
  value: string;
}

/* ------------------------------- 参数 ------------------------------- */

/** 系统参数 */
export interface SysConfigItem {
  id: number;
  configName: string;
  /** 参数键名（业务引用键，创建后不可修改） */
  configKey: string;
  configValue: string;
  /** 是否内置：1 内置（禁止删除）/ 0 自定义 */
  systemFlag: number;
  remark: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** 参数分页查询参数 */
export interface ConfigQuery extends PageQuery {
  configName?: string;
  configKey?: string;
}

/** 参数新增 / 编辑参数（编辑时不提交 configKey） */
export interface ConfigUpsert {
  configName: string;
  configKey?: string;
  configValue: string;
  remark?: string;
}

/** 业务侧按键取参（键值对） */
export interface ConfigData {
  configKey: string;
  configValue: string;
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
  /** 性别（字典 sys_user_sex 的值），空串表示未设置 */
  gender?: string;
  avatar?: string;
}

/** 修改密码参数 */
export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
  confirmPassword: string;
}
