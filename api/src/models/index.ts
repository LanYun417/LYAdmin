/**
 * 模型汇总入口。
 * 模块职责：统一导出全部模型与模型数组（供 Sequelize 注册关联）。
 */
import { DictItem } from './DictItem';
import { DictType } from './DictType';
import { Dept } from './Dept';
import { File } from './File';
import { HttpLog } from './HttpLog';
import { LoginLog } from './LoginLog';
import { Menu } from './Menu';
import { OperationLog } from './OperationLog';
import { Role } from './Role';
import { RoleDept } from './RoleDept';
import { RoleMenu } from './RoleMenu';
import { User } from './User';
import { UserRole } from './UserRole';

export { User } from './User';
export { Role } from './Role';
export { Menu } from './Menu';
export { UserRole } from './UserRole';
export { RoleMenu } from './RoleMenu';
export { RoleDept } from './RoleDept';
export { LoginLog } from './LoginLog';
export { OperationLog } from './OperationLog';
export { File } from './File';
export { HttpLog } from './HttpLog';
export { DictType } from './DictType';
export { DictItem } from './DictItem';
export { Dept } from './Dept';

/** 全部模型数组，传入 Sequelize 构造函数以注册表与关联。 */
export const models = [
  User,
  Role,
  Menu,
  UserRole,
  RoleMenu,
  LoginLog,
  OperationLog,
  File,
  HttpLog,
  DictType,
  DictItem,
  Dept,
  RoleDept,
];
