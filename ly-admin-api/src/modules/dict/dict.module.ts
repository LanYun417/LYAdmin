/**
 * 字典模块。
 * 模块职责：聚合字典类型 / 字典项的查询、CRUD、启停用与业务取数接口。
 */
import { Module } from '@nestjs/common';
import { DictController } from './dict.controller.js';
import { DictService } from './dict.service.js';

@Module({
  controllers: [DictController],
  providers: [DictService],
})
export class DictModule {}
