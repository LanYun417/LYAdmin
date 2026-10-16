/**
 * 部门模块。
 * 模块职责：聚合部门 CRUD 与树查询接口。
 */
import { Module } from '@nestjs/common';
import { DeptController } from './depts.controller.js';
import { DeptService } from './depts.service.js';

@Module({
  controllers: [DeptController],
  providers: [DeptService],
})
export class DeptModule {}
