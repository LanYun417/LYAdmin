/**
 * IP 访问控制模块。
 * 模块职责：规则 CRUD 接口 + 供全局中间件复用的判定服务。
 *
 * 声明为全局模块：IpAccessMiddleware 在 AppModule.configure 里注册，其 DI 上下文
 * 需要能解析 IpRuleService；全局导出可免去在 AppModule 重复 providers 声明。
 */
import { Global, Module } from '@nestjs/common';
import { IpRuleController } from './ip-rule.controller.js';
import { IpRuleService } from './ip-rule.service.js';

@Global()
@Module({
  controllers: [IpRuleController],
  providers: [IpRuleService],
  exports: [IpRuleService],
})
export class IpRuleModule {}
