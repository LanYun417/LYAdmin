/**
 * 应用根模块。
 * 模块职责：装配全局模块（数据库/基础设施/守卫/拦截器/过滤器）与各业务模块。
 */
import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard } from './common/auth/auth.guard.js';
import { PermissionGuard } from './common/auth/permission.guard.js';
import { AllExceptionsFilter } from './common/exception/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/http/response.interceptor.js';
import { OperationLogInterceptor } from './common/log/operation-log.interceptor.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HttpAccessLoggerMiddleware } from './common/log/http-access-log.middleware.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { RoleModule } from './modules/roles/roles.module.js';
import { DeptModule } from './modules/depts/depts.module.js';
import { DictModule } from './modules/dict/dict.module.js';
import { ConfigModule } from './modules/config/config.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { GenModule } from './modules/gen/gen.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { ProfileModule } from './modules/profile/profile.module.js';
import { LogsModule } from './modules/logs/logs.module.js';
import { DocsModule } from './modules/docs/docs.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    MenuModule,
    UsersModule,
    RoleModule,
    DeptModule,
    DictModule,
    ConfigModule,
    DashboardModule,
    GenModule,
    FilesModule,
    ProfileModule,
    LogsModule,
    DocsModule,
  ],
  providers: [
    // 守卫顺序：先鉴权（挂 req.user），再校验权限码
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 统一响应体包装
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // 写操作留痕
    { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor },
    // 全局异常 → 统一错误响应
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 全局：HTTP 访问日志
    // 用 `{*path}` 而非 `*`：后者是 path-to-regexp v8 之前的写法，加了全局前缀后 Nest 会将它
    // 视作 `/api/*` 并每次启动打一条路由转换告警（自动转成 `/api/{*path}`）。
    // 显式写等价形式即可消警，实际覆盖范围不变（仅 /api 下的请求；静态资源不计入访问日志）。
    consumer.apply(HttpAccessLoggerMiddleware).forRoutes('{*path}');

    // 静态资源链（鉴权 → 防盗链 → 图片缩放）不在这里挂：
    // consumer.apply 的路由会被全局前缀改写成 /api/static/...，永远匹配不到真实的 /static/...，
    // 且 useStaticAssets 注册更早会直接出图。改由 app.setup.ts 按顺序显式挂到 express。
  }
}
