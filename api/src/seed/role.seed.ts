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
      'log',
      'log:login',
      'log:login:export',
      'log:operation',
      'log:operation:export',
      'log:http',
      'log:http:clear',
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
    // 严格只读：只授予查看/查询类权限码，任何写操作与破坏性操作（如 log:http:clear）
    // 一律不得加入此列表，否则只读角色将获得越权能力。
    remark: '仅拥有查看类权限',
    menuKeys: [
      'dashboard',
      'system',
      'system:user',
      'system:user:query',
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
