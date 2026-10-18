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
      const list = await authGet('/users?page=1&pageSize=1').expect(200);
      const admin = (list.body.data.list as Array<{ id: number; username: string }>)[0];
      expect(admin.username).toBe('admin');

      const res = await authGet(`/users/${admin.id}`).expect(200);
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
