/**
 * 系统参数模块。
 * 模块职责：聚合参数管理接口与业务取数接口。
 */
import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller.js';
import { ConfigService } from './config.service.js';

@Module({
  controllers: [ConfigController],
  providers: [ConfigService],
})
export class ConfigModule {}
