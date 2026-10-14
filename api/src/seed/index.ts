/**
 * 种子数据入口。
 * 模块职责：按 menu → role → user 顺序执行种子，供 server 启动或 `npm run seed` 调用。
 */
import { sequelize } from '@/config/database';
import { DataTypes, Op } from 'sequelize';
import { connectDatabase, syncDatabase } from '@/config/database';
import { SysConfig, Menu } from '@/models';
import { seedConfig } from './config.seed';
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
 * 历史字段迁移：为 `sys_http_log` 追加操作者快照列（幂等）。
 * 背景：同 `dept_id` —— `sync({ alter: false })` 不给既有表加列，故在此手动补齐。
 * 取值全部来自写入时的鉴权上下文，既有历史行默认「匿名」（user_id=0），表示当时未记录。
 */
async function ensureHttpLogOperatorColumns(): Promise<void> {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable('sys_http_log');

  const columnsToAdd: Array<{
    name: 'user_id' | 'username' | 'dept_id' | 'dept_name';
    options: Parameters<typeof queryInterface.addColumn>[2];
  }> = [
    {
      name: 'user_id',
      options: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: '操作用户 id（0 为匿名/未登录）',
      },
    },
    {
      name: 'username',
      options: { type: DataTypes.STRING(50), allowNull: true, comment: '操作账号（快照）' },
    },
    {
      name: 'dept_id',
      options: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: '所属部门 id（快照，0 为无）',
      },
    },
    {
      name: 'dept_name',
      options: { type: DataTypes.STRING(50), allowNull: true, comment: '所属部门名称（快照）' },
    },
  ];

  for (const column of columnsToAdd) {
    if (!(column.name in columns)) {
      await queryInterface.addColumn('sys_http_log', column.name, column.options);
      console.log(`[Seed] 已为 sys_http_log 追加 ${column.name} 列`);
    }
  }

  // 既有表不会自动应用模型上的新增索引，此处按 indexName 幂等补齐
  // 说明：sequelize 的 showIndex 在本版本返回类型不够精确（`object`），故显式断言成索引数组
  const indexes = (await queryInterface.showIndex('sys_http_log')) as Array<{ name?: string }>;
  const existingIndexNames = new Set(indexes.map((index: { name?: string }) => String(index.name)));
  await Promise.all(
    (
      [
        { name: 'idx_user_id', fields: ['user_id'] },
        { name: 'idx_dept_id', fields: ['dept_id'] },
      ] as const
    )
      .filter((index) => !existingIndexNames.has(index.name))
      .map(async (index) => {
        await queryInterface.addIndex('sys_http_log', { name: index.name, fields: [...index.fields] });
        console.log(`[Seed] 已为 sys_http_log 补建索引 ${index.name}`);
      }),
  );
}

/**
 * 清理历史遗留的废弃系统参数。
 * 背景：早期实验版曾把 `sys.company.name`（参数名称"公司名称"）写入种子并入库存量数据；
 * 后续方案改为「顶级部门即公司」，已将该项从 `CONFIG_SEEDS` 移除。由于种子只增不删，
 * 既有库中已插入的行不会自动消失，导致参数管理页面仍列出"公司名称"。此处按 configKey
 * 幂等删除，任何环境重启服务即自愈，且不影响其他参数。
 */
async function cleanupObsoleteConfigs(): Promise<void> {
  const OBSOLETE_CONFIG_KEYS = ['sys.company.name'];
  const deleted = await SysConfig.destroy({
    where: { configKey: { [Op.in]: OBSOLETE_CONFIG_KEYS } },
  });
  if (deleted > 0) {
    console.log(`[Seed] 已清理废弃系统参数 ${deleted} 项：${OBSOLETE_CONFIG_KEYS.join(', ')}`);
  }
}

/**
 * 已知歧义的旧图标组件名 → 原生图标名。
 *
 * 原生类名的数字连字符规则**不一致**：`diagram-3` 对应 `BIconDiagram3`（数字前有连字符），
 * 而 `speedometer2` 对应 `BIconSpeedometer2`（数字前无连字符）。两者组件名形式完全相同，
 * 却指向不同的原生类名，无法用统一规则还原，只能显式列出。
 * 实际会出现在库里的只有旧注册表收录过的图标，其中仅 diagram 系列命中该歧义。
 */
const LEGACY_ICON_ALIASES: Record<string, string> = {
  BIconDiagram2: 'diagram-2',
  BIconDiagram3: 'diagram-3',
};

/**
 * 旧组件名（`BIconBarChartLine`）→ 原生图标名（`bar-chart-line`）。
 * @param legacy 旧格式组件名
 * @returns 原生图标名
 */
function toNativeIconName(legacy: string): string {
  const alias = LEGACY_ICON_ALIASES[legacy];
  if (alias) {
    return alias;
  }
  return legacy
    .replace(/^BIcon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 历史数据迁移：把 `sys_menu.icon` 中旧的图标**组件名**转成 Bootstrap Icons 原生类名（幂等）。
 *
 * 背景：图标方案已由 `bootstrap-icons-vue` 的 SVG 组件改为 `bootstrap-icons` 的图标字体，
 * 前端改为直接使用 CSS 类名（`<i class="bi bi-diagram-3" />`），组件注册表已废弃。
 * 库里遗留的旧值（形如 `BIconDiagram3`）无法再渲染，故在启动时一次性归一化。
 * 迁移完成后不再有匹配行，后续启动为空操作。
 */
async function migrateLegacyMenuIcons(): Promise<void> {
  const rows = await Menu.findAll({
    where: { icon: { [Op.like]: 'BIcon%' } },
    attributes: ['id', 'icon'],
  });
  if (rows.length === 0) {
    return;
  }
  await Promise.all(
    rows.map(async (row) => {
      const legacy = String(row.icon);
      const native = toNativeIconName(legacy);
      await Menu.update({ icon: native }, { where: { id: row.id } });
      console.log(`[Seed] 菜单图标已迁移：${legacy} -> ${native}`);
    }),
  );
  console.log(`[Seed] 已迁移 ${rows.length} 个历史菜单图标为 Bootstrap Icons 原生类名`);
}

/**
 * 执行全部种子（幂等）。
 * 注意：字段迁移必须先于种子执行 —— 模型已声明新列（dept_id / data_scope），
 * 种子对 sys_user / sys_role 的任何查询与写入都会引用这些列；既有库首次启动时
 * 若先跑种子会直接报 `Unknown column`，因此迁移前置。
 */
export async function runSeed(): Promise<void> {
  await ensureUserDeptColumn();
  await ensureRoleDataScopeColumn();
  await ensureHttpLogOperatorColumns();
  await cleanupObsoleteConfigs();
  await migrateLegacyMenuIcons();

  const menuIdMap = await seedMenu();
  await seedRole(menuIdMap);
  await seedUser();
  await seedDict();
  await seedConfig();
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
