/**
 * 接口契约快照测试（e2e）。
 *
 * 目的：把「结构签名比对」升级为**带真实值样本**的断言 —— 原 Phase 4 的新旧后端 A/B 只比
 * 键集合 / 类型 / 数组长度，因此漏掉了时区符号反向那类「结构对、值错」的缺陷。
 * 本文件对**当前实现**固化一份 golden 契约，年复一年地拦住同类回归。
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
import { RedisService } from '../src/common/redis.service.js';
import { createTestApp } from './setup-app.js';

/** 路由前缀（见 src/app.setup.ts 的 setGlobalPrefix）。 */
const API = '/api';
/** 验证码在 Redis 中的键前缀（见 src/common/captcha.service.ts）。 */
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';
/** 登录日志导出 CSV 的表头 —— 逐字固化，改动会破坏既有的下载/对账习惯。 */
const LOGIN_CSV_HEADER = 'ID,账号,IP,结果,描述,User-Agent,登录时间';
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
      // 对齐原 Express 版 ok() 恒 200；靠 LegacyExpressAdapter 保证，退化会立刻在此暴露
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

      const tree = await authGet('/auth/menus').expect(200);
      const titles = (tree.body.data as Array<{ menuName: string }>).map((node) => node.menuName);
      expect(titles).toContain('系统管理');
    });

    it('/dict/data/:type 返回 {label,value} 形状的种子字典项', async () => {
      const res = await authGet('/dict/data/sys_common_status').expect(200);
      const items = res.body.data as Array<Record<string, unknown>>;
      expect(items).toHaveLength(2);
      // 业务侧直接用 label 渲染、value 提交，键名不可随意改动
      expect(Object.keys(items[0]).sort()).toEqual(['label', 'value']);
      expect(items.map((item) => item.value).sort()).toEqual(['0', '1']);
      expect(items.every((item) => String(item.label).length > 0)).toBe(true);
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

    it('/files/check 缺少 hash → 400（原版即必填）；未命中 → {exists:false, file:null}', async () => {
      const missing = await authGet('/files/check').expect(400);
      expect(String((missing.body as { message: string }).message)).toContain('hash');

      // 与前端 checkFileApi 的返回类型一致：{ exists, file }，用于秒传预检
      const notFound = await authGet(
        '/files/check?hash=0000000000000000000000000000000000000000000000000000000000000000',
      ).expect(200);
      expect(notFound.body).toMatchObject({ code: 200, data: { exists: false, file: null } });
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
      const res = await authGet('/logs/http?page=1&pageSize=1').expect(200);
      const data = res.body.data as { total: number; list: Array<Record<string, unknown>> };
      expect(data.total).toBeGreaterThan(0);

      const first = data.list[0];
      // 字段齐备性（值随 UA 变化，故不断言字面量）
      expect(Object.keys(first)).toEqual(
        expect.arrayContaining(['username', 'deptName', 'browser', 'os', 'ip', 'userAgent', 'statusCode', 'duration']),
      );
      expect(first.username).toBe('admin');
    });
  });
});
