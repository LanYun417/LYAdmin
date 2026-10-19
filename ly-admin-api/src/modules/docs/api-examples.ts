/**
 * 接口响应示例库（契约补充）。
 * 模块职责：为 `GET /api/docs` 提供**响应示例**。
 *
 * 为什么要单独维护：
 * 请求侧（curl / 路径参数 / 查询 / 请求体）可由 `scripts/gen-api-docs.mjs` 扫描 DTO 自动合成，
 * 但响应体是 service 在运行时现场拼装的对象，源码里没有可直接反射出的结构，
 * 因此这里的示例按「`METHOD /path`」显式登记，属于对外契约的一部分（改动响应结构需同步这里）。
 *
 * 约定：全部走统一信封 `{ code, message, data }`；文件流类接口给出「响应为文件」的文字说明。
 * 未登记的接口由 {@link responseExampleOf} 按 HTTP 方法给出兜底示例，不会出现空白。
 */

/** 成功业务码。 */
const OK = 200;

/** 统一响应信封。 */
function envelope<T>(data: T, message = 'success'): { code: number; message: string; data: T } {
  return { code: OK, message, data };
}

/** 分页响应信封（键集合固定：list / total / page / pageSize）。 */
function paged<T>(list: T[]): ReturnType<typeof envelope> {
  return envelope({ list, total: list.length, page: 1, pageSize: 10 });
}

/** 文件流类接口的响应说明（非 JSON）。 */
function stream(note: string): string {
  return `（响应为文件流，不是 JSON）${note}`;
}

/* ------------------------------- 实体示例 ------------------------------- */

/** 用户简要信息（列表项）。 */
const USER_BRIEF = {
  id: 1,
  username: 'admin',
  nickname: '超级管理员',
  avatar: null,
  email: 'admin@example.com',
  phone: null,
  gender: '1',
  deptId: 0,
  deptName: null,
};

/** 用户详情。 */
const USER_DETAIL = {
  ...USER_BRIEF,
  status: 1,
  lastLoginAt: '2026-10-18 09:30:00',
  remark: null,
  roles: [{ id: 1, roleName: '超级管理员' }],
  createdAt: '2026-10-16 10:00:00',
  updatedAt: '2026-10-18 09:30:00',
};

/** 角色（下拉）。 */
const ROLE_BRIEF = { id: 2, roleName: '普通管理员', roleCode: 'admin', dataScope: 1, deptIds: [] };

/** 菜单节点。 */
const MENU_NODE = {
  id: 1,
  parentId: 0,
  menuName: '用户管理',
  menuType: 'C',
  path: '/system/user',
  component: 'system/user/index',
  icon: 'person',
  permission: 'system:user:list',
  sort: 1,
  visible: 1,
  status: 1,
  redirect: null,
  keepAlive: 1,
  children: [],
};

/** 部门节点。 */
const DEPT_NODE = {
  id: 1,
  parentId: 0,
  deptName: '总公司',
  sort: 1,
  status: 1,
  leader: '张三',
  phone: '13800138000',
  email: 'dept@example.com',
  children: [],
};

/** 字典类型 / 字典项 / 业务字典项。 */
const DICT_TYPE = {
  id: 1,
  dictName: '用户性别',
  dictType: 'sys_user_sex',
  status: 1,
  remark: null,
  createdAt: '2026-10-16 10:00:00',
  updatedAt: '2026-10-16 10:00:00',
};
const DICT_ITEM = {
  id: 1,
  dictType: 'sys_user_sex',
  dictLabel: '男',
  dictValue: '1',
  sort: 1,
  status: 1,
  remark: null,
  createdAt: '2026-10-16 10:00:00',
  updatedAt: '2026-10-16 10:00:00',
};

/** 系统参数 / 按键取参。 */
const SYS_CONFIG = {
  id: 1,
  configName: '登录失败锁定阈值',
  configKey: 'sys.account.maxLoginAttempts',
  configValue: '5',
  systemFlag: 1,
  remark: null,
  createdAt: '2026-10-16 10:00:00',
  updatedAt: '2026-10-16 10:00:00',
};

/** 登录 / 操作 / HTTP 日志。 */
const LOGIN_LOG = {
  id: 1,
  username: 'admin',
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  status: 1,
  message: null,
  loginAt: '2026-10-18 09:30:00',
};
const OPERATION_LOG = {
  id: 1,
  userId: 1,
  username: 'admin',
  module: '用户管理',
  action: '新增',
  method: 'POST',
  url: '/api/users',
  params: '{"username":"zhangsan"}',
  duration: 42,
  result: 1,
  errorMessage: null,
  ip: '127.0.0.1',
  createdAt: '2026-10-18 09:31:00',
};
const HTTP_LOG = {
  id: 1,
  method: 'GET',
  url: '/api/users?page=1&pageSize=10',
  statusCode: 200,
  duration: 12,
  ip: '127.0.0.1',
  time: '2026-10-18 09:32:00',
  userAgent: 'Mozilla/5.0',
  userId: 1,
  username: 'admin',
  deptId: 0,
  deptName: null,
  browser: 'Chrome 120',
  os: 'Windows 10',
  query: { page: '1', pageSize: '10' },
};

/** 文件。 */
const FILE_ITEM = {
  id: 1,
  originName: 'demo.png',
  fileName: '20261018/demo.png',
  filePath: '20261018/demo.png',
  fileUrl: '/static/20261018/demo.png',
  mimeType: 'image/png',
  size: 20480,
  uploaderId: 1,
  createdAt: '2026-10-18 09:33:00',
};

/* ------------------------------ 示例登记表 ------------------------------ */

/** `METHOD /path` → 响应示例。未命中的接口走 {@link responseExampleOf} 的兜底。 */
export const RESPONSE_EXAMPLES: Record<string, unknown> = {
  /* 健康检查与接口文档 */
  'GET /api': envelope({
    name: 'ly-admin-api',
    status: 'ok',
    time: '2026-10-18T01:30:00.000Z',
    version: '1.0.0',
    uptime: 3600,
  }),
  'GET /api/health/live': envelope({
    name: 'ly-admin-api',
    status: 'ok',
    version: '1.0.0',
    commit: 'fc52757',
    env: 'production',
    uptime: 3600,
    time: '2026-10-18T01:30:00.000Z',
  }),
  'GET /api/health/ready': envelope({
    name: 'ly-admin-api',
    status: 'ready',
    version: '1.0.0',
    commit: 'fc52757',
    env: 'production',
    uptime: 3600,
    time: '2026-10-18T01:30:00.000Z',
    checks: { db: { status: 'up', latencyMs: 2 }, redis: { status: 'up', latencyMs: 1 } },
  }),

  /* 认证 */
  'GET /api/auth/captcha': envelope({
    enabled: true,
    captchaId: 'b7f3c1a2-0000-4a1b-9c3d-8e6f5a4b3c2d',
    image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA…',
  }),
  'POST /api/auth/login': envelope(
    {
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
      refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…',
      user: USER_BRIEF,
    },
    '登录成功',
  ),
  'POST /api/auth/refresh': envelope({ accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…' }),
  'POST /api/auth/logout': envelope(null),
  'GET /api/auth/profile': envelope({ user: USER_DETAIL, roles: ['super_admin'], permissions: ['*'] }),
  'GET /api/auth/menus': envelope([
    {
      ...MENU_NODE,
      children: [{ ...MENU_NODE, id: 2, menuName: '角色管理', path: '/system/role', component: 'system/role/index' }],
    },
  ]),
  'GET /api/auth/permissions': envelope(['system:user:list', 'system:user:query']),

  /* 仪表盘 */
  'GET /api/dashboard/stats': envelope({ userTotal: 12, roleTotal: 3, menuTotal: 56, todayLoginCount: 18 }),
  'GET /api/dashboard/login-trend': envelope({
    dates: ['2026-10-16', '2026-10-17', '2026-10-18'],
    counts: [11, 18, 7],
  }),
  'GET /api/dashboard/operation-distribution': envelope([
    { name: '新增', value: 42 },
    { name: '编辑', value: 18 },
    { name: '删除', value: 6 },
  ]),
  'GET /api/dashboard/role-user-count': envelope({ names: ['超级管理员', '普通管理员'], counts: [1, 11] }),

  /* 用户管理 */
  'GET /api/users': paged([USER_BRIEF]),
  'GET /api/users/:id': envelope(USER_DETAIL),
  'POST /api/users': envelope(USER_BRIEF, '新增成功'),
  'PUT /api/users/:id': envelope(USER_BRIEF, '编辑成功'),
  'DELETE /api/users/:id': envelope(null, '删除成功'),
  // 批量删除返回「成功条数 + 被跳过明细」，不是全成功/全失败
  'DELETE /api/users': envelope(
    {
      deleted: 3,
      skipped: [{ id: 1, name: 'admin', reason: '不能删除当前登录账号' }],
    },
    '已删除 3 条',
  ),
  'PUT /api/users/:id/status': envelope(null, '状态更新成功'),
  'PUT /api/users/:id/password': envelope(null, '密码重置成功'),
  'PUT /api/users/:id/roles': envelope(null, '角色分配成功'),

  /* 角色管理 */
  'GET /api/roles': paged([ROLE_BRIEF]),
  'GET /api/roles/all': envelope([ROLE_BRIEF]),
  'GET /api/roles/:id/menus': envelope([1, 2, 3]),
  'POST /api/roles': envelope(ROLE_BRIEF, '新增成功'),
  'PUT /api/roles/:id': envelope(ROLE_BRIEF, '编辑成功'),
  'DELETE /api/roles/:id': envelope(null, '删除成功'),
  'DELETE /api/roles': envelope(
    {
      deleted: 3,
      skipped: [{ id: 1, name: 'admin', reason: '不能删除当前登录账号' }],
    },
    '已删除 3 条',
  ),
  'PUT /api/roles/:id/menus': envelope(null, '授权成功'),

  /* 菜单管理 */
  'GET /api/menus': paged([MENU_NODE]),
  'GET /api/menus/tree': envelope([MENU_NODE]),
  'GET /api/menus/:id': envelope(MENU_NODE),
  'POST /api/menus': envelope(MENU_NODE),
  'PUT /api/menus/:id': envelope(MENU_NODE),
  'DELETE /api/menus/:id': envelope(null),

  /* 部门管理 */
  'GET /api/depts': paged([DEPT_NODE]),
  'GET /api/depts/tree': envelope([DEPT_NODE]),
  'GET /api/depts/:id': envelope(DEPT_NODE),
  'POST /api/depts': envelope(DEPT_NODE, '新增成功'),
  'PUT /api/depts/:id': envelope(DEPT_NODE, '编辑成功'),
  'DELETE /api/depts/:id': envelope(null, '删除成功'),

  /* 字典管理 */
  'GET /api/dict/types': paged([DICT_TYPE]),
  'GET /api/dict/items': paged([DICT_ITEM]),
  'GET /api/dict/data/:dictType': envelope([
    { label: '男', value: '1' },
    { label: '女', value: '2' },
  ]),
  'POST /api/dict/types': envelope(DICT_TYPE, '新增成功'),
  'PUT /api/dict/types/:id': envelope(DICT_TYPE, '编辑成功'),
  'PUT /api/dict/types/:id/status': envelope(DICT_TYPE, '已启用'),
  'DELETE /api/dict/types/:id': envelope(null, '删除成功'),
  'DELETE /api/dict/types': envelope(
    {
      deleted: 3,
      skipped: [{ id: 1, name: 'admin', reason: '不能删除当前登录账号' }],
    },
    '已删除 3 条',
  ),
  'POST /api/dict/items': envelope(DICT_ITEM, '新增成功'),
  'PUT /api/dict/items/:id': envelope(DICT_ITEM, '编辑成功'),
  'PUT /api/dict/items/:id/status': envelope(DICT_ITEM, '已启用'),
  'DELETE /api/dict/items/:id': envelope(null, '删除成功'),
  'DELETE /api/dict/items': envelope(
    {
      deleted: 3,
      skipped: [{ id: 1, name: 'admin', reason: '不能删除当前登录账号' }],
    },
    '已删除 3 条',
  ),

  /* 系统参数 */
  'GET /api/configs': paged([SYS_CONFIG]),
  'GET /api/configs/data/:configKey': envelope({ configKey: 'sys.account.maxLoginAttempts', configValue: '5' }),
  'GET /api/configs/:id': envelope(SYS_CONFIG),
  'POST /api/configs': envelope(SYS_CONFIG, '新增成功'),
  'PUT /api/configs/:id': envelope(SYS_CONFIG, '编辑成功'),
  'DELETE /api/configs/:id': envelope(null, '删除成功'),

  /* 日志管理 */
  'GET /api/logs/login': paged([LOGIN_LOG]),
  'GET /api/logs/operation': paged([OPERATION_LOG]),
  'GET /api/logs/http': paged([HTTP_LOG]),
  'GET /api/logs/http/detail/:id': envelope({
    ...HTTP_LOG,
    reqBody: '{"page":1,"pageSize":10}',
    resBody: '{"code":200,"message":"success","data":{"list":[]}}',
  }),
  'GET /api/logs/login/export': stream('CSV 文件（Content-Type: text/csv; charset=utf-8，带 UTF-8 BOM）'),
  'GET /api/logs/operation/export': stream('CSV 文件（Content-Type: text/csv; charset=utf-8，带 UTF-8 BOM）'),
  'GET /api/logs/http/export': stream('CSV 文件（Content-Type: text/csv; charset=utf-8，带 UTF-8 BOM）'),
  'DELETE /api/logs/http': envelope(null, '已清空所有 HTTP 日志'),

  /* 文件管理 */
  'POST /api/files/upload': envelope(
    [{ id: 1, originName: 'demo.png', fileUrl: '/static/20261018/demo.png' }],
    '上传成功',
  ),
  'GET /api/files/check': envelope({ exists: false, file: null }),
  'GET /api/files': paged([FILE_ITEM]),
  'GET /api/files/types': envelope(['image/png', 'application/pdf']),
  'GET /api/files/quota': envelope({ usedBytes: 12_582_912, quotaBytes: 536_870_912, unlimited: false }),
  /* 在线用户 */
  'GET /api/monitor/online': paged([
    {
      sid: '9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
      userId: 1,
      username: 'admin',
      nickname: '超级管理员',
      ip: '203.0.113.8',
      location: '中国 广东省 深圳市 电信',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      browser: 'Chrome 120',
      os: 'Windows 10',
      loginAt: '2026-10-19T01:20:00.000Z',
      lastSeenAt: '2026-10-19T02:05:00.000Z',
    },
  ]),
  /* 系统资源监控 */
  'GET /api/monitor/server': envelope({
    scope: 'container',
    cpu: { model: 'Intel(R) Xeon(R) Platinum', cores: 4, usage: 12.5, perCore: [10.1, 14.2], quotaCores: 2 },
    memory: { used: 268435456, total: 536870912, usage: 50 },
    disk: { path: '/app/uploads', used: 1073741824, total: 10737418240, usage: 10 },
    network: {
      supported: true,
      reason: null,
      rxRate: 128450,
      txRate: 42130,
      rxTotal: 5368709120,
      txTotal: 1073741824,
      rxErrors: 0,
      txErrors: 0,
      rxDropped: 2,
      txDropped: 0,
      interfaces: [{ name: 'eth0', rxRate: 128450, txRate: 42130, rxTotal: 5368709120, txTotal: 1073741824 }],
    },
    load: [0.52, 0.41, 0.38],
    process: { rss: 188743680, heapUsed: 96468992, heapTotal: 134217728, uptime: 86400 },
    system: {
      hostname: 'ly-admin',
      platform: 'linux',
      release: '6.1.0',
      arch: 'x64',
      nodeVersion: 'v22.11.0',
      appVersion: '1.0.0',
    },
    history: [
      { at: 1763500000000, cpu: 11.2, memory: 48.6, rxRate: 120100, txRate: 41000 },
      { at: 1763500003000, cpu: 12.5, memory: 50, rxRate: 128450, txRate: 42130 },
    ],
    warmingUp: false,
    sampledAt: '2026-10-19T04:00:03.000Z',
  }),
  /* 站内通知 */
  'GET /api/notices': paged([
    {
      id: 12,
      title: '登录会话已被强制下线',
      content: '管理员终止了你在 203.0.113.8 的登录会话。如非本人操作，请及时修改密码。',
      noticeType: 3,
      link: null,
      isRead: 0,
      readAt: null,
      createdAt: '2026-10-19T03:20:00.000Z',
    },
  ]),
  'GET /api/notices/unread-count': envelope({ count: 3 }),
  'POST /api/notices': envelope({ count: 12 }, '已发送 12 条'),
  'PUT /api/notices/:id/read': envelope(null, '已标记为已读'),
  'PUT /api/notices/read-all': envelope({ count: 3 }, '已标记 3 条为已读'),
  'DELETE /api/notices/:id': envelope(null, '删除成功'),
  'DELETE /api/notices': envelope({ count: 5 }, '已清空 5 条'),

  /* 用户批量导入（CSV） */
  'GET /api/users/import/template': '账号,昵称,密码,邮箱,手机号,性别(男/女),部门ID,状态(启用/禁用),角色编码,备注',
  'POST /api/users/import': envelope(
    {
      total: 3,
      created: 0,
      failed: [{ line: 3, username: 'lisi', message: '密码长度不能少于 8 位' }],
    },
    '校验未通过，未写入任何数据',
  ),
  'DELETE /api/monitor/online/:sid': envelope(null, '已强制下线'),
  'DELETE /api/monitor/online/user/:userId': envelope(null, '已下线 2 个会话'),
  'GET /api/files/uploaders': envelope([{ id: 1, username: 'admin', nickname: '超级管理员' }]),
  'GET /api/files/:id/download': stream('附件下载（Content-Disposition: attachment）'),
  'DELETE /api/files/:id': envelope(null, '删除成功'),

  /* 代码生成 */
  'GET /api/gen/tables': envelope([
    { tableName: 'sys_config', tableComment: '系统参数表', engine: 'InnoDB', createTime: '2026-10-16 10:00:00' },
  ]),
  'GET /api/gen/tables/:tableName': envelope({
    tableName: 'sys_config',
    tableComment: '系统参数表',
    columns: [
      {
        columnName: 'config_key',
        fieldName: 'configKey',
        columnType: 'varchar(64)',
        dataType: 'varchar',
        tsType: 'string',
        columnComment: '参数键名',
        isPk: false,
        isNullable: false,
        htmlType: 'input',
        dictType: '',
      },
    ],
  }),
  'POST /api/gen/preview': envelope({
    tableName: 'sys_config',
    files: [{ path: 'ly-admin-api/src/modules/config/config.controller.ts', content: '// 生成的控制器代码…' }],
  }),
  'POST /api/gen/download': stream('ZIP 文件（Content-Type: application/zip）'),
  'POST /api/gen/create': envelope({
    written: ['ly-admin-api/src/modules/config/config.controller.ts'],
    injected: ['ly-admin-api/src/app.module.ts'],
    manualSteps: ['执行 npm run prisma:push'],
  }),

  /* 个人中心 */
  'PUT /api/profile': envelope(USER_BRIEF, '资料更新成功'),
  'PUT /api/profile/password': envelope(null, '密码修改成功，请重新登录'),
  'POST /api/profile/avatar': envelope({ avatar: '/static/20261018/avatar.png' }, '头像更新成功'),
};

/**
 * 取某接口的响应示例。
 *
 * 优先查契约示例库；未登记时按「文件流 / HTTP 方法」给出兜底示例，
 * 保证接口文档里任何一项都有可读的响应形态，不会空白。
 *
 * @param method HTTP 方法
 * @param path 完整路径
 * @param isRaw 是否文件流响应（`@RawResponse()`）
 * @returns 响应示例（对象或文字说明）
 */
export function responseExampleOf(method: string, path: string, isRaw?: boolean): unknown {
  const registered = RESPONSE_EXAMPLES[`${method} ${path}`];
  if (registered !== undefined) {
    return registered;
  }
  if (isRaw) {
    return stream('该接口返回文件流');
  }
  if (method === 'GET') {
    return envelope({});
  }
  if (method === 'DELETE') {
    return envelope(null, '删除成功');
  }
  return envelope(null, '操作成功');
}
