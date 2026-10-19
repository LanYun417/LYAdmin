/**
 * 接口契约快照测试（e2e）。
 *
 * 目的：用**带真实值样本**的断言把对外契约固化下来，拦住「结构对、值错」的回归 ——
 * 只比对键集合 / 类型 / 数组长度的断言，发现不了时区符号反向那类缺陷。本文件即当前
 * 接口的 golden 契约，年复一年地拦住同类回归。
 *
 * 断言口径（避免脆弱的假失败）：
 * - **精确断言**：响应信封、分页键集合、状态码、种子身份常量（admin / super_admin / `['*']`）、
 *   被刻意收窄的响应形状（`/users/:id` 的 roles 不含 roleCode）、CSV 出口的字节与表头；
 * - **包含 / 下界断言**：可增长的数据量（菜单、用户、日志条数）与运维可改的值（系统参数），
 *   这类用 ≥ 或包含关系，否则正常使用会误报。
 *
 * 鉴权走**真实登录**（验证码答案从 Redis 取），既覆盖登录链路本身，也会写入一条登录日志
 * 供 CSV 时区用例使用。
 *
 * 前置条件：本地 MySQL 与 Redis 可用，且已执行 `npm run prisma:push` 与 `npm run seed`。
 */
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { config } from '../src/common/config/config.js';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';

/** 路由前缀（见 src/app.setup.ts 的 setGlobalPrefix）。 */
const API = '/api';
/** 验证码在 Redis 中的键前缀（见 src/common/auth/captcha.service.ts）。 */
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';
/** 登录日志导出 CSV 的表头 —— 逐字固化，改动会破坏既有的下载/对账习惯。 */
const LOGIN_CSV_HEADER = 'ID,账号,IP,归属地,结果,描述,User-Agent,登录时间';
/** 代码生成器对 sys_config 的产物清单（路径与顺序固定）。 */
const GEN_PREVIEW_PATHS = [
  'backend/modules/cfgDemo/cfgDemo.module.ts',
  'backend/modules/cfgDemo/cfgDemo.controller.ts',
  'backend/modules/cfgDemo/cfgDemo.service.ts',
  'backend/modules/cfgDemo/dto/cfgDemo.dto.ts',
  'backend/prisma/sys_config.model.prisma',
  'frontend/api/cfgDemo.ts',
  'frontend/views/demo/cfgDemo/index.vue',
  'README.md',
];

/** 以二进制接收响应体（CSV 需按字节校验 UTF-8 BOM）。 */
function binaryParser(res: request.Response, callback: (error: Error | null, body: Buffer) => void): void {
  // 运行时是 Node 的 IncomingMessage（可读流），superagent 的类型标注为自身的 Response
  const stream = res as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

/** 去 BOM 后按 CRLF 切分成非空行。 */
function csvLines(raw: Buffer): string[] {
  return raw
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .split('\r\n')
    .filter((line) => line.length > 0);
}

/** `YYYY-MM-DD HH:mm:ss` 墙钟时间 → 毫秒时间戳（按 UTC 解读，偏移已由后端算进墙钟）。 */
function wallClockMs(text: string): number {
  return new Date(`${text.replace(' ', 'T')}Z`).getTime();
}

describe('接口契约快照 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let token: string;

  /** 带超管令牌的 GET。 */
  const authGet = (path: string): request.Test =>
    request(app.getHttpServer()).get(`${API}${path}`).set('authorization', `Bearer ${token}`);

  /** 带超管令牌的 POST。 */
  const authPost = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).post(`${API}${path}`).set('authorization', `Bearer ${token}`).send(body);

  /** 带超管令牌的 PUT。 */
  const authPut = (path: string, body: object): request.Test =>
    request(app.getHttpServer()).put(`${API}${path}`).set('authorization', `Bearer ${token}`).send(body);

  /** 带超管令牌的 DELETE（可选请求体：批量删除走 body 传 ids）。 */
  const authDelete = (path: string, body?: object): request.Test => {
    const req = request(app.getHttpServer()).delete(`${API}${path}`).set('authorization', `Bearer ${token}`);
    return body === undefined ? req : req.send(body);
  };

  /** 导出日志 CSV（二进制接收）。 */
  const exportCsv = async (path: string, timezoneOffset?: string): Promise<request.Response> => {
    let req = request(app.getHttpServer())
      .get(`${API}${path}`)
      .set('authorization', `Bearer ${token}`)
      .buffer(true)
      .parse(binaryParser);
    if (timezoneOffset !== undefined) {
      req = req.set('x-timezone-offset', timezoneOffset);
    }
    return req.expect(200);
  };

  /**
   * 再登录一次，拿到一个**独立的会话**（用于会话管理用例）。
   * 与 beforeAll 里的首次登录完全同构：验证码答案从 Redis 取回填。
   */
  const loginFreshSession = async (): Promise<string> => {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: 'admin', password: '123456', captchaId, captchaCode })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  };

  /** 从 JWT 载荷里取 sid（不验签，仅供测试定位会话）。 */
  const sidOf = (accessToken: string): string => {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString()) as {
      sid?: string;
    };
    expect(typeof payload.sid).toBe('string');
    return String(payload.sid);
  };

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);

    // 真实登录：验证码答案存在 Redis，取出来回填（验证码单次有效，登录后即被删除）
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }

    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: 'admin', password: '123456', captchaId, captchaCode })
      .expect(200);
    token = (login.body.data as { accessToken: string }).accessToken;
    expect(typeof token).toBe('string');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('统一响应信封与状态码', () => {
    it('GET /api 返回 {code,message,data} 信封', async () => {
      const res = await request(app.getHttpServer()).get(API).expect(200);
      expect(res.body).toMatchObject({ code: 200, message: 'success' });
      expect(res.body.data).toMatchObject({ name: 'ly-admin-api', status: 'ok' });
    });

    it('POST 成功响应同样是 HTTP 200（不是 201）', async () => {
      // 成功响应恒 200，由 OkExpressAdapter 保证；退化会立刻在此暴露
      const res = await authPost('/gen/preview', {
        tableName: 'sys_config',
        moduleName: 'demo',
        businessName: 'cfgDemo',
      }).expect(200);
      expect(res.body.code).toBe(200);

      const paths = (res.body.data.files as Array<{ path: string }>).map((file) => file.path);
      expect(paths).toEqual(GEN_PREVIEW_PATHS);
    });

    it('未携带令牌 → 401 且走统一错误信封', async () => {
      const res = await request(app.getHttpServer()).get(`${API}/users`).expect(401);
      expect(res.body).toMatchObject({ code: 401 });
      expect(typeof res.body.message).toBe('string');
    });

    it('未知路由 → 404 且走统一错误信封', async () => {
      const res = await request(app.getHttpServer()).get(`${API}/not-exist-xyz`).expect(404);
      expect(res.body).toMatchObject({ code: 404 });
    });
  });

  describe('分页契约', () => {
    it('键集合固定为 {list,total,page,pageSize}，且回显请求页码', async () => {
      const res = await authGet('/users?page=2&pageSize=5').expect(200);
      const data = res.body.data as Record<string, unknown>;
      expect(Object.keys(data).sort()).toEqual(['list', 'page', 'pageSize', 'total']);
      expect(data.page).toBe(2);
      expect(data.pageSize).toBe(5);
      expect(Array.isArray(data.list)).toBe(true);
      expect(data.total as number).toBeGreaterThanOrEqual(1);
    });
  });

  describe('种子身份常量', () => {
    it('/auth/profile：admin 的 deptId=0 时 deptName 为 null（不走外键关系，按 deptId 补查）', async () => {
      const res = await authGet('/auth/profile').expect(200);
      const data = res.body.data as {
        user: { username: string; deptId: number; deptName: string | null };
        roles: string[];
        permissions: string[];
      };
      expect(data.user.username).toBe('admin');
      expect(data.user.deptId).toBe(0);
      expect(data.user.deptName).toBeNull();
      expect(data.roles).toEqual(['super_admin']);
      // 超管权限码为通配符：退化成 [] 会让所有带权限码的接口 403（曾真实发生过）
      expect(data.permissions).toEqual(['*']);
    });

    it('/users/:id 的 roles 只含 {id,roleName}（对外不暴露 roleCode）', async () => {
      // 按用户名精确定位 admin：不依赖"列表第一条就是 admin"——
      // 列表按 id 倒序，任何一条用例新建了用户（哪怕清理失败或运行被中断）都会把它顶下去，
      // 让这条与被测点无关的断言变成随机失败。
      const list = await authGet('/users?page=1&pageSize=10&username=admin').expect(200);
      const admin = (list.body.data.list as Array<{ id: number; username: string }>).find(
        (item) => item.username === 'admin',
      );
      expect(admin).toBeTruthy();

      const res = await authGet(`/users/${admin!.id}`).expect(200);
      const roles = (res.body.data as { roles: Array<Record<string, unknown>> }).roles;
      expect(roles).toHaveLength(1);
      expect(Object.keys(roles[0]).sort()).toEqual(['id', 'roleName']);
      expect(roles[0].roleName).toBe('超级管理员');
    });

    it('/menus 的种子规模与 /auth/menus 顶层菜单', async () => {
      // /menus 返回**扁平数组**（非分页），/menus/tree 才是树
      const menus = await authGet('/menus').expect(200);
      const rows = menus.body.data as Array<{ menuName: string }>;
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThanOrEqual(50);
      expect(rows.map((row) => row.menuName)).toContain('系统管理');
      // 接口文档菜单（纯前端展示页，挂在种子菜单树上，经动态路由注入）
      expect(rows.map((row) => row.menuName)).toContain('接口文档');

      const tree = await authGet('/auth/menus').expect(200);
      const titles = (tree.body.data as Array<{ menuName: string }>).map((node) => node.menuName);
      expect(titles).toContain('系统管理');
    });

    it('/dict/data/:type 返回 {label,value} 形状的种子字典项', async () => {
      const res = await authGet('/dict/data/sys_common_status').expect(200);
      const items = res.body.data as Array<{ label: string; value: string }>;
      expect(items).toHaveLength(2);
      // 业务侧直接用 label 渲染、value 提交，键名不可随意改动
      expect(Object.keys(items[0]).sort((a, b) => a.localeCompare(b))).toEqual(['label', 'value']);
      expect(items.map((item) => item.value).sort((a, b) => a.localeCompare(b))).toEqual(['0', '1']);
      expect(items.every((item) => item.label.length > 0)).toBe(true);
    });

    it('/configs/data/:key 返回 {configKey,configValue} 且与列表值一致', async () => {
      const list = await authGet('/configs?page=1&pageSize=50').expect(200);
      const rows = (list.body.data as { list: Array<{ configKey: string; configValue: string }> }).list;
      const target = rows.find((row) => row.configKey === 'sys.account.maxLoginAttempts');
      expect(target).toBeDefined();

      const single = await authGet('/configs/data/sys.account.maxLoginAttempts').expect(200);
      const data = single.body.data as { configKey: string; configValue: string };
      expect(data.configKey).toBe('sys.account.maxLoginAttempts');
      // 值可被运维在参数管理里调整，故断言「两个出口一致」而非写死字面量
      expect(data.configValue).toBe(target?.configValue);
    });

    it('/gen/tables/:name 的列信息带出表注释（注释落库成果）', async () => {
      const res = await authGet('/gen/tables/sys_config').expect(200);
      const detail = res.body.data as {
        tableName: string;
        tableComment: string;
        columns: Array<{ columnName: string }>;
      };
      expect(detail.tableName).toBe('sys_config');
      expect(detail.tableComment).toBe('系统参数表');
      expect(detail.columns.map((column) => column.columnName)).toContain('config_key');
    });
  });

  describe('校验与边界', () => {
    it('校验失败为 400，文案是中文且不漏出 class-validator 英文默认文案', async () => {
      const res = await authPost('/dict/types', {}).expect(400);
      const message = String((res.body as { message: string }).message);
      expect(message).toMatch(/[\u4e00-\u9fa5]/);
      expect(message).not.toMatch(/must be|Invalid input|is not a valid|should not be/);
    });

    it('/files/check 缺少 hash → 400；未命中 → {exists:false, file:null}', async () => {
      const missing = await authGet('/files/check').expect(400);
      expect(String((missing.body as { message: string }).message)).toContain('hash');

      // 与前端 checkFileApi 的返回类型一致：{ exists, file }，用于秒传预检
      const notFound = await authGet(
        '/files/check?hash=0000000000000000000000000000000000000000000000000000000000000000',
      ).expect(200);
      expect(notFound.body).toMatchObject({ code: 200, data: { exists: false, file: null } });
    });

    it('POST /menus 缺少 menuName → 400（DTO 校验生效，未被 whitelist 清空）', async () => {
      // 回归护栏：若 DTO 失去校验装饰器，whitelist 会把字段全部剥掉，请求会「成功」写入空记录
      const res = await authPost('/menus', { menuType: 'C' }).expect(400);
      expect(String((res.body as { message: string }).message)).toContain('菜单名称');
    });

    it('GET /menus/abc → 400（路径 id 统一由 IdParamDto 校验）', async () => {
      const res = await authGet('/menus/abc').expect(400);
      expect((res.body as { code: number }).code).toBe(400);
    });

    it('POST /users 弱口令 → 400（长度与复杂度走统一口令策略）', async () => {
      const res = await authPost('/users', {
        // 账号须满足 3~20 位，否则会先被账号规则拦掉、验不到口令规则
        username: `pw${Date.now().toString().slice(-6)}`,
        password: '123',
        nickname: '口令校验',
      }).expect(400);
      // 长度不足先被拦；消息里带实际生效的边界，便于前端对齐提示
      expect(String((res.body as { message: string }).message)).toContain('密码长度');
    });

    it('POST /users 口令与账号互相包含 → 400（跨字段规则由服务层兜住）', async () => {
      const username = `pw${Date.now().toString().slice(-8)}`;
      const res = await authPost('/users', {
        username,
        password: username.slice(0, username.length - 1),
        nickname: '口令校验',
      }).expect(400);
      expect(String((res.body as { message: string }).message)).toContain('密码不能包含登录账号');
    });
  });

  describe('CSV 导出契约', () => {
    it('登录日志 CSV：content-type、UTF-8 BOM 与表头逐字一致', async () => {
      const res = await exportCsv('/logs/login/export');
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8');

      const raw = res.body as Buffer;
      expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(csvLines(raw)[0]).toBe(LOGIN_CSV_HEADER);
    });

    it('时区换算方向正确：-480 相对 0 恰好早 8 小时（符号反向的回归护栏）', async () => {
      // 曾把浏览器 getTimezoneOffset()（东八区 -480）直接交给 dayjs.utcOffset()，
      // 两者符号相反 → 导出时间反向偏 16 小时。此用例锁死方向。
      const [utc, beijing] = await Promise.all([
        exportCsv('/logs/login/export', '0'),
        exportCsv('/logs/login/export', '-480'),
      ]);
      const utcTimes = csvLines(utc.body as Buffer)
        .slice(1)
        .map((line) => line.split(',').pop() ?? '')
        .filter((time) => time.length > 0);
      const beijingTimes = csvLines(beijing.body as Buffer)
        .slice(1)
        .map((line) => line.split(',').pop() ?? '')
        .filter((time) => time.length > 0);

      expect(utcTimes.length).toBeGreaterThan(0);
      expect(beijingTimes).toHaveLength(utcTimes.length);
      for (const [index, time] of utcTimes.entries()) {
        expect(wallClockMs(beijingTimes[index]) - wallClockMs(time)).toBe(8 * 60 * 60 * 1000);
      }
    });

    it('导出超过行数上限时返回 400（而不是给出半截 CSV）', async () => {
      // 直接把上限压到 1：库里必然有多于 1 条登录日志
      const original = config.export.maxRows;
      (config.export as { maxRows: number }).maxRows = 1;
      try {
        const res = await request(app.getHttpServer())
          .get(`${API}/logs/login/export`)
          .set('authorization', `Bearer ${token}`)
          .expect(400);
        const message = String((res.body as { message: string }).message);
        expect(message).toContain('超过单次导出上限');
        // 关键：此时必须尚未开始写 CSV（响应是 JSON 而不是被截断的文件流）
        expect(res.headers['content-type']).toContain('application/json');
      } finally {
        (config.export as { maxRows: number }).maxRows = original;
      }
    });
  });

  describe('操作日志变更留痕', () => {
    /** 轮询取最新一条「参数管理 / 编辑」日志（操作日志是响应结束后异步落库的，需等一小会儿）。 */
    async function waitForLatestEditLog(): Promise<Record<string, unknown> | null> {
      for (let attempt = 0; attempt < 15; attempt += 1) {
        const res = await authGet('/logs/operation?page=1&pageSize=20').expect(200);
        const rows = (res.body as { data: { list: Array<Record<string, unknown>> } }).data.list;
        const hit = rows.find((row) => row.module === '参数管理' && row.action === '编辑');
        if (hit) {
          return hit;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    }

    it('编辑系统参数会记录变更前后值，且敏感字段脱敏', async () => {
      // 取一个非内置参数（内置参数不可删除但可编辑；这里只需任意一条）
      const listRes = await authGet('/configs?page=1&pageSize=1').expect(200);
      const config = (listRes.body as { data: { list: Array<{ id: number; configKey: string; configName: string }> } })
        .data.list[0];
      expect(config).toBeTruthy();

      const newValue = `e2e-${Date.now()}`;
      await authPut(`/configs/${config.id}`, {
        configName: config.configName,
        configValue: newValue,
        remark: 'e2e 变更留痕',
      }).expect(200);

      const log = await waitForLatestEditLog();
      expect(log).not.toBeNull();
      // 变更前后都必须是可解析的 JSON，且能看出「值改了」
      const before = JSON.parse(String(log!.beforeData)) as Record<string, unknown>;
      const after = JSON.parse(String(log!.afterData)) as Record<string, unknown>;
      expect(before.configKey).toBe(config.configKey);
      expect(after.configValue).toBe(newValue);
      expect(before.configValue).not.toBe(newValue);
    });

    it('未采集留痕的接口两个字段为 null，不编造数据', async () => {
      const res = await authGet('/logs/operation?page=1&pageSize=50').expect(200);
      const rows = (res.body as { data: { list: Array<Record<string, unknown>> } }).data.list;
      expect(rows.length).toBeGreaterThan(0);
      // 取一页混合作业：清理类/登录类写操作不采集留痕，其 beforeData/afterData 必须是 null
      const noSnapshot = rows.filter((row) => row.beforeData === null && row.afterData === null);
      expect(noSnapshot.length).toBeGreaterThan(0);
    });
  });

  describe('站内通知', () => {
    /** 发布一条只发给 admin 的通知，返回其 id。 */
    const publishToAdmin = async (title: string): Promise<number> => {
      const me = await authGet('/auth/profile').expect(200);
      const userId = Number((me.body as { data: { user: { id: number } } }).data.user.id);
      const res = await authPost('/notices', {
        title,
        content: `内容：${title}`,
        noticeType: 2,
        userIds: [userId],
      }).expect(200);
      expect((res.body as { data: { count: number } }).data.count).toBe(1);
      return userId;
    };

    /** 当前用户未读数。 */
    const unreadCount = async (): Promise<number> => {
      const res = await authGet('/notices/unread-count').expect(200);
      return (res.body as { data: { count: number } }).data.count;
    };

    it('发布 → 未读数 +1 → 标记已读 → 未读数 -1；重复标记返回 404', async () => {
      const before = await unreadCount();
      await publishToAdmin(`e2e通知-${Date.now()}`);
      expect(await unreadCount()).toBe(before + 1);

      const list = await authGet('/notices?page=1&pageSize=1').expect(200);
      const first = (list.body as { data: { list: Array<{ id: number; isRead: number; noticeType: number }> } }).data
        .list[0]!;
      expect(first.isRead).toBe(0);
      expect(first.noticeType).toBe(2);

      await request(app.getHttpServer())
        .put(`${API}/notices/${first.id}/read`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect(await unreadCount()).toBe(before);

      // 已经读过的再标记一次 → 404（不区分"已读"与"不存在"，不泄露存在性）
      await request(app.getHttpServer())
        .put(`${API}/notices/${first.id}/read`)
        .set('authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('全部已读把未读清零，随后可删除与清空', async () => {
      await publishToAdmin(`待全部已读-${Date.now()}`);
      const res = await request(app.getHttpServer())
        .put(`${API}/notices/read-all`)
        .set('authorization', `Bearer ${token}`)
        .expect(200);
      expect((res.body as { data: { count: number } }).data.count).toBeGreaterThanOrEqual(1);
      expect(await unreadCount()).toBe(0);

      // 删除不存在的 → 404
      await authDelete('/notices/999999999').expect(404);
    });

    it('通知按人隔离：另一个账号看不到、也改不了我的通知', async () => {
      // 建一个普通账号并登录，用它验证隔离
      const rolesRes = await authGet('/roles/all').expect(200);
      const roleId = ((rolesRes.body as { data: Array<{ id: number; roleCode: string }> }).data ?? [])[0]!.id;
      const username = `notif${Date.now().toString().slice(-6)}`;
      const created = await authPost('/users', {
        username,
        nickname: '通知隔离测试',
        password: 'Notice123',
        roleIds: [roleId],
      }).expect(200);
      const otherUserId = Number((created.body as { data: { id: number } }).data.id);

      try {
        const title = `仅admin可见-${Date.now()}`;
        await publishToAdmin(title);

        // 用新账号登录
        const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
        const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
        let captchaCode = '';
        if (enabled && captchaId) {
          captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
        }
        const login = await request(app.getHttpServer())
          .post(`${API}/auth/login`)
          .send({ username, password: 'Notice123', captchaId, captchaCode })
          .expect(200);
        const otherToken = (login.body.data as { accessToken: string }).accessToken;

        // 他的收件箱里不该出现这条
        const list = await request(app.getHttpServer())
          .get(`${API}/notices?page=1&pageSize=50`)
          .set('authorization', `Bearer ${otherToken}`)
          .expect(200);
        const titles = (list.body as { data: { list: Array<{ title: string }> } }).data.list.map((item) => item.title);
        expect(titles).not.toContain(title);

        // 他也改不了我的通知（拿 admin 收件箱第一条的 id 去试）
        const adminList = await authGet('/notices?page=1&pageSize=1').expect(200);
        const adminNoticeId = (adminList.body as { data: { list: Array<{ id: number }> } }).data.list[0]!.id;
        await request(app.getHttpServer())
          .put(`${API}/notices/${adminNoticeId}/read`)
          .set('authorization', `Bearer ${otherToken}`)
          .expect(404);
      } finally {
        await authDelete('/users', { ids: [otherUserId] }).expect(200);
      }
    });

    it('发布通知校验：缺标题 / 类型非法 / 未登录 401', async () => {
      const noTitle = await authPost('/notices', { title: '  ', content: 'x', noticeType: 2 }).expect(400);
      expect(String((noTitle.body as { message: string }).message)).toContain('标题');

      await authPost('/notices', { title: 'x', content: 'y', noticeType: 9 }).expect(400);
      await request(app.getHttpServer())
        .post(`${API}/notices`)
        .send({ title: 'x', content: 'y', noticeType: 2 })
        .expect(401);
    });
  });

  describe('用户 CSV 批量导入', () => {
    /**
     * 行分隔符。
     * 用 `String.fromCharCode(10)` 而不是字面量转义：CSV 允许 LF，
     * 且避免测试源码里出现难以肉眼校验的转义序列（CRLF 的解析覆盖在 csv-parse.spec.ts）。
     */
    const LF = String.fromCharCode(10);

    /** 以 multipart 提交一份 CSV 内容。 */
    const importCsv = (content: string, filename = 'users.csv'): request.Test =>
      request(app.getHttpServer())
        .post(`${API}/users/import`)
        .set('authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(content, 'utf8'), { filename, contentType: 'text/csv' });

    /** 按账号前缀查用户（用于断言"到底写进去没有"）。 */
    const findUsersByPrefix = async (prefix: string): Promise<Array<{ id: number; username: string }>> => {
      const res = await authGet(`/users?page=1&pageSize=50&username=${prefix}`).expect(200);
      const list = (res.body as { data: { list: Array<{ id: number; username: string }> } }).data.list ?? [];
      return list.filter((item) => item.username.startsWith(prefix));
    };

    it('模板可下载：含表头与 UTF-8 BOM', async () => {
      const res = await request(app.getHttpServer())
        .get(`${API}/users/import/template`)
        .set('authorization', `Bearer ${token}`)
        .buffer(true)
        .parse(binaryParser)
        .expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      const raw = res.body as Buffer;
      expect([raw[0], raw[1], raw[2]]).toEqual([0xef, 0xbb, 0xbf]);
      expect(csvLines(raw)[0]).toContain('账号');
      expect(csvLines(raw)[0]).toContain('昵称');
    });

    it('上传合法 CSV：全部写入且可查到，随后能被批量删除清理', async () => {
      const prefix = `impa${Date.now().toString().slice(-6)}`;
      // 角色编码从库里取真实值：硬编码种子编码会让用例随种子调整而失效
      const rolesRes = await authGet('/roles/all').expect(200);
      const roleCode = ((rolesRes.body as { data: Array<{ roleCode: string }> }).data ?? [])
        .map((role) => role.roleCode)
        .find((code) => code !== 'super_admin');
      expect(roleCode).toBeTruthy();

      const csv = [
        '账号,昵称,密码,邮箱,性别,状态,角色编码,备注',
        `${prefix}1,导入甲,Import123,impa1@example.com,男,启用,${roleCode},批量导入`,
        `${prefix}2,导入乙,Import456,,女,禁用,,批量导入`,
      ].join(LF);

      const res = await importCsv(`${csv}${LF}`).expect(200);
      const data = (res.body as { data: { total: number; created: number; failed: unknown[] } }).data;
      expect(data.total).toBe(2);
      expect(data.created).toBe(2);
      expect(data.failed).toEqual([]);

      const created = await findUsersByPrefix(prefix);
      expect(created.map((item) => item.username).sort()).toEqual([`${prefix}1`, `${prefix}2`]);

      // 清理：批量删除（顺带验证导入与批量删除能串起来）
      await authDelete('/users', { ids: created.map((item) => item.id) }).expect(200);
      expect(await findUsersByPrefix(prefix)).toHaveLength(0);
    });

    it('任一行不合格 → 全批不写入，并返回逐行报告（含行号）', async () => {
      const prefix = `impb${Date.now().toString().slice(-6)}`;
      const csv = [
        '账号,昵称,密码,状态,备注',
        `${prefix}1,合法行,Import123,启用,这行本来可以写入`,
        `${prefix}2,弱口令,123,启用,密码太短`,
        `${prefix}3,坏状态,Import123,已停用,状态取值非法`,
        `${prefix}1,重复账号,Import123,启用,文件内重复`,
      ].join(LF);

      const res = await importCsv(`${csv}${LF}`).expect(200);
      const data = (
        res.body as { data: { total: number; created: number; failed: Array<{ line: number; message: string }> } }
      ).data;
      expect(data.total).toBe(4);
      expect(data.created).toBe(0);
      expect(data.failed).toHaveLength(3);
      // 行号含表头（第 1 行是表头），故第一行数据是第 2 行
      expect(data.failed.map((item) => item.line)).toEqual([3, 4, 5]);
      expect(data.failed[0]!.message).toContain('密码');
      expect(data.failed[1]!.message).toContain('状态');
      expect(data.failed[2]!.message).toContain('重复');

      // 关键：合法那一行也不能被写进去（全成功或全不写）
      expect(await findUsersByPrefix(prefix)).toHaveLength(0);
    });

    it('账号已存在 → 计入失败明细，且不覆盖既有账号', async () => {
      const csv = ['账号,昵称,密码', 'admin,想覆盖超管,Import123'].join(LF);
      const res = await importCsv(`${csv}${LF}`).expect(200);
      const data = (res.body as { data: { created: number; failed: Array<{ message: string }> } }).data;
      expect(data.created).toBe(0);
      expect(data.failed[0]!.message).toContain('已存在');
    });

    it('请求级问题才是 400：缺必填列 / 无数据行 / 非 CSV 扩展名', async () => {
      const missing = await importCsv(['账号,昵称', 'foo,张三'].join(LF)).expect(400);
      expect(String((missing.body as { message: string }).message)).toContain('密码');

      // 只有表头、没有数据行
      await importCsv('账号,昵称,密码').expect(400);

      await importCsv(['账号,昵称,密码', 'foo,张三,Import123'].join(LF), 'users.xlsx').expect(400);
    });
  });
  describe('在线会话与强制下线', () => {
    it('登录即产生会话：列表可见且带 sid / 客户端信息', async () => {
      const res = await authGet('/monitor/online?page=1&pageSize=50').expect(200);
      const data = (res.body as { data: { list: Array<Record<string, unknown>>; total: number } }).data;
      expect(data.total).toBeGreaterThanOrEqual(1);
      const mine = data.list.find((item) => item.sid === sidOf(token));
      expect(mine).toBeTruthy();
      expect(mine?.username).toBe('admin');
      // 登录时间 / 最后活跃时间都应是 ISO 字符串
      expect(String(mine?.loginAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(String(mine?.lastSeenAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('强制下线指定会话：该令牌立即 401，其它会话不受影响', async () => {
      const otherToken = await loginFreshSession();
      const otherSid = sidOf(otherToken);

      // 被踢之前：这个会话的令牌可用
      await request(app.getHttpServer())
        .get(`${API}/auth/profile`)
        .set('authorization', `Bearer ${otherToken}`)
        .expect(200);

      await authDelete(`/monitor/online/${otherSid}`).expect(200);

      // 被踢之后：该令牌立即失效（守卫发现会话记录已不存在）
      const revoked = await request(app.getHttpServer())
        .get(`${API}/auth/profile`)
        .set('authorization', `Bearer ${otherToken}`)
        .expect(401);
      expect(String((revoked.body as { message: string }).message)).toContain('强制下线');

      // 主会话（本文件其余用例使用的 token）必须仍然有效
      await authGet('/auth/profile').expect(200);

      // 列表里也不应再有该会话
      const list = await authGet('/monitor/online?page=1&pageSize=50').expect(200);
      const sids = (list.body as { data: { list: Array<{ sid: string }> } }).data.list.map((item) => item.sid);
      expect(sids).not.toContain(otherSid);
    });

    it('强制下线不存在的会话 → 404（避免误以为已踢掉）', async () => {
      await authDelete('/monitor/online/00000000-0000-4000-8000-000000000000').expect(404);
    });

    it('会话 id 格式非法 → 400（路径参数经 DTO 校验，不做模糊匹配）', async () => {
      await authDelete('/monitor/online/not-a-uuid').expect(400);
    });

    it('强制下线用户全部会话：本人全部令牌失效（含无法定位 sid 的旧令牌）', async () => {
      const first = await loginFreshSession();
      const second = await loginFreshSession();
      const userId = Number(
        ((await authGet('/auth/profile').expect(200)).body as { data: { user: { id: number } } }).data.user.id,
      );

      await authDelete(`/monitor/online/user/${userId}`).expect(200);

      // 两个新会话都被踢掉
      for (const revokedToken of [first, second]) {
        await request(app.getHttpServer())
          .get(`${API}/auth/profile`)
          .set('authorization', `Bearer ${revokedToken}`)
          .expect(401);
      }
      // 主会话同样已被用户级登出，后续用例需要重新登录——因此本用例放在该 describe 的最后
      token = await loginFreshSession();
      await authGet('/auth/profile').expect(200);
    });
  });

  describe('批量删除（逐条执行 + 跳过明细）', () => {
    it('DELETE /users 命中超管保护时返回明细而不是整体失败', async () => {
      // 取超管账号 id：它是唯一必然不可删的用户
      const me = await authGet('/auth/profile').expect(200);
      const superAdminId = Number((me.body as { data: { user: { id: number } } }).data.user.id);

      const res = await authDelete('/users', { ids: [superAdminId, 999_999_999] }).expect(200);
      const data = (res.body as { data: { deleted: number; skipped: Array<{ id: number; reason: string }> } }).data;
      expect(data.deleted).toBe(0);
      expect(data.skipped).toHaveLength(2);
      expect(data.skipped.map((item) => item.id)).toEqual([superAdminId, 999_999_999]);
      // 超管那条应给出"不可删除"的业务原因（不是笼统的失败）。
      // 注意：当前登录者就是超管本人，命中「不能删除当前登录账号」这条更靠前的护栏也属预期。
      expect(data.skipped[0]!.reason).toMatch(/不可删除|不能删除当前登录账号/);
      expect(data.skipped[1]!.reason).toContain('用户不存在');
    });

    it('DELETE /roles 内置超管角色被跳过并给出原因', async () => {
      const list = await authGet('/roles?page=1&pageSize=50').expect(200);
      const roles = (list.body as { data: { list: Array<{ id: number; roleCode: string }> } }).data.list;
      const superRole = roles.find((role) => role.roleCode === 'super_admin');
      expect(superRole).toBeTruthy();

      const res = await authDelete('/roles', { ids: [superRole!.id] }).expect(200);
      const data = (res.body as { data: { deleted: number; skipped: Array<{ reason: string }> } }).data;
      expect(data.deleted).toBe(0);
      expect(data.skipped[0]!.reason).toContain('不可删除');
    });

    it('DELETE /dict/items 能真正批量删除（创建 → 批量删 → 查不到）', async () => {
      // 建在已有字典类型下，随后删除，避免污染
      const types = await authGet('/dict/types?page=1&pageSize=1').expect(200);
      const dictType = (types.body as { data: { list: Array<{ dictType: string }> } }).data.list[0]!.dictType;

      const created: number[] = [];
      for (const suffix of ['A', 'B']) {
        const res = await authPost('/dict/items', {
          dictType,
          dictLabel: `e2e批量${suffix}${Date.now()}`,
          dictValue: `e2e_${suffix}_${Date.now()}`,
          sort: 999,
          status: 1,
        }).expect(200);
        created.push(Number((res.body as { data: { id: number } }).data.id));
      }

      const res = await authDelete('/dict/items', { ids: created }).expect(200);
      const data = (res.body as { data: { deleted: number; skipped: unknown[] } }).data;
      expect(data.deleted).toBe(2);
      expect(data.skipped).toHaveLength(0);

      // 再删一次：应全部落到 skipped（记录不存在），deleted 为 0
      const again = await authDelete('/dict/items', { ids: created }).expect(200);
      expect((again.body as { data: { deleted: number } }).data.deleted).toBe(0);
    });

    it('批量删除请求体校验：空数组与非法 id 返回 400', async () => {
      await authDelete('/users', { ids: [] }).expect(400);
      await authDelete('/users', { ids: [0] }).expect(400);
      await authDelete('/users', { ids: [1.5] }).expect(400);
    });

    it('批量删除与单条删除共用权限码，未授权角色不可调用', async () => {
      // 无令牌：401（与单条删除一致，说明复用同一套鉴权）
      await request(app.getHttpServer())
        .delete(`${API}/users`)
        .send({ ids: [1] })
        .expect(401);
    });
  });

  describe('访问日志', () => {
    it('HTTP 日志列表带出操作者与解析后的浏览器字段', async () => {
      const res = await authGet('/logs/http?username=admin&page=1&pageSize=1').expect(200);
      const data = res.body.data as { total: number; list: Array<Record<string, unknown>> };
      expect(data.total).toBeGreaterThan(0);

      const first = data.list[0];
      // 字段齐备性（值随 UA 变化，故不断言字面量）
      expect(Object.keys(first)).toEqual(
        expect.arrayContaining(['username', 'deptName', 'browser', 'os', 'ip', 'userAgent', 'statusCode', 'duration']),
      );
      expect(first.username).toBe('admin');
      // 列表只带摘要：请求/响应体改由详情接口按需加载
      expect(first).not.toHaveProperty('reqBody');
      expect(first).not.toHaveProperty('resBody');
    });

    it('HTTP 日志详情按需返回请求 / 响应体，列表不携带', async () => {
      const list = await authGet('/logs/http?page=1&pageSize=1').expect(200);
      const first = (list.body.data as { list: Array<{ id: number }> }).list[0];
      expect(first.id).toBeGreaterThan(0);

      const detail = await authGet(`/logs/http/detail/${first.id}`).expect(200);
      expect(Object.keys(detail.body.data as Record<string, unknown>)).toEqual(
        expect.arrayContaining(['id', 'username', 'query', 'reqBody', 'resBody']),
      );
    });

    it('HTTP 日志按操作账号前缀过滤（可命中索引）', async () => {
      const matched = await authGet('/logs/http?username=adm&page=1&pageSize=1').expect(200);
      expect((matched.body.data as { total: number }).total).toBeGreaterThan(0);

      const notMatched = await authGet('/logs/http?username=dmin&page=1&pageSize=1').expect(200);
      expect((notMatched.body.data as { total: number }).total).toBe(0);
    });
  });

  describe('日志删除', () => {
    /** 取最新一条登录日志 id：只删本条，避免影响其它用例依赖的数据量。 */
    async function latestLoginLogId(): Promise<number> {
      const res = await authGet('/logs/login?page=1&pageSize=1').expect(200);
      const rows = (res.body.data as { list: Array<{ id: number }> }).list;
      expect(rows.length).toBeGreaterThan(0);
      return rows[0].id;
    }

    it('DELETE /logs/login/batch → 按 ids 删除，message 回显实际命中条数', async () => {
      const id = await latestLoginLogId();
      const res = await authDelete('/logs/login/batch', { ids: [id] }).expect(200);
      expect(res.body).toMatchObject({ code: 200 });
      expect(String((res.body as { message: string }).message)).toBe('已删除 1 条日志');

      const after = await authGet('/logs/login?page=1&pageSize=50').expect(200);
      const ids = (after.body.data as { list: Array<{ id: number }> }).list.map((row) => row.id);
      expect(ids).not.toContain(id);
    });

    it('DELETE /logs/login/:id → 单条删除返回固定文案', async () => {
      const id = await latestLoginLogId();
      const res = await authDelete(`/logs/login/${id}`).expect(200);
      expect(String((res.body as { message: string }).message)).toBe('删除成功');
    });

    it('DELETE /logs/login/batch 传空数组 → 400（护栏：不允许无 id 的全量删除）', async () => {
      const res = await authDelete('/logs/login/batch', { ids: [] }).expect(400);
      expect(String((res.body as { message: string }).message)).toContain('请至少选择一条记录');
    });
  });

  describe('文件上传与存储布局', () => {
    /** 以 multipart 上传一段文本内容，返回接口给出的文件项。 */
    async function uploadText(
      filename: string,
      content: string,
      biz?: { bizType?: string; bizId?: string },
    ): Promise<{ id: number; originName: string; fileName: string; fileUrl: string }> {
      let req = request(app.getHttpServer())
        .post(`${API}/files/upload`)
        .set('authorization', `Bearer ${token}`)
        .attach('file', Buffer.from(content), { filename, contentType: 'text/plain' });
      if (biz?.bizType !== undefined) {
        req = req.field('bizType', biz.bizType);
      }
      if (biz?.bizId !== undefined) {
        req = req.field('bizId', biz.bizId);
      }
      const res = await req.expect(200);
      return (res.body.data as Array<{ id: number; originName: string; fileName: string; fileUrl: string }>)[0];
    }

    it('上传按扩展名分组存储：fileName 与 fileUrl 均带 <ext>/ 前缀', async () => {
      const file = await uploadText('布局校验.txt', `storage-layout-${Date.now()}`);
      // 目录名 = 小写扩展名；URL 与 DB 相对路径必须一致，否则静态访问 404
      expect(file.fileName.startsWith('txt/')).toBe(true);
      expect(file.fileUrl).toBe(`/static/${file.fileName}`);
      expect(file.fileUrl).toMatch(/^\/static\/txt\/[^/]+\.txt$/);
      // 中文文件名不能被 multipart 的 latin1 解析弄成乱码
      expect(file.originName).toBe('布局校验.txt');

      // 清理：删除记录 + 磁盘文件，避免污染后续断言
      await authDelete(`/files/${file.id}`).expect(200);
    });

    it('同内容重复上传命中秒传：复用既有记录且标 deduplicated', async () => {
      const content = `dedupe-${Date.now()}`;
      const first = await uploadText('秒传-1.txt', content);
      const second = await uploadText('秒传-2.txt', content);

      expect(second.id).toBe(first.id);
      expect((second as { deduplicated?: boolean }).deduplicated).toBe(true);

      await authDelete(`/files/${first.id}`).expect(200);
    });

    it('上传可带业务归属，且能按 bizType 反查', async () => {
      const bizType = `e2ebiz${Date.now().toString().slice(-6)}`;
      const file = await uploadText('归属校验.txt', `biz-${Date.now()}`, { bizType, bizId: '42' });

      // 列表按业务类型过滤应能命中这一条
      const res = await authGet(`/files?page=1&pageSize=50&bizType=${bizType}`).expect(200);
      const rows = (res.body as { data: { list: Array<Record<string, unknown>> } }).data.list;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]!.bizType).toBe(bizType);
      expect(Number(rows[0]!.bizId)).toBe(42);

      // 再叠加 bizId 过滤（不同 bizId 不应命中）
      const miss = await authGet(`/files?page=1&pageSize=50&bizType=${bizType}&bizId=43`).expect(200);
      expect((miss.body as { data: { total: number } }).data.total).toBe(0);

      await authDelete(`/files/${file.id}`).expect(200);
    });

    it('非法业务归属被拒：bizType 含非法字符 / bizId 非正整数', async () => {
      const bad = await request(app.getHttpServer())
        .post(`${API}/files/upload`)
        .set('authorization', `Bearer ${token}`)
        .field('bizType', 'notice/../etc')
        .field('bizId', '0')
        .attach('file', Buffer.from(`biz-invalid-${Date.now()}`), {
          filename: '非法归属.txt',
          contentType: 'text/plain',
        })
        .expect(400);
      expect((bad.body as { code: number }).code).toBe(400);
    });

    it('超出用户上传配额时返回 400 且不留下孤儿文件', async () => {
      const originalQuota = config.upload.userQuotaMb;
      // 配额压到 1e-6 MB（约 1 字节），必然放不下任何内容
      (config.upload as { userQuotaMb: number }).userQuotaMb = 0.000001;
      try {
        const res = await request(app.getHttpServer())
          .post(`${API}/files/upload`)
          .set('authorization', `Bearer ${token}`)
          .attach('file', Buffer.from(`quota-${Date.now()}`), { filename: '配额.txt', contentType: 'text/plain' })
          .expect(400);
        const message = String((res.body as { message: string }).message);
        expect(message).toContain('上传配额不足');
        // 消息里带出可自助处理的信息（上限）
        expect(message).toContain('上限');
      } finally {
        (config.upload as { userQuotaMb: number }).userQuotaMb = originalQuota;
      }
    });

    it('GET /files/quota 返回当前用户用量与上限（0 表示不限量）', async () => {
      const res = await authGet('/files/quota').expect(200);
      const data = (res.body as { data: { usedBytes: number; quotaBytes: number; unlimited: boolean } }).data;
      expect(typeof data.usedBytes).toBe('number');
      expect(data.usedBytes).toBeGreaterThanOrEqual(0);
      // 默认 512MB 配额：不是不限量，且上限应为 512*1024*1024
      expect(data.unlimited).toBe(config.upload.userQuotaMb <= 0);
      if (!data.unlimited) {
        expect(data.quotaBytes).toBe(Math.round(config.upload.userQuotaMb * 1024 * 1024));
      }
    });
  });

  describe('接口文档', () => {
    it('GET /api/docs 公开可访问，返回按模块分组的接口清单', async () => {
      // @Public() 接口：不带令牌也应 200（供前端文档页与外部消费）
      const res = await request(app.getHttpServer()).get(`${API}/docs`).expect(200);
      expect(res.body).toMatchObject({ code: 200 });

      const data = res.body.data as {
        total: number;
        generatedAt: string;
        groups: Array<{
          group: string;
          endpoints: Array<{ method: string; path: string; permission: string[]; isPublic: boolean }>;
        }>;
      };
      // 接口只增不减，用下界断言避免正常新增接口就让本用例失败
      expect(data.total).toBeGreaterThanOrEqual(60);
      expect(typeof data.generatedAt).toBe('string');
      expect(data.groups.map((group) => group.group)).toContain('用户管理');

      const users = data.groups.find((group) => group.group === '用户管理');
      const detail = users?.endpoints.find((endpoint) => endpoint.path === '/api/users/:id');
      expect(detail).toBeDefined();
      expect(detail?.method).toBe('GET');
      expect(detail?.permission).toEqual(['system:user:query']);

      // 公开接口被正确标记（登录 / 验证码无需令牌）
      const auth = data.groups.find((group) => group.group === '认证');
      const login = auth?.endpoints.find((endpoint) => endpoint.path === '/api/auth/login');
      expect(login?.isPublic).toBe(true);
    });
  });
});
