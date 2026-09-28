/**
 * 种子数据入口。
 * 模块职责：按 menu → role → user 顺序执行种子，供 server 启动或 `npm run seed` 调用。
 */
import { sequelize } from '@/config/database';
import { DataTypes } from 'sequelize';
import { connectDatabase, syncDatabase } from '@/config/database';
import { seedDict } from './dict.seed';
import { seedMenu } from './menu.seed';
import { seedRole } from './role.seed';
import { seedUser } from './user.seed';

/**
 * 历史字段迁移：为 `sys_user` 追加 `dept_id` 列（幂等）。
 * 背景：项目约定 `sync({ alter: false })` 只建缺失表、绝不给既有表加列，因此新增的
 * `dept_id` 需在此处手动补齐，保证既有库在启动后即可正常使用「用户归属部门」能力。
 */
async function ensureUserDeptColumn(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('sys_user');
  if (!('dept_id' in columns)) {
    await queryInterface.addColumn('sys_user', 'dept_id', {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      comment: '部门 id（0 表示未分配）',
    });
    console.log('[Seed] 已为 sys_user 追加 dept_id 列');
  }
}

/**
 * 历史字段迁移：为 `sys_role` 追加 `data_scope` 列（幂等）。
 * 存量角色默认「全部数据」（1），行为与升级前一致，需要收紧时在角色管理中调整。
 */
async function ensureRoleDataScopeColumn(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('sys_role');
  if (!('data_scope' in columns)) {
    await queryInterface.addColumn('sys_role', 'data_scope', {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 1,
      comment: '数据权限范围：1 全部 / 2 自定义部门 / 3 本部门及以下 / 4 仅本人',
    });
    console.log('[Seed] 已为 sys_role 追加 data_scope 列');
  }
}

/**
 * 执行全部种子（幂等）。
 */
export async function runSeed(): Promise<void> {
  const menuIdMap = await seedMenu();
  await seedRole(menuIdMap);
  await seedUser();
  await seedDict();
  await ensureUserDeptColumn();
  await ensureRoleDataScopeColumn();
  console.log('[Seed] 种子数据初始化完成');
}

// 支持 `npm run seed` 直接执行
if (require.main === module) {
  (async () => {
    try {
      await connectDatabase();
      await syncDatabase();
      await runSeed();
      process.exit(0);
    } catch (error) {
      console.error('[Seed] 执行失败:', error);
      process.exit(1);
    }
  })();
}
