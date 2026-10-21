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

/**
 * 批量删除结果（与后端 common/utils/batch.ts 的 BatchDeleteResult 对齐）。
 * 刻意不是「全成功/全失败」：批量里被业务护栏挡下的条目要能说清原因。
 */
export interface BatchDeleteSummary {
  /** 实际删除条数 */
  deleted: number;
  /** 被跳过的记录及原因 */
  skipped: Array<{ id: number; name: string; reason: string }>;
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
  /** 是否超级管理员（内置 admin 或持有 super_admin 角色）：不可禁用 / 不可删除 */
  isSuperAdmin?: boolean;
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

/** 用户的菜单权限概况（角色自带 / 额外授予 / 额外撤销 / 最终有效集合）。 */
export interface UserMenuOverview {
  /** 角色自带的菜单 id（基线） */
  roleMenuIds: number[];
  /** 额外授予（在角色之外多加的） */
  grantIds: number[];
  /** 额外撤销（从角色里单独收掉的） */
  revokeIds: number[];
  /** 最终有效菜单 id 集合（= 角色 ∪ 授予 − 撤销，用于回填权限树勾选） */
  effectiveMenuIds: number[];
}

/** 恢复角色默认授权的结果（按种子定义重建菜单授权）。 */
export interface ResetRoleMenusResult {
  /** 成功重建的角色 */
  reset: Array<{ id: number; roleName: string; count: number }>;
  /** 被跳过的角色（含原因，如「非种子角色」） */
  skipped: Array<{ id: number; roleName: string; reason: string }>;
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

/** 部门查询参数 */
export interface DeptQuery {
  deptName?: string;
  status?: number;
  tree?: number;
}

/** 部门新增 / 编辑参数 */
export interface DeptUpsert {
  parentId: number;
  /** 类型：1 部门 / 2 岗位 */
  deptType: number;
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
  /** IP 归属地（ip2region 离线解析，如「中国 广东省 深圳市 电信」；未解析为空串/null） */
  location: string | null;
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
  /**
   * 变更前数据（JSON 文本）。
   * 仅「支持留痕的写操作」会返回内容（用户/角色/部门编辑、系统参数修改），
   * 其余接口为 null —— 不编造数据，前端需按「无留痕」渲染。
   */
  beforeData: string | null;
  /** 变更后数据（JSON 文本），口径同 beforeData */
  afterData: string | null;
  duration: number;
  result: number;
  errorMessage: string | null;
  ip: string | null;
  /** IP 归属地（ip2region 离线解析） */
  location: string | null;
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
  id: number;
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  ip: string;
  /** IP 归属地（ip2region 离线解析，如「中国 广东省 深圳市 电信」；未解析为空串） */
  location?: string;
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
  /** 操作账号前缀匹配（可命中索引） */
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
  /** 业务类型（归属模块标识，如 avatar / notice；null = 无业务归属） */
  bizType: string | null;
  /** 业务主键（关联业务表 id；null = 未指定） */
  bizId: number | null;
  createdAt: string;
  /** 本次保存是否复用了既有物理文件（秒传/去重） */
  deduplicated?: boolean;
}

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
  /** 业务类型（精确匹配；带该条件时才允许叠加 bizId） */
  bizType?: string;
  /** 业务主键 */
  bizId?: number;
}

/* ------------------------------- 用户导入 ------------------------------- */

/** CSV 导入结果 */
export interface UserImportResult {
  /** 数据行总数 */
  total: number;
  /** 成功写入条数（全成功或全不写：非 0 即等于 total） */
  created: number;
  /** 失败明细（为空表示导入成功） */
  failed: Array<{
    /** 文件中的物理行号（含表头，便于定位） */
    line: number;
    /** 该行账号（无法解析时为「第 N 行」） */
    username: string;
    /** 失败原因 */
    message: string;
  }>;
}

/* ------------------------------- 系统监控 ------------------------------- */

/** 系统资源快照（GET /monitor/server） */
export interface ServerMetrics {
  /**
   * 指标口径：
   * - `container`：读的是 cgroup 限制（本服务运行在容器里时的真实可用资源）
   * - `host`：读的是宿主机资源
   *
   * 两者都可能"对"，但含义不同，界面必须显式标出来，否则会出现
   * 「显示 16G 用了 3G，实际容器 512M 就 OOM」这种误导。
   */
  scope: 'container' | 'host';
  cpu: {
    model: string;
    /** 逻辑核数 */
    cores: number;
    /** 总使用率 0~100；首次采样为 null（尚无基线） */
    usage: number | null;
    /** 各核使用率 */
    perCore: Array<number | null>;
    /** 容器 CPU 配额折算核数（如 1.5）；不在容器内为 null */
    quotaCores: number | null;
  };
  memory: {
    /** 字节 */
    used: number;
    total: number;
    usage: number | null;
  };
  disk: {
    /** 被统计的目录（上传目录） */
    path: string;
    used: number;
    total: number;
    usage: number | null;
  };
  /** 1/5/15 分钟平均负载；Windows 恒为 0，不支持时为 null */
  load: [number, number, number] | null;
  /**
   * 网络活动。
   *
   * - Linux（含容器）：读 `/proc/net/dev`，与主采样同频（3s）；
   * - Windows：起子进程查 `Get-NetAdapterStatistics`，因进程启动开销大，采样放宽到 15s；
   * - 其它平台：`supported: false` + `reason`，界面如实显示不支持而不是伪装成 0。
   */
  network: {
    supported: boolean;
    /** 不支持时的原因 */
    reason: string | null;
    /** 数据来源：proc = /proc/net/dev；powershell = Windows 网卡统计 */
    source: 'proc' | 'powershell' | null;
    /** 该来源的采样间隔（毫秒）；Windows 更宽，界面据此解释"为何不是每 5s 变" */
    samplingIntervalMs: number;
    /** 下行 / 上行速率（字节/秒）；首次采样为 null */
    rxRate: number | null;
    txRate: number | null;
    /** 累计流量（字节，自网卡启动） */
    rxTotal: number;
    txTotal: number;
    /** 累计错误 / 丢包 */
    rxErrors: number;
    txErrors: number;
    rxDropped: number;
    txDropped: number;
    /** 每张网卡明细（已排除环回 lo） */
    interfaces: Array<{
      name: string;
      rxRate: number | null;
      txRate: number | null;
      rxTotal: number;
      txTotal: number;
    }>;
  };
  process: {
    /** 常驻内存 */
    rss: number;
    heapUsed: number;
    heapTotal: number;
    /** 进程运行时长（秒） */
    uptime: number;
  };
  system: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    nodeVersion: string;
    /** 镜像构建时注入的应用版本 */
    appVersion: string;
  };
  /** 最近若干个采样点（图表用） */
  history: Array<{
    at: number;
    cpu: number | null;
    memory: number | null;
    /** 下行 / 上行速率（字节/秒）；平台不支持或首次采样为 null */
    rxRate: number | null;
    txRate: number | null;
  }>;
  /** 是否还在预热（首次采样已建立基线但尚无使用率） */
  warmingUp: boolean;
  sampledAt: string;
}

/* ------------------------------- 通知中心 ------------------------------- */

/** 通知类型 */
export type NoticeTypeValue = 1 | 2 | 3;

/** 站内通知 */
export interface NoticeItem {
  id: number;
  title: string;
  /** 纯文本正文（服务端不接受 HTML） */
  content: string;
  /** 1 系统通知 / 2 公告 / 3 安全提醒 */
  noticeType: NoticeTypeValue;
  /** 点击跳转的前端路由（空 = 不跳转） */
  link: string | null;
  /** 0 未读 / 1 已读 */
  isRead: 0 | 1;
  readAt: string | null;
  createdAt: string;
}

/** 通知查询参数 */
export interface NoticeQuery extends PageQuery {
  /** 0 未读 / 1 已读 */
  isRead?: number;
  noticeType?: number;
  title?: string;
}

/** 发布通知入参 */
export interface NoticePublishPayload {
  title: string;
  content: string;
  noticeType: NoticeTypeValue;
  link?: string;
  /** 接收人 id；不传表示发给全部启用中的用户 */
  userIds?: number[];
}

/* ------------------------------- 在线用户 ------------------------------- */

/** 在线会话（GET /monitor/online） */
export interface OnlineSession {
  /** 会话 id（强制下线的入参） */
  sid: string;
  userId: number;
  username: string;
  nickname: string;
  ip: string;
  /** IP 归属地（ip2region 离线解析，失败为空串） */
  location: string;
  /** 原始 User-Agent */
  userAgent: string;
  /** 解析后的浏览器 */
  browser: string;
  /** 解析后的操作系统 */
  os: string;
  /** 登录时间（ISO 8601） */
  loginAt: string;
  /** 最后活跃时间（令牌最近一次刷新的时间） */
  lastSeenAt: string;
}

/** 在线用户查询参数 */
export interface OnlineQuery extends PageQuery {
  /** 账号（包含匹配） */
  username?: string;
  /** 登录 IP（精确匹配） */
  ip?: string;
}

/** 上传配额（GET /files/quota） */
export interface FileQuota {
  /** 已用字节 */
  usedBytes: number;
  /** 配额字节（unlimited 为 true 时该值无意义） */
  quotaBytes: number;
  /** 是否不限量（UPLOAD_USER_QUOTA_MB=0） */
  unlimited: boolean;
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
  /** 图形验证码 id（GET /auth/captcha 获取） */
  captchaId?: string;
  /** 用户输入的验证码 */
  captchaCode?: string;
}

/** 登录返回 */
export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: UserBrief;
}

/** 登录图形验证码 */
export interface CaptchaResult {
  /** 是否启用验证码（关闭时为 false，前端隐藏输入项） */
  enabled: boolean;
  /** 验证码 id（随登录请求回传） */
  captchaId: string | null;
  /** 验证码图片（PNG data URL） */
  image: string | null;
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

/* ------------------------------- 定时任务 ------------------------------- */

/** 定时任务执行状态（与后端 TaskRunStatus 对齐） */
export type TaskRunStatusValue = 0 | 1 | 2;

/** 定时任务触发方式（与后端 TaskTrigger 对齐） */
export type TaskTriggerValue = 1 | 2;

/** 单次任务执行摘要 */
export interface TaskRunSummary {
  /** 0 执行中 / 1 成功 / 2 失败 */
  status: TaskRunStatusValue;
  /** 1 自动（cron）/ 2 手动 */
  trigger: TaskTriggerValue;
  /** 开始时间 */
  startedAt: string;
  /** 结束时间（执行中为 null） */
  finishedAt: string | null;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 失败原因 */
  errorMessage: string | null;
  /** 手动触发人账号（自动触发为 null） */
  operator: string | null;
}

/** 定时任务列表项 */
export interface TaskItem {
  /** 任务标识 */
  name: string;
  /** 任务名称 */
  title: string;
  /** 任务说明 */
  description: string;
  /** cron 表达式（6 位：秒 分 时 日 月 周） */
  cron: string;
  /** 是否启用 */
  enabled: boolean;
  /** 下次执行时间（已停用为 null） */
  nextRunAt: string | null;
  /** 是否正在执行中 */
  running: boolean;
  /** 上次执行摘要（从未执行过为 null） */
  lastRun: TaskRunSummary | null;
}

/** 任务执行记录列表项 */
export interface TaskLogItem extends TaskRunSummary {
  id: number;
  /** 任务标识 */
  taskName: string;
  /** 任务名称（快照） */
  taskTitle: string;
}

/** 任务执行记录查询参数 */
export interface TaskLogQuery extends PageQuery {
  /** 0 执行中 / 1 成功 / 2 失败 */
  status?: number;
  /** 1 自动 / 2 手动 */
  trigger?: number;
}

/** 手动执行结果 */
export interface TaskRunResult {
  /** 任务标识 */
  name: string;
  /** 任务名称 */
  title: string;
  /** 1 成功 / 2 失败 */
  status: TaskRunStatusValue;
  /** 耗时（毫秒） */
  durationMs: number;
  /** 失败原因 */
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string;
}
