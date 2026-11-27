/**
 * 管理面控制器权限覆盖回归测试。
 *
 * 背景：守卫规则是「**未声明 @RequirePermissions 的接口只要登录即可访问**」
 * （见 permission.guard.ts）。本次线上事故即源于 ldap / api-key / alert / sso
 * 四个控制器漏了装饰器：前端用 v-permission 藏了按钮，但接口裸奔，
 * 任何登录用户（含只读访客）都能直接 curl 修改配置、甚至自签 API Key。
 *
 * 本测试直接读路由元数据，断言每个管理面路由**要么显式 @Public()、要么带权限码**，
 * 把「漏装饰器」变成一次提交即可发现的失败。
 */
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
// Nest 12 起这组常量在 @nestjs/common/constants（旧路径 @nestjs/core/constants 已无导出）
import { METHOD_METADATA } from '@nestjs/common/constants';

// 控制器链路在模块加载时读 config，需先备好 JWT 环境变量再动态导入
// （静态 import 会被提升到赋值之前执行，导致读到缺失的密钥直接抛错）
process.env.JWT_ACCESS_SECRET = 'perm-test-access-secret-not-for-production-01';
process.env.JWT_REFRESH_SECRET = 'perm-test-refresh-secret-not-for-production-2';

const { PERMISSION_KEY } = await import('../src/common/auth/permission.guard.js');
const { IS_PUBLIC_KEY } = await import('../src/common/auth/auth.guard.js');
const { LdapController } = await import('../src/modules/ldap/ldap.controller.js');
const { ApiKeyController } = await import('../src/modules/api-key/api-key.controller.js');
const { AlertController } = await import('../src/modules/alert/alert.controller.js');
const { SsoController } = await import('../src/modules/sso/sso.controller.js');

/**
 * 收集控制器上所有路由方法及其权限元数据。
 *
 * 注意：方法装饰器的元数据挂在**函数对象本身**（SetMetadata 走 `descriptor.value`），
 * 不是 `(prototype, methodName)`——Nest 的 Reflector 同样从 `context.getHandler()` 读，
 * 故此处与框架保持同一取值位置。
 */
function collectRoutes(ctrl: unknown): Array<{ method: string; public: boolean; codes: string[] | null }> {
  const proto = (ctrl as { prototype: Record<string, unknown> }).prototype;
  const names = Object.getOwnPropertyNames(proto).filter((name) => name !== 'constructor');
  const routes: Array<{ method: string; public: boolean; codes: string[] | null }> = [];
  for (const name of names) {
    const fn = proto[name] as object;
    if (typeof fn !== 'function') {
      continue;
    }
    // @Get/@Post 等装饰器才会写入 METHOD_METADATA；普通方法跳过
    if (Reflect.getMetadata(METHOD_METADATA, fn) === undefined) {
      continue;
    }
    const codes = Reflect.getMetadata(PERMISSION_KEY, fn) as string[] | undefined;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, fn) === true;
    routes.push({ method: name, public: isPublic, codes: codes ?? null });
  }
  return routes;
}

describe('管理面控制器权限覆盖', () => {
  it('LDAP：读走 query、写走 edit，无裸奔路由', () => {
    const routes = collectRoutes(LdapController);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const codes = route.codes ?? [];
      expect(codes.length, `${route.method} 未声明权限码`).toBeGreaterThan(0);
      const isWrite = route.method === 'saveConfig' || route.method === 'clearConfig';
      expect(codes, route.method).toContain(isWrite ? 'system:ldap:edit' : 'system:ldap:query');
    }
  });

  it('开放 API：密钥按 add/edit/remove、Webhook 按 add/edit/remove 分别收敛', () => {
    const routes = collectRoutes(ApiKeyController);
    expect(routes.length).toBeGreaterThan(0);
    const byName = new Map(routes.map((r) => [r.method, r.codes ?? []]));
    expect(byName.get('createKey')).toContain('system:apiKey:add');
    expect(byName.get('updateKey')).toContain('system:apiKey:edit');
    expect(byName.get('toggleKey')).toContain('system:apiKey:edit');
    expect(byName.get('removeKey')).toContain('system:apiKey:remove');
    expect(byName.get('listKeys')).toContain('system:apiKey:query');
    expect(byName.get('createWebhook')).toContain('system:webhook:add');
    expect(byName.get('updateWebhook')).toContain('system:webhook:edit');
    expect(byName.get('testWebhook')).toContain('system:webhook:edit');
    expect(byName.get('removeWebhook')).toContain('system:webhook:remove');
    expect(byName.get('listWebhooks')).toContain('system:webhook:query');
    expect(byName.get('listDeliveries')).toContain('system:webhook:query');
  });

  it('告警中心：全部路由带权限码（无 @Public 目标）', () => {
    const routes = collectRoutes(AlertController);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const codes = route.codes ?? [];
      expect(codes.length, `${route.method} 未声明权限码`).toBeGreaterThan(0);
    }
  });

  it('SSO：登录面公开、管理面全部带权限', () => {
    const routes = collectRoutes(SsoController);
    const byName = new Map(routes.map((r) => [r.method, r]));
    // 登录面（公开）保持公开
    for (const name of ['providers', 'authorize', 'callback', 'redeem']) {
      expect(byName.get(name)?.public, `${name} 应保持公开`).toBe(true);
    }
    // 管理面逐个收敛
    for (const name of ['listProviders', 'getProvider', 'createProvider', 'updateProvider', 'deleteProvider']) {
      const route = byName.get(name);
      expect(route, `${name} 不存在`).toBeTruthy();
      expect(route?.codes ?? [], `${name} 未声明权限码`).toContain(`system:sso:${codeFor(name)}`);
    }
  });
});

/** 管理面方法名 → 种子权限后缀。 */
function codeFor(name: string): string {
  if (name.includes('create')) return 'add';
  if (name.includes('update')) return 'edit';
  if (name.includes('delete')) return 'remove';
  return 'query';
}
