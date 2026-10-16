/**
 * 应用根模块。
 * 模块职责：装配全局模块（数据库/基础设施/守卫/拦截器/过滤器）与各业务模块。
 */
import { MiddlewareConsumer, Module, Controller, Get, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthGuard, Public } from './common/auth.guard.js';
import { PermissionGuard } from './common/permission.guard.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { OperationLogInterceptor } from './common/operation-log.interceptor.js';
import { CommonModule } from './common/common.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HttpAccessLoggerMiddleware } from './common/http-access-log.middleware.js';
import { HotlinkGuardMiddleware, ImageScaleMiddleware } from './common/file-guards.js';
import { StaticAuthMiddleware } from './common/static-auth.middleware.js';
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

/** 健康检查：挂全局前缀下即 GET /api（对应原版）。 */
@Controller()
export class HealthController {
  @Public()
  @Get()
  health(): { name: string; status: string; time: string } {
    return { name: 'ly-admin-api', status: 'ok', time: new Date().toISOString() };
  }
}

@Module({
  imports: [
    PrismaModule,
    CommonModule,
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
  ],
  controllers: [HealthController],
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
    consumer.apply(HttpAccessLoggerMiddleware).forRoutes('*');

    // 静态资源链：鉴权 → 防盗链 → 图片缩放 → 静态出图
    // 顺序与原 Express 版一致：未通过鉴权即短路，连文件都不必读
    consumer.apply(StaticAuthMiddleware, HotlinkGuardMiddleware, ImageScaleMiddleware).forRoutes('static/{*path}');
  }
}
