/**
 * 菜单种子数据。
 * 模块职责：写入完整菜单树（目录 M / 菜单 C / 按钮 F），幂等执行。
 */
import { MenuType, Status } from '@/constants';
import { Menu } from '@/models';

/** 菜单种子节点定义。 */
interface MenuSeedNode {
  key: string;
  menuName: string;
  menuType: MenuType;
  path?: string;
  component?: string;
  icon?: string;
  permission?: string;
  sort: number;
  visible?: number;
  status?: number;
  redirect?: string;
  keepAlive?: number;
  children?: MenuSeedNode[];
}

/** 完整菜单树定义。 */
const MENU_TREE: MenuSeedNode[] = [
  {
    key: 'dashboard',
    menuName: '仪表盘',
    menuType: MenuType.MENU,
    path: '/dashboard',
    component: 'dashboard/index',
    icon: 'Odometer',
    sort: 1,
    visible: Status.ENABLED,
    keepAlive: 1,
  },
  {
    key: 'system',
    menuName: '系统管理',
    menuType: MenuType.DIRECTORY,
    path: '/system',
    icon: 'Setting',
    sort: 2,
    visible: Status.ENABLED,
    redirect: '/system/user',
    children: [
      {
        key: 'system:user',
        menuName: '用户管理',
        menuType: MenuType.MENU,
        path: '/system/user',
        component: 'system/user/index',
        icon: 'User',
        permission: 'system:user:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:user:query',
            menuName: '查询用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:query',
            sort: 1,
          },
          {
            key: 'system:user:add',
            menuName: '新增用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:add',
            sort: 2,
          },
          {
            key: 'system:user:edit',
            menuName: '编辑用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:edit',
            sort: 3,
          },
          {
            key: 'system:user:remove',
            menuName: '删除用户',
            menuType: MenuType.BUTTON,
            permission: 'system:user:remove',
            sort: 4,
          },
          {
            key: 'system:user:resetPwd',
            menuName: '重置密码',
            menuType: MenuType.BUTTON,
            permission: 'system:user:resetPwd',
            sort: 5,
          },
          {
            key: 'system:user:assignRole',
            menuName: '分配角色',
            menuType: MenuType.BUTTON,
            permission: 'system:user:assignRole',
            sort: 6,
          },
        ],
      },
      {
        key: 'system:role',
        menuName: '角色管理',
        menuType: MenuType.MENU,
        path: '/system/role',
        component: 'system/role/index',
        icon: 'UserFilled',
        permission: 'system:role:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:role:query',
            menuName: '查询角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:query',
            sort: 1,
          },
          {
            key: 'system:role:add',
            menuName: '新增角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:add',
            sort: 2,
          },
          {
            key: 'system:role:edit',
            menuName: '编辑角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:edit',
            sort: 3,
          },
          {
            key: 'system:role:remove',
            menuName: '删除角色',
            menuType: MenuType.BUTTON,
            permission: 'system:role:remove',
            sort: 4,
          },
          {
            key: 'system:role:assignMenu',
            menuName: '授权菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:role:assignMenu',
            sort: 5,
          },
        ],
      },
      {
        key: 'system:menu',
        menuName: '菜单管理',
        menuType: MenuType.MENU,
        path: '/system/menu',
        component: 'system/menu/index',
        icon: 'Menu',
        permission: 'system:menu:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:menu:query',
            menuName: '查询菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:query',
            sort: 1,
          },
          {
            key: 'system:menu:add',
            menuName: '新增菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:add',
            sort: 2,
          },
          {
            key: 'system:menu:edit',
            menuName: '编辑菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:edit',
            sort: 3,
          },
          {
            key: 'system:menu:remove',
            menuName: '删除菜单',
            menuType: MenuType.BUTTON,
            permission: 'system:menu:remove',
            sort: 4,
          },
        ],
      },
    ],
  },
  {
    key: 'log',
    menuName: '日志管理',
    menuType: MenuType.DIRECTORY,
    path: '/log',
    icon: 'Document',
    sort: 3,
    visible: Status.ENABLED,
    redirect: '/log/login',
    children: [
      {
        key: 'log:login',
        menuName: '登录日志',
        menuType: MenuType.MENU,
        path: '/log/login',
        component: 'log/login/index',
        icon: 'Key',
        permission: 'log:login:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:login:export',
            menuName: '导出登录日志',
            menuType: MenuType.BUTTON,
            permission: 'log:login:export',
            sort: 1,
          },
        ],
      },
      {
        key: 'log:operation',
        menuName: '操作日志',
        menuType: MenuType.MENU,
        path: '/log/operation',
        component: 'log/operation/index',
        icon: 'Document',
        permission: 'log:operation:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:operation:export',
            menuName: '导出操作日志',
            menuType: MenuType.BUTTON,
            permission: 'log:operation:export',
            sort: 1,
          },
        ],
      },
      {
        key: 'log:http',
        menuName: 'HTTP日志',
        menuType: MenuType.MENU,
        path: '/log/http',
        component: 'log/http/index',
        icon: 'Monitor',
        permission: 'log:http:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
      },
    ],
  },
  {
    key: 'file',
    menuName: '文件管理',
    menuType: MenuType.MENU,
    path: '/upload',
    component: 'upload/index',
    icon: 'FolderOpened',
    permission: 'file:list',
    sort: 4,
    visible: Status.ENABLED,
    keepAlive: 1,
    children: [
      { key: 'file:upload', menuName: '上传文件', menuType: MenuType.BUTTON, permission: 'file:upload', sort: 1 },
      { key: 'file:remove', menuName: '删除文件', menuType: MenuType.BUTTON, permission: 'file:remove', sort: 2 },
    ],
  },
  {
    key: 'profile',
    menuName: '个人中心',
    menuType: MenuType.MENU,
    path: '/profile',
    component: 'profile/index',
    icon: 'Avatar',
    sort: 5,
    visible: Status.DISABLED,
    keepAlive: 1,
  },
];

/**
 * 执行菜单种子（幂等：按 名称+父级+类型 去重）。
 * @returns key → 菜单 id 映射
 */
export async function seedMenu(): Promise<Map<string, number>> {
  const keyToId = new Map<string, number>();

  const walk = async (nodes: MenuSeedNode[], parentId: number): Promise<void> => {
    for (const node of nodes) {
      const [menu] = await Menu.findOrCreate({
        where: { menuName: node.menuName, parentId, menuType: node.menuType },
        defaults: {
          parentId,
          menuName: node.menuName,
          menuType: node.menuType,
          path: node.path ?? null,
          component: node.component ?? null,
          icon: node.icon ?? null,
          permission: node.permission ?? null,
          sort: node.sort,
          visible: node.visible ?? Status.ENABLED,
          status: node.status ?? Status.ENABLED,
          redirect: node.redirect ?? null,
          keepAlive: node.keepAlive ?? 0,
        },
      });
      const menuId = Number(menu.id);
      keyToId.set(node.key, menuId);
      if (node.children && node.children.length > 0) {
        await walk(node.children, menuId);
      }
    }
  };

  await walk(MENU_TREE, 0);
  console.log(`[Seed] 菜单数据完成，共 ${keyToId.size} 个节点`);
  return keyToId;
}
