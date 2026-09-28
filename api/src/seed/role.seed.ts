/**
 * 角色种子数据。
 * 模块职责：写入默认角色（super_admin / admin / viewer）并完成菜单授权，幂等执行。
 */
import { Status, SUPER_ADMIN_ROLE } from '@/constants';
import { Role, RoleMenu } from '@/models';

/** 角色种子定义。 */
interface RoleSeed {
  roleCode: string;
  roleName: string;
  sort: number;
  status: number;
  remark: string;
  /** 授权菜单 key 列表，'ALL' 表示全部菜单 */
  menuKeys: string[] | 'ALL';
}

/** 默认角色定义。 */
const ROLE_SEEDS: RoleSeed[] = [
  {
    roleCode: SUPER_ADMIN_ROLE,
    roleName: '超级管理员',
    sort: 1,
    status: Status.ENABLED,
    remark: '系统最高权限，拥有全部菜单与按钮权限',
    menuKeys: 'ALL',
  },
  {
    roleCode: 'admin',
    roleName: '普通管理员',
    sort: 2,
    status: Status.ENABLED,
    remark: '业务运营管理者，可管理用户与查看日志',
    menuKeys: [
      'dashboard',
      'system',
      'system:user',
      'system:user:query',
      'system:user:add',
      'system:user:edit',
      'system:user:remove',
      'system:user:resetPwd',
      'system:user:assignRole',
      // 角色下拉（GET /api/roles/all 所需）；admin 无 system:role:list，靠此独立码拉下拉框
      'system:role:all',
      // 字典管理：admin 可维护字典（含启停用，复用 system:dict:edit）
      'system:dict',
      'system:dict:add',
      'system:dict:edit',
      'system:dict:remove',
      'log',
      'log:login',
      'log:login:export',
      'log:operation',
      'log:operation:export',
      'log:http',
      // 说明：admin 为「业务运营管理者」，不应持有系统级能力。以下两个权限码已回收，
      // 仅由超管（menuKeys: 'ALL'）持有：
      //   - log:http:clear —— 清空全量日志，属破坏性系统操作；
      //   - tool:gen:create —— 向源码目录写 .ts/.vue，属系统级代码生成能力。
      // 前端按钮已配置 v-permission，回收后 admin 侧将自动隐藏，无需改动前端。
      'file',
      'file:upload',
      'file:remove',
      'tool',
      'tool:gen',
      'tool:gen:preview',
      'tool:gen:download',
      'profile',
    ],
  },
  {
    roleCode: 'viewer',
    roleName: '只读访客',
    sort: 3,
    status: Status.ENABLED,
    // 严格只读：只授予查看/查询类权限码，任何写操作与破坏性操作（如 log:http:clear、
    // system:role:all 枚举全部角色）一律不得加入此列表，否则只读角色将获得越权能力。
    remark: '仅拥有查看类权限',
    menuKeys: [
      'dashboard',
      'system',
      'system:user',
      'system:user:query',
      // 字典管理：只读角色仅授予菜单节点（即只读的 system:dict:list），不含任何写权限码
      'system:dict',
      'log',
      'log:login',
      'log:operation',
      'log:http',
      'profile',
    ],
  },
];

/**
 * 执行角色种子。
 * @param menuIdMap 菜单 key → id 映射（由菜单种子产出）
 */
export async function seedRole(menuIdMap: Map<string, number>): Promise<void> {
  const allMenuIds = Array.from(menuIdMap.values());

  for (const seed of ROLE_SEEDS) {
    const [role] = await Role.findOrCreate({
      where: { roleCode: seed.roleCode },
      defaults: {
        roleName: seed.roleName,
        roleCode: seed.roleCode,
        sort: seed.sort,
        status: seed.status,
        remark: seed.remark,
      },
    });

    const menuIds =
      seed.menuKeys === 'ALL'
        ? allMenuIds
        : seed.menuKeys.map((key) => menuIdMap.get(key)).filter((id): id is number => typeof id === 'number');

    // 幂等：先清理该角色既有授权，再重建
    await RoleMenu.destroy({ where: { roleId: Number(role.id) } });
    if (menuIds.length > 0) {
      await RoleMenu.bulkCreate(
        menuIds.map((menuId) => ({ roleId: Number(role.id), menuId })),
        { ignoreDuplicates: true },
      );
    }
  }

  console.log(`[Seed] 角色数据完成，共 ${ROLE_SEEDS.length} 个角色`);
}
