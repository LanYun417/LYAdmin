/**
 * 种子数据。
 * 模块职责：把默认菜单 / 角色 / 用户 / 字典 / 系统参数幂等写入数据库，并执行两条
 * 「既有库自愈」的数据归一（废弃系统参数清理、菜单图标名归一化）。
 *
 * 职责边界：
 * - 建表与列变更由 `prisma db push` 按 schema 统一完成（见 prisma/schema/ 各文件），本文件不承担 DDL；
 * - 本文件只负责**数据**：默认数据的幂等写入与存量数据的收敛。
 *
 * 执行时机：
 * - 服务启动时由 SeedService 的 onApplicationBootstrap 自动执行，早于 app.listen；
 * - 也可手动执行：`npm run seed`（入口见 prisma/seed.ts）。
 */
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { DataScope, MenuType, Status, SUPER_ADMIN_ROLE } from '../common/config/constants.js';
import { hashPassword } from '../common/utils/utils.js';
import { PrismaService } from './prisma.service.js';

/** 日志上下文（种子各步骤共用）。 */
const logger = new Logger('Seed');

/* --------------------------------- 菜单种子 -------------------------------- */

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

/** 完整菜单树定义（目录 M / 菜单 C / 按钮 F）。 */
const MENU_TREE: MenuSeedNode[] = [
  {
    key: 'dashboard',
    menuName: '首页',
    menuType: MenuType.MENU,
    path: '/home',
    component: 'home/index',
    icon: 'speedometer2',
    sort: 1,
    visible: Status.ENABLED,
    keepAlive: 1,
  },
  {
    key: 'system',
    menuName: '系统管理',
    menuType: MenuType.DIRECTORY,
    path: '/system',
    icon: 'gear',
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
        icon: 'person',
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
          {
            key: 'system:user:assignPerm',
            menuName: '额外权限',
            menuType: MenuType.BUTTON,
            permission: 'system:user:assignPerm',
            sort: 7,
          },
        ],
      },
      {
        key: 'system:role',
        menuName: '角色管理',
        menuType: MenuType.MENU,
        path: '/system/role',
        component: 'system/role/index',
        icon: 'shield-check',
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
          {
            key: 'system:role:all',
            menuName: '角色下拉',
            menuType: MenuType.BUTTON,
            permission: 'system:role:all',
            sort: 6,
          },
        ],
      },
      {
        key: 'system:menu',
        menuName: '菜单管理',
        menuType: MenuType.MENU,
        path: '/system/menu',
        component: 'system/menu/index',
        icon: 'list',
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
      {
        key: 'system:dict',
        menuName: '字典管理',
        menuType: MenuType.MENU,
        path: '/system/dict',
        component: 'system/dict/index',
        icon: 'tags',
        permission: 'system:dict:list',
        sort: 4,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:dict:add',
            menuName: '新增字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:add',
            sort: 1,
          },
          {
            key: 'system:dict:edit',
            menuName: '编辑字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:edit',
            sort: 2,
          },
          {
            key: 'system:dict:remove',
            menuName: '删除字典',
            menuType: MenuType.BUTTON,
            permission: 'system:dict:remove',
            sort: 3,
          },
        ],
      },
      {
        key: 'system:dept',
        menuName: '部门/岗位管理',
        menuType: MenuType.MENU,
        path: '/system/dept',
        component: 'system/dept/index',
        icon: 'diagram-3',
        permission: 'system:dept:list',
        sort: 5,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:dept:query',
            menuName: '查询',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:query',
            sort: 1,
          },
          {
            key: 'system:dept:add',
            menuName: '新增',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:add',
            sort: 2,
          },
          {
            key: 'system:dept:edit',
            menuName: '编辑',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:edit',
            sort: 3,
          },
          {
            key: 'system:dept:remove',
            menuName: '删除',
            menuType: MenuType.BUTTON,
            permission: 'system:dept:remove',
            sort: 4,
          },
        ],
      },
      {
        key: 'system:notice',
        menuName: '通知中心',
        menuType: MenuType.MENU,
        path: '/system/notice',
        component: 'system/notice/index',
        icon: 'bell',
        permission: 'system:notice:list',
        sort: 7,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:notice:add',
            menuName: '发布通知',
            menuType: MenuType.BUTTON,
            permission: 'system:notice:add',
            sort: 1,
          },
        ],
      },
      {
        key: 'system:config',
        menuName: '参数管理',
        menuType: MenuType.MENU,
        path: '/system/config',
        component: 'system/config/index',
        icon: 'sliders',
        permission: 'system:config:list',
        sort: 6,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'system:config:query',
            menuName: '查询参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:query',
            sort: 1,
          },
          {
            key: 'system:config:add',
            menuName: '新增参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:add',
            sort: 2,
          },
          {
            key: 'system:config:edit',
            menuName: '编辑参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:edit',
            sort: 3,
          },
          {
            key: 'system:config:remove',
            menuName: '删除参数',
            menuType: MenuType.BUTTON,
            permission: 'system:config:remove',
            sort: 4,
          },
        ],
      },
    ],
  },
  {
    key: 'monitor',
    menuName: '监控管理',
    menuType: MenuType.DIRECTORY,
    path: '/monitor',
    icon: 'activity',
    sort: 6,
    visible: Status.ENABLED,
    redirect: '/monitor/online',
    children: [
      {
        key: 'monitor:online',
        menuName: '在线用户',
        menuType: MenuType.MENU,
        path: '/monitor/online',
        component: 'monitor/online/index',
        icon: 'people',
        permission: 'monitor:online:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'monitor:online:forceLogout',
            menuName: '强制下线',
            menuType: MenuType.BUTTON,
            permission: 'monitor:online:forceLogout',
            sort: 1,
          },
        ],
      },
      {
        key: 'monitor:server',
        menuName: '系统监控',
        menuType: MenuType.MENU,
        path: '/monitor/server',
        component: 'monitor/server/index',
        icon: 'cpu',
        permission: 'monitor:server:list',
        sort: 2,
        visible: Status.ENABLED,
        // 不缓存：页面每次进入重新取指标并重建定时器，避免看到已停止刷新的旧曲线
        keepAlive: 0,
      },
    ],
  },
  {
    key: 'log',
    menuName: '日志管理',
    menuType: MenuType.DIRECTORY,
    path: '/log',
    icon: 'file-earmark-text',
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
        icon: 'key',
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
          {
            key: 'log:login:remove',
            menuName: '删除登录日志',
            menuType: MenuType.BUTTON,
            permission: 'log:login:remove',
            sort: 2,
          },
        ],
      },
      {
        key: 'log:operation',
        menuName: '操作日志',
        menuType: MenuType.MENU,
        path: '/log/operation',
        component: 'log/operation/index',
        icon: 'file-earmark-text',
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
          {
            key: 'log:operation:remove',
            menuName: '删除操作日志',
            menuType: MenuType.BUTTON,
            permission: 'log:operation:remove',
            sort: 2,
          },
        ],
      },
      {
        key: 'log:http',
        menuName: 'HTTP日志',
        menuType: MenuType.MENU,
        path: '/log/http',
        component: 'log/http/index',
        icon: 'display',
        permission: 'log:http:list',
        sort: 3,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'log:http:export',
            menuName: '导出HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:export',
            sort: 1,
          },
          {
            key: 'log:http:clear',
            menuName: '清空HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:clear',
            sort: 2,
          },
          {
            key: 'log:http:remove',
            menuName: '删除HTTP日志',
            menuType: MenuType.BUTTON,
            permission: 'log:http:remove',
            sort: 3,
          },
        ],
      },
    ],
  },
  {
    key: 'file',
    menuName: '文件管理',
    menuType: MenuType.MENU,
    path: '/files',
    component: 'files/index',
    icon: 'folder2-open',
    permission: 'file:list',
    sort: 4,
    visible: Status.ENABLED,
    keepAlive: 1,
    children: [
      { key: 'file:upload', menuName: '上传文件', menuType: MenuType.BUTTON, permission: 'file:upload', sort: 1 },
      { key: 'file:remove', menuName: '删除文件', menuType: MenuType.BUTTON, permission: 'file:remove', sort: 2 },
      { key: 'file:download', menuName: '下载文件', menuType: MenuType.BUTTON, permission: 'file:download', sort: 3 },
    ],
  },
  {
    key: 'tool',
    menuName: '系统工具',
    menuType: MenuType.DIRECTORY,
    path: '/tool',
    icon: 'tools',
    sort: 5,
    visible: Status.ENABLED,
    redirect: '/tool/gen',
    children: [
      {
        key: 'tool:gen',
        menuName: '代码生成',
        menuType: MenuType.MENU,
        path: '/tool/gen',
        component: 'tool/gen/index',
        icon: 'code-slash',
        permission: 'tool:gen:list',
        sort: 1,
        visible: Status.ENABLED,
        keepAlive: 1,
        children: [
          {
            key: 'tool:gen:preview',
            menuName: '预览代码',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:preview',
            sort: 1,
          },
          {
            key: 'tool:gen:download',
            menuName: '下载代码',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:download',
            sort: 2,
          },
          {
            key: 'tool:gen:create',
            menuName: '生成到项目',
            menuType: MenuType.BUTTON,
            permission: 'tool:gen:create',
            sort: 3,
          },
        ],
      },
      {
        key: 'tool:vditor',
        menuName: 'Vditor 编辑器',
        menuType: MenuType.MENU,
        path: '/tool/vditor',
        component: 'tool/vditor/index',
        icon: 'pencil',
        permission: 'tool:vditor:list',
        sort: 2,
        visible: Status.ENABLED,
        keepAlive: 1,
      },
    ],
  },
  {
    key: 'docs',
    menuName: '接口文档',
    menuType: MenuType.MENU,
    path: '/docs',
    component: 'docs/index',
    icon: 'journal-text',
    sort: 6,
    visible: Status.ENABLED,
    keepAlive: 1,
  },
  {
    key: 'profile',
    menuName: '个人中心',
    menuType: MenuType.MENU,
    path: '/profile',
    component: 'profile/index',
    icon: 'person-circle',
    sort: 5,
    visible: Status.DISABLED,
    keepAlive: 1,
  },
  // [GEN-ANCHOR] 代码生成器自动插入位置，请勿删除（gen.writer 会在本行之前插入新模块菜单节点）
];

/**
 * 写入菜单树（幂等：按 名称 + 父级 + 类型 去重，已存在则复用其 id）。
 * @param prisma Prisma 客户端
 * @returns key → 菜单 id 映射
 */
async function seedMenu(prisma: PrismaService): Promise<Map<string, number>> {
  const keyToId = new Map<string, number>();

  const walk = async (nodes: MenuSeedNode[], parentId: number): Promise<void> => {
    for (const node of nodes) {
      const existing = await prisma.menu.findFirst({
        where: { menuName: node.menuName, parentId: BigInt(parentId), menuType: node.menuType },
      });
      const menu =
        existing ??
        (await prisma.menu.create({
          data: {
            parentId: BigInt(parentId),
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
        }));

      const menuId = Number(menu.id);
      keyToId.set(node.key, menuId);
      if (node.children && node.children.length > 0) {
        await walk(node.children, menuId);
      }
    }
  };

  await walk(MENU_TREE, 0);
  return keyToId;
}

/* --------------------------------- 角色种子 -------------------------------- */

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
      // 用户额外权限（在角色之上给单个用户加/减权限）
      'system:user:assignPerm',
      // 角色下拉（GET /api/roles/all 所需）；admin 无 system:role:list，靠此独立码拉下拉框
      'system:role:all',
      // 字典管理：admin 可维护字典（含启停用，复用 system:dict:edit）
      'system:dict',
      'system:dict:add',
      'system:dict:edit',
      'system:dict:remove',
      // 部门管理：admin 可维护部门树
      'system:dept',
      'system:dept:query',
      'system:dept:add',
      'system:dept:edit',
      'system:dept:remove',
      // 参数管理：admin 可维护系统参数
      'system:config',
      'system:config:query',
      'system:config:add',
      'system:config:edit',
      'system:config:remove',
      'log',
      'log:login',
      'log:login:export',
      'log:operation',
      'log:operation:export',
      'log:http',
      // HTTP 日志导出属只读查看能力，与登录/操作日志导出保持一致授予 admin
      'log:http:export',
      // 说明：admin 为「业务运营管理者」，不应持有系统级能力。以下两个权限码已回收，
      // 仅由超管（menuKeys: 'ALL'）持有：
      //   - log:http:clear —— 清空全量日志，属破坏性系统操作；
      //   - tool:gen:create —— 向源码目录写 .ts/.vue，属系统级代码生成能力。
      // 前端按钮已配置 v-permission，回收后 admin 侧将自动隐藏，无需改动前端。
      'file',
      'file:upload',
      'file:remove',
      'file:download',
      'tool',
      'tool:gen',
      'tool:gen:preview',
      'tool:gen:download',
      // Vditor 编辑器示例页（纯前端，只读的查看类权限）
      // 注意：此处为**菜单节点的 key**（非权限码），写错会导致该角色拿不到授权
      'tool:vditor',
      // 接口文档（纯只读的查看类菜单，无按钮权限码）
      'docs',
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
      // 部门管理：只读角色仅授予菜单节点（即只读的 system:dept:list），不含任何写权限码
      'system:dept',
      // 参数管理：只读角色仅授予菜单节点（即只读的 system:config:list），不含任何写权限码
      'system:config',
      'log',
      'log:login',
      'log:operation',
      'log:http',
      // 接口文档（纯只读的查看类菜单，无写操作）
      'docs',
      'profile',
    ],
  },
];

/**
 * 写入默认角色并重建其菜单授权（幂等：授权每次按种子定义重建）。
 * @param prisma Prisma 客户端
 * @param menuIdMap 菜单 key → id 映射（由菜单种子产出）
 */
async function seedRole(prisma: PrismaService, menuIdMap: Map<string, number>): Promise<void> {
  const allMenuIds = Array.from(menuIdMap.values());

  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.upsert({
      where: { roleCode: seed.roleCode },
      update: {},
      create: {
        roleName: seed.roleName,
        roleCode: seed.roleCode,
        sort: seed.sort,
        status: seed.status,
        // 存量角色保持「全部数据」，需要收紧时在角色管理中按需调整
        dataScope: DataScope.ALL,
        remark: seed.remark,
      },
    });

    const menuIds =
      seed.menuKeys === 'ALL'
        ? allMenuIds
        : seed.menuKeys.map((key) => menuIdMap.get(key)).filter((id): id is number => typeof id === 'number');

    // 幂等：先清理该角色既有授权，再重建
    const roleId = role.id;
    await prisma.roleMenu.deleteMany({ where: { roleId } });
    if (menuIds.length > 0) {
      await prisma.roleMenu.createMany({
        data: menuIds.map((menuId) => ({ roleId, menuId: BigInt(menuId) })),
        skipDuplicates: true,
      });
    }
  }
}

/* --------------------------------- 用户种子 -------------------------------- */

/** 种子超管口令的默认值（仅本地开发便利，生产部署必须用 `SEED_ADMIN_PASSWORD` 覆盖）。 */
const DEFAULT_SEED_ADMIN_PASSWORD = '123456';

/**
 * 实际生效的种子超管口令。
 *
 * 单独抽成导出函数是为了让 e2e 测试**复用同一套取值逻辑**：曾经测试里硬编码 `123456`，
 * 而 CI 通过环境变量注入 `SEED_ADMIN_PASSWORD`，两边一不一致就 401（真实发生过）。
 */
export function resolveSeedAdminPassword(): string {
  return process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_SEED_ADMIN_PASSWORD;
}

/**
 * 写入超级管理员 `admin` 并绑定超管角色（幂等：已存在的账号不覆盖密码）。
 *
 * 口令来自 `SEED_ADMIN_PASSWORD`；未配置时回退默认值，并在生产环境打 warn —— 默认口令
 * 是弱口令（且不满足口令策略的长度要求，仅因为种子直写哈希才绕过了校验）。
 */
async function seedUser(prisma: PrismaService): Promise<void> {
  const superRole = await prisma.role.findUnique({ where: { roleCode: SUPER_ADMIN_ROLE } });
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const password = configuredPassword || DEFAULT_SEED_ADMIN_PASSWORD;
  if (!configuredPassword && process.env.NODE_ENV === 'production') {
    logger.warn('[Seed] 未配置 SEED_ADMIN_PASSWORD，超管账号使用默认弱口令；请设置后重新执行种子或立即改密');
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: await hashPassword(password),
      nickname: '超级管理员',
      status: Status.ENABLED,
      remark: '内置超级管理员账号',
    },
  });

  if (superRole) {
    const userId = admin.id;
    const roleId = superRole.id;
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId } },
      update: {},
      create: { userId, roleId },
    });
  }
}

/* --------------------------------- 字典种子 -------------------------------- */

/** 字典项种子定义。 */
interface DictItemSeed {
  dictLabel: string;
  dictValue: string;
  sort: number;
  remark?: string;
}

/** 字典类型种子定义。 */
interface DictTypeSeed {
  dictName: string;
  dictType: string;
  remark: string;
  items: DictItemSeed[];
}

/** 默认字典定义。 */
const DICT_SEEDS: DictTypeSeed[] = [
  {
    dictName: '用户性别',
    dictType: 'sys_user_sex',
    remark: '用户性别列表',
    items: [
      { dictLabel: '男', dictValue: '1', sort: 1 },
      { dictLabel: '女', dictValue: '2', sort: 2 },
      { dictLabel: '未知', dictValue: '0', sort: 3 },
    ],
  },
  {
    dictName: '系统是否',
    dictType: 'sys_yes_no',
    remark: '通用是否（Y / N）',
    items: [
      { dictLabel: '是', dictValue: 'Y', sort: 1 },
      { dictLabel: '否', dictValue: 'N', sort: 2 },
    ],
  },
  {
    dictName: '通用状态',
    dictType: 'sys_common_status',
    remark: '启用 / 禁用',
    items: [
      { dictLabel: '启用', dictValue: '1', sort: 1 },
      { dictLabel: '禁用', dictValue: '0', sort: 2 },
    ],
  },
];

/**
 * 写入常用字典类型与字典项（幂等：类型按 dictType、项按「类型 + 值」去重，已存在则跳过，
 * 不覆盖使用者在界面上后续做的修改）。
 */
async function seedDict(prisma: PrismaService): Promise<void> {
  let typeCreated = 0;
  let itemCreated = 0;

  for (const seed of DICT_SEEDS) {
    const exists = await prisma.dictType.findUnique({ where: { dictType: seed.dictType } });
    if (!exists) {
      await prisma.dictType.create({
        data: {
          dictName: seed.dictName,
          dictType: seed.dictType,
          status: Status.ENABLED,
          remark: seed.remark,
        },
      });
      typeCreated += 1;
    }

    for (const item of seed.items) {
      // dict_item 上只有 dictType 普通索引、无唯一约束，故用 findFirst + create 表达 findOrCreate
      const itemExists = await prisma.dictItem.findFirst({
        where: { dictType: seed.dictType, dictValue: item.dictValue },
      });
      if (!itemExists) {
        await prisma.dictItem.create({
          data: {
            dictType: seed.dictType,
            dictLabel: item.dictLabel,
            dictValue: item.dictValue,
            sort: item.sort,
            status: Status.ENABLED,
            remark: item.remark ?? null,
          },
        });
        itemCreated += 1;
      }
    }
  }

  logger.log(`字典数据完成，新增 ${typeCreated} 个字典类型 / ${itemCreated} 个字典项`);
}

/* ------------------------------- 系统参数种子 ------------------------------- */

/** 内置参数定义。 */
interface ConfigSeed {
  configName: string;
  configKey: string;
  configValue: string;
  remark: string;
}

/** 内置参数（登录安全等模块的运行时可调项）。 */
const CONFIG_SEEDS: ConfigSeed[] = [
  {
    configName: '登录失败锁定阈值',
    configKey: 'sys.account.maxLoginAttempts',
    configValue: '5',
    remark: '同一账号连续登录失败达到该次数后触发锁定（登录安全加固模块读取）',
  },
  {
    configName: '账号锁定时长（分钟）',
    configKey: 'sys.account.lockMinutes',
    configValue: '15',
    remark: '登录锁定持续时间，超过后自动解除锁定',
  },
];

/** 写入内置系统参数（幂等：按 configKey 去重，已存在的键不覆盖现值，便于运维自行调参）。 */
async function seedConfig(prisma: PrismaService): Promise<void> {
  for (const seed of CONFIG_SEEDS) {
    await prisma.sysConfig.upsert({
      where: { configKey: seed.configKey },
      update: {},
      create: {
        configName: seed.configName,
        configKey: seed.configKey,
        configValue: seed.configValue,
        systemFlag: 1,
        remark: seed.remark,
      },
    });
  }
  logger.log(`系统参数数据完成，共 ${CONFIG_SEEDS.length} 项`);
}

/* ------------------------------ 既有库数据归一 ------------------------------ */

/**
 * 清理废弃的系统参数。
 * 背景：`sys.company.name` 已不再属于种子定义（公司信息由「顶级部门」承载）。种子只增不删，
 * 既有库中残留的行不会自动消失，会导致参数管理页面仍列出「公司名称」。此处按 configKey
 * 幂等删除，任何环境重启即收敛，且不影响其他参数。
 */
async function cleanupObsoleteConfigs(prisma: PrismaService): Promise<void> {
  const OBSOLETE_CONFIG_KEYS = ['sys.company.name'];
  const { count } = await prisma.sysConfig.deleteMany({ where: { configKey: { in: OBSOLETE_CONFIG_KEYS } } });
  if (count > 0) {
    logger.log(`已清理废弃系统参数 ${count} 项：${OBSOLETE_CONFIG_KEYS.join(', ')}`);
  }
}

/**
 * 组件名无法直接推导的图标别名。
 *
 * 原生类名的数字连字符规则**不一致**：`diagram-3` 对应 `BIconDiagram3`（数字前有连字符），
 * 而 `speedometer2` 对应 `BIconSpeedometer2`（数字前无连字符）。两者组件名形式完全相同，
 * 却指向不同的原生类名，无法用统一规则还原，只能显式列出（仅 diagram 系列命中该歧义）。
 */
const ICON_ALIASES: Record<string, string> = {
  BIconDiagram2: 'diagram-2',
  BIconDiagram3: 'diagram-3',
};

/** 组件名（`BIconBarChartLine`）→ 原生图标名（`bar-chart-line`）。 */
function toNativeIconName(name: string): string {
  const alias = ICON_ALIASES[name];
  if (alias) {
    return alias;
  }
  return name
    .replace(/^BIcon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/**
 * 归一化 `sys_menu.icon`：把组件名形式（`BIconDiagram3`）转成 Bootstrap Icons 原生类名（`diagram-3`）。
 *
 * 约定：`sys_menu.icon` 统一存储原生类名，前端以 `<i class="bi bi-diagram-3" />` 渲染。
 * 存量行若为组件名形式则无法渲染，故在启动时做一次幂等转换；归一化完成后不再有匹配行，
 * 后续启动为空操作。
 */
async function normalizeMenuIcons(prisma: PrismaService): Promise<void> {
  const rows = await prisma.menu.findMany({
    where: { icon: { startsWith: 'BIcon' } },
    select: { id: true, icon: true },
  });
  if (rows.length === 0) {
    return;
  }

  for (const row of rows) {
    const name = String(row.icon);
    const native = toNativeIconName(name);
    await prisma.menu.update({ where: { id: row.id }, data: { icon: native } });
    logger.log(`菜单图标已归一化：${name} -> ${native}`);
  }
  logger.log(`已归一化 ${rows.length} 个菜单图标为 Bootstrap Icons 原生类名`);
}

/* ---------------------------------- 入口 ---------------------------------- */

/**
 * 执行全部种子（幂等）。
 * 顺序：先做既有库数据归一（清理废弃参数、归一化图标名），
 * 再按 菜单 → 角色 → 用户 → 字典 → 系统参数 写入种子数据。
 */
export async function runSeed(prisma: PrismaService): Promise<void> {
  await cleanupObsoleteConfigs(prisma);
  await normalizeMenuIcons(prisma);

  const menuIdMap = await seedMenu(prisma);
  logger.log(`菜单数据完成，共 ${menuIdMap.size} 个节点`);

  await seedRole(prisma, menuIdMap);
  logger.log(`角色数据完成，共 ${ROLE_SEEDS.length} 个角色`);

  await seedUser(prisma);
  logger.log('用户数据完成，超管账号 admin（口令见 SEED_ADMIN_PASSWORD，未配置时为开发默认口令）');

  await seedDict(prisma);
  await seedConfig(prisma);

  logger.log('种子数据初始化完成');
}

/**
 * 种子服务：在应用启动时执行种子（早于 app.listen 接受请求）。
 * 即早于 app.listen 接受请求）。
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await runSeed(this.prisma);
  }
}
