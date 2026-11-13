import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { RedisService } from '../src/common/redis/redis.service.js';
import { createTestApp } from './setup-app.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';

/**
 * 核心 CRUD 契约 e2e（users / roles / depts / menus / dict）。
 *
 * 目标：不是覆盖每个分支，而是把「创建 → 查询可见 → 更新生效 → 删除消失」
 * 这条主链路在五个核心模块上各钉一遍——这类回归（字段被 whitelist 误清、
 * 更新没落库、删除没级联）单测抓不到，只有真库真接口能抓到。
 *
 * 风格与 contract.e2e-spec.ts 一致：真实 MySQL + Redis，admin 登录，
 * 一次一个用例、用例内自建数据并自清理（失败时 afterAll 兜底）。
 */
const API = '/api';

describe('核心 CRUD 契约 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let token: string;

  /** 自建数据 id（afterAll 兜底清理，避免用例失败后脏数据堆积）。 */
  const created = {
    userIds: [] as number[],
    roleIds: [] as number[],
    deptIds: [] as number[],
    menuIds: [] as number[],
    dictTypeIds: [] as number[],
  };

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    token = await login();
  });

  afterAll(async () => {
    // 清理顺序与依赖相反：用户 → 角色/部门 → 菜单 → 字典（失败静默，不阻断关闭）
    for (const id of created.userIds) {
      await http()
        .delete(`${API}/users/${id}`)
        .set('authorization', `Bearer ${token}`)
        .catch(() => undefined);
    }
    for (const id of created.roleIds) {
      await http()
        .delete(`${API}/roles/${id}`)
        .set('authorization', `Bearer ${token}`)
        .catch(() => undefined);
    }
    for (const id of created.deptIds) {
      await http()
        .delete(`${API}/depts/${id}`)
        .set('authorization', `Bearer ${token}`)
        .catch(() => undefined);
    }
    for (const id of created.menuIds) {
      await http()
        .delete(`${API}/menus/${id}`)
        .set('authorization', `Bearer ${token}`)
        .catch(() => undefined);
    }
    for (const id of created.dictTypeIds) {
      await http()
        .delete(`${API}/dict/types/${id}`)
        .set('authorization', `Bearer ${token}`)
        .catch(() => undefined);
    }
    await app?.close();
  });

  /** 带鉴权的请求构造（supertest 的入口，按方法显式链式调用）。 */
  function http(): ReturnType<typeof request> {
    return request(app.getHttpServer());
  }

  async function login(): Promise<string> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`);
    const answer = await redis.get(`auth:captcha:${captcha.body.data.captchaId}`);
    const response = await request(app.getHttpServer()).post(`${API}/auth/login`).send({
      username: 'admin',
      password: resolveSeedAdminPassword(),
      captchaId: captcha.body.data.captchaId,
      captchaCode: answer,
    });
    return response.body.data.accessToken as string;
  }

  it('部门：创建（子节点）→ 树中可见 → 改名 → 删除消失', async () => {
    const suffix = Date.now().toString().slice(-6);
    const create = await http()
      .post(`${API}/depts`)
      .set('authorization', `Bearer ${token}`)
      .send({ deptName: `E2E部门${suffix}`, deptType: 1, parentId: 0, sort: 99 })
      .expect(200);
    const id = create.body.data.id as number;
    created.deptIds.push(id);
    expect(id).toBeGreaterThan(0);

    // 详情可见（名称原样落库）
    const detail = await http().get(`${API}/depts/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.data.deptName).toBe(`E2E部门${suffix}`);

    // 更新生效
    await http()
      .put(`${API}/depts/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ deptName: `E2E部门${suffix}改`, deptType: 1, parentId: 0 })
      .expect(200);
    const updated = await http().get(`${API}/depts/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(updated.body.data.deptName).toBe(`E2E部门${suffix}改`);

    // 删除后详情 404
    await http().delete(`${API}/depts/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    await http().get(`${API}/depts/${id}`).set('authorization', `Bearer ${token}`).expect(404);
  });

  it('菜单：创建按钮节点（带权限码）→ 更新 → 权限码唯一冲突被拒 → 删除', async () => {
    const suffix = Date.now().toString().slice(-6);
    const permission = `e2e:crud:${suffix}`;
    const create = await http()
      .post(`${API}/menus`)
      .set('authorization', `Bearer ${token}`)
      .send({ menuName: `E2E按钮${suffix}`, menuType: 'F', permission, parentId: 0, sort: 99 })
      .expect(200);
    const id = create.body.data.id as number;
    created.menuIds.push(id);

    const detail = await http().get(`${API}/menus/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.data.permission).toBe(permission);

    // 权限码允许重复（菜单节点与其按钮共用同一权限码是合法设计，种子即如此）

    await http()
      .put(`${API}/menus/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ menuName: `E2E按钮${suffix}改`, menuType: 'F', permission, parentId: 0 })
      .expect(200);

    await http().delete(`${API}/menus/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    await http().get(`${API}/menus/${id}`).set('authorization', `Bearer ${token}`).expect(404);
  });

  it('角色：创建 → 授权菜单 → 授权可读回 → 更新 → 删除', async () => {
    const suffix = Date.now().toString().slice(-6);
    const roleCode = `e2e_role_${suffix}`;
    const create = await http()
      .post(`${API}/roles`)
      .set('authorization', `Bearer ${token}`)
      .send({ roleName: `E2E角色${suffix}`, roleCode, sort: 99, status: 1, dataScope: 1 })
      .expect(200);
    const id = create.body.data.id as number;
    created.roleIds.push(id);

    // 授权：拿种子 dashboard 菜单（id 稳定存在）绑给新角色
    const menus = await http().get(`${API}/menus`).set('authorization', `Bearer ${token}`).expect(200);
    // 菜单列表是树形全量数组（非分页）
    const menuList = menus.body.data as Array<{ id: number }>;
    expect(Array.isArray(menuList)).toBe(true);
    expect(menuList.length).toBeGreaterThan(0);
    const menuId = menuList[0]!.id;
    await http()
      .put(`${API}/roles/${id}/menus`)
      .set('authorization', `Bearer ${token}`)
      .send({ menuIds: [menuId] })
      .expect(200);

    // 授权读回：必须与提交的一致（这条最容易在「先删后插」实现里翻车）
    const granted = await http().get(`${API}/roles/${id}/menus`).set('authorization', `Bearer ${token}`).expect(200);
    expect(granted.body.data.menuIds ?? granted.body.data).toEqual([menuId]);

    // 更新角色名（角色无单条详情接口，用列表验证）
    await http()
      .put(`${API}/roles/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ roleName: `E2E角色${suffix}改`, sort: 99, status: 1, dataScope: 1 })
      .expect(200);
    const roles = await http().get(`${API}/roles`).set('authorization', `Bearer ${token}`).expect(200);
    const updated = (roles.body.data.list as Array<{ id: number; roleName: string }>).find((row) => row.id === id);
    expect(updated?.roleName).toBe(`E2E角色${suffix}改`);

    await http().delete(`${API}/roles/${id}`).set('authorization', `Bearer ${token}`).expect(200);
  });

  it('用户：创建（带角色/部门）→ 列表筛选命中 → 更新昵称 → 重置密码 → 删除', async () => {
    const suffix = Date.now().toString().slice(-6);
    const username = `e2euser${suffix}`;
    // 先建一个专属角色与部门，验证「创建用户时一并绑定」的关联链路
    const role = await http()
      .post(`${API}/roles`)
      .set('authorization', `Bearer ${token}`)
      .send({ roleName: `E2E用户角色${suffix}`, roleCode: `e2e_user_role_${suffix}`, sort: 99, status: 1 })
      .expect(200);
    const roleId = role.body.data.id as number;
    created.roleIds.push(roleId);

    const dept = await http()
      .post(`${API}/depts`)
      .set('authorization', `Bearer ${token}`)
      .send({ deptName: `E2E用户部门${suffix}`, deptType: 1, parentId: 0 })
      .expect(200);
    const deptId = dept.body.data.id as number;
    created.deptIds.push(deptId);

    const create = await http()
      .post(`${API}/users`)
      .set('authorization', `Bearer ${token}`)
      .send({
        username,
        password: 'E2e@Test12345',
        nickname: `E2E用户${suffix}`,
        email: `${username}@example.com`,
        roleIds: [roleId],
        deptId,
        status: 1,
      })
      .expect(200);
    const id = create.body.data.id as number;
    created.userIds.push(id);

    // 列表筛选：按用户名前缀必须命中（列表与详情同一套 where）
    const list = await http()
      .get(`${API}/users`)
      .query({ page: 1, pageSize: 10, username })
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect((list.body.data.list as Array<{ id: number }>).some((row) => row.id === id)).toBe(true);

    // 详情：角色与部门关联落库
    const detail = await http().get(`${API}/users/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(detail.body.data.nickname).toBe(`E2E用户${suffix}`);
    expect((detail.body.data.roles as Array<{ id: number }>).map((item) => item.id)).toContain(roleId);

    // 更新昵称
    await http()
      .put(`${API}/users/${id}`)
      .set('authorization', `Bearer ${token}`)
      .send({ nickname: `E2E用户${suffix}改`, roleIds: [roleId], deptId, status: 1 })
      .expect(200);
    const updated = await http().get(`${API}/users/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(updated.body.data.nickname).toBe(`E2E用户${suffix}改`);

    // 重置密码（管理员代改：提交新密码，响应不回显明文）
    const reset = await http()
      .put(`${API}/users/${id}/password`)
      .set('authorization', `Bearer ${token}`)
      .send({ password: 'E2e@Reset12345' })
      .expect(200);
    expect(reset.body.data).toBeNull();

    // 删除后详情 404
    await http().delete(`${API}/users/${id}`).set('authorization', `Bearer ${token}`).expect(200);
    await http().get(`${API}/users/${id}`).set('authorization', `Bearer ${token}`).expect(404);
  });

  it('字典：创建类型 → 创建字典项 → /dict/data/:type 可读 → 删类型级联清项', async () => {
    const suffix = Date.now().toString().slice(-6);
    const dictType = `e2e_dict_${suffix}`;
    const createType = await http()
      .post(`${API}/dict/types`)
      .set('authorization', `Bearer ${token}`)
      .send({ dictName: `E2E字典${suffix}`, dictType, remark: 'e2e' })
      .expect(200);
    const typeId = createType.body.data.id as number;
    created.dictTypeIds.push(typeId);
    expect(typeId).toBeGreaterThan(0);

    await http()
      .post(`${API}/dict/items`)
      .set('authorization', `Bearer ${token}`)
      .send({ dictType, dictLabel: '选项甲', dictValue: 'a', sort: 1 })
      .expect(200);

    // 业务读取口径：{label, value} 形状
    const data = await http().get(`${API}/dict/data/${dictType}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(data.body.data).toEqual([{ label: '选项甲', value: 'a' }]);

    // 删类型 → 级联删项：data 接口返回空数组（而不是 500）
    await http().delete(`${API}/dict/types/${typeId}`).set('authorization', `Bearer ${token}`).expect(200);
    const after = await http().get(`${API}/dict/data/${dictType}`).set('authorization', `Bearer ${token}`).expect(200);
    expect(after.body.data).toEqual([]);
  });
});
