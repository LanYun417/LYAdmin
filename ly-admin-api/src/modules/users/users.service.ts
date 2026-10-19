/**
 * 用户服务。
 * 模块职责：用户分页查询、CRUD、角色绑定、状态切换、密码重置（唯一操作 User/Role 关联的层）。
 */
import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { DataScopeService } from '../../common/auth/data-scope.service.js';
import { Status, SUPER_ADMIN_ROLE } from '../../common/config/constants.js';
import { lookupDeptName, lookupDeptNames } from '../../common/utils/dept-lookup.js';
import { buildPageResult, hashPassword, parsePagination, readNumber, readString } from '../../common/utils/utils.js';
import { assertPasswordNotContainsAccount } from '../../common/auth/password-policy.js';
import { recordAfter, recordBefore } from '../../common/log/operation-snapshot.js';
import { runBatchDelete, type BatchDeleteResult } from '../../common/utils/batch.js';
import type { AuthUserContext, PageResult, UserDetail } from '../../common/types.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { CreateUserDto, UpdateUserDto } from './dto/users.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 内置超管账号，禁止删除/禁用/重置密码。 */
const BUILTIN_ADMIN = 'admin';

/** 角色简要信息（仅取判定超管与对外展示所需字段）。 */
interface RoleLink {
  id: bigint;
  roleName: string;
  roleCode: string;
}

/** 含部门与角色关联的用户记录（用于 DTO 组装）。 */
interface UserWithRelations {
  id: bigint;
  username: string;
  nickname: string;
  avatar: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  status: number;
  lastLoginAt: Date | null;
  passwordChangedAt: Date | null;
  remark: string | null;
  deptId: bigint;
  createdAt: Date;
  updatedAt: Date;
  dept: { deptName: string } | null;
  roles: RoleLink[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataScope: DataScopeService,
    private readonly authCache: AuthCacheService,
  ) {}

  /** 判断用户是否为超级管理员：内置 `admin` 账号，或持有 `super_admin` 角色。 */
  private isSuperAdmin(username: string, roles: Array<{ roleCode: string }>): boolean {
    if (username === BUILTIN_ADMIN) {
      return true;
    }
    return roles.some((role) => role.roleCode === SUPER_ADMIN_ROLE);
  }

  /** 用户记录 → 详情 DTO（含角色与是否超管标记）。 */
  private toUserDetail(user: UserWithRelations): UserDetail {
    const roles = user.roles ?? [];
    return {
      id: Number(user.id),
      username: user.username,
      nickname: user.nickname,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      status: Number(user.status),
      deptId: Number(user.deptId ?? 0),
      deptName: user.dept?.deptName ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      remark: user.remark,
      isSuperAdmin: this.isSuperAdmin(user.username, roles),
      // 只输出 id + roleName：roleCode 仍参与超管判定，但不对外暴露——
      // 前端 UserDetail 类型也只声明这两个字段）
      roles: roles.map((role) => ({
        id: Number(role.id),
        roleName: role.roleName,
      })),
    };
  }

  /** 按 id 查询用户（含角色；部门名按 deptId 显式补查，sys_user.dept_id 无外键与 Prisma 关系）。 */
  private async findUserWithRoles(id: number): Promise<UserWithRelations | null> {
    // 角色经显式中间表 sys_user_role 读取（userRoles → role）；
    // 不要用隐式多对多 `roles`（Prisma 会另建 _userroles 表，与业务写入的表不通，读出来恒为空）
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      include: {
        userRoles: { include: { role: { select: { id: true, roleName: true, roleCode: true } } } },
      },
    });
    if (!user) {
      return null;
    }
    const deptName = await lookupDeptName(this.prisma, user.deptId);
    return {
      ...user,
      roles: user.userRoles.map((link) => link.role),
      dept: deptName === null ? null : { deptName },
    } as unknown as UserWithRelations;
  }

  /** 同步用户角色（先清后建，去重）。 */
  private async syncUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await this.prisma.userRole.deleteMany({ where: { userId: BigInt(userId) } });
    const unique = Array.from(
      new Set(roleIds.map((roleId) => Number(roleId)).filter((roleId) => Number.isInteger(roleId) && roleId > 0)),
    );
    if (unique.length > 0) {
      await this.prisma.userRole.createMany({
        data: unique.map((roleId) => ({ userId: BigInt(userId), roleId: BigInt(roleId) })),
      });
    }
  }

  /**
   * 分页查询用户（含数据权限过滤 + 用户名/状态/显式部门筛选）。
   * 规则：self 仅看本人；dept 按可见部门集合裁剪（显式部门需落在可见范围内，否则空集）；
   * all 或仅显式部门时不裁剪。
   */
  async listUsers(query: Record<string, unknown>, authUser: AuthUserContext): Promise<PageResult<UserDetail>> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const where: Prisma.UserWhereInput = {};

    const username = readString(query.username);
    if (username) {
      where.username = { contains: username };
    }

    const status = readNumber(query.status);
    if (status !== undefined) {
      where.status = status;
    }

    const explicitDeptId = readNumber(query.deptId);
    const hasExplicitDept = explicitDeptId !== undefined && explicitDeptId > 0;

    const scope = await this.dataScope.getDataScope(authUser);
    if (scope.mode === 'self') {
      where.id = BigInt(scope.userId);
    } else if (scope.mode === 'dept') {
      if (hasExplicitDept) {
        // 请求筛选的部门必须在可见范围内，否则直接返回空集（防止越权探测）
        where.deptId = scope.deptIds.includes(explicitDeptId) ? BigInt(explicitDeptId) : BigInt(-1);
      } else {
        where.deptId = { in: scope.deptIds.map((id) => BigInt(id)) };
      }
    } else if (hasExplicitDept) {
      where.deptId = BigInt(explicitDeptId);
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: {
          userRoles: { include: { role: { select: { id: true, roleName: true, roleCode: true } } } },
        },
        orderBy: { id: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    // 组装：角色来自显式中间表（userRoles → role），部门名批量补查
    // （sys_user.dept_id 无外键与 Prisma 关系，批量查避免逐行 N+1）
    const list = rows.map((row) => ({
      ...row,
      roles: row.userRoles.map((link) => link.role),
    })) as unknown as UserWithRelations[];
    const deptNames = await lookupDeptNames(
      this.prisma,
      list.map((row) => row.deptId),
    );
    const listWithDept = list.map((row) => {
      const deptName = deptNames.get(String(row.deptId));
      return { ...row, dept: deptName === undefined ? null : { deptName } };
    });

    return buildPageResult(
      listWithDept.map((row) => this.toUserDetail(row)),
      total,
      page,
      pageSize,
    );
  }

  /** 查询用户详情（含角色与是否超管）。 */
  async getUserDetail(id: number): Promise<UserDetail> {
    const user = await this.findUserWithRoles(id);
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    return this.toUserDetail(user);
  }

  /** 新增用户：用户名唯一校验 + 口令哈希 + 角色分配。 */
  async createUser(dto: CreateUserDto): Promise<UserDetail> {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) {
      throw AppException.conflict('用户名已存在');
    }
    // 口令不得与账号互相包含（DTO 只能校验长度与复杂度，跨字段规则在这里兜）
    assertPasswordNotContainsAccount(dto.password, dto.username);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: await hashPassword(dto.password),
        nickname: dto.nickname,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        gender: dto.gender ?? null,
        status: dto.status ?? Status.ENABLED,
        deptId: BigInt(dto.deptId ?? 0),
        remark: dto.remark ?? null,
      },
    });

    await this.syncUserRoles(Number(user.id), dto.roleIds ?? []);
    return this.getUserDetail(Number(user.id));
  }

  /** 编辑用户：超级管理员不可被禁用；角色变更后失效鉴权缓存。 */
  async updateUser(id: number, dto: UpdateUserDto): Promise<UserDetail> {
    const user = await this.findUserWithRoles(id);
    if (!user) {
      throw AppException.notFound('用户不存在');
    }

    const status = dto.status ?? Status.ENABLED;
    // 编辑表单也带「状态」字段：同样禁止把超级管理员改成禁用
    if (status === Status.DISABLED && this.isSuperAdmin(user.username, user.roles)) {
      throw AppException.conflict('超级管理员不可禁用');
    }

    // 变更留痕：记录改动前的关键字段（角色变化单独记，便于审计"谁把谁的权限改了"）
    recordBefore({
      nickname: user.nickname,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      status: Number(user.status),
      deptId: Number(user.deptId),
      remark: user.remark,
      roleIds: user.roles.map((role) => role.id),
    });

    await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        nickname: dto.nickname,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        gender: dto.gender ?? null,
        status,
        deptId: BigInt(dto.deptId ?? 0),
        remark: dto.remark ?? null,
      },
    });

    await this.syncUserRoles(id, dto.roleIds ?? []);
    recordAfter({
      nickname: dto.nickname,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      gender: dto.gender ?? null,
      status,
      deptId: dto.deptId ?? 0,
      remark: dto.remark ?? null,
      roleIds: dto.roleIds ?? [],
    });
    // 角色 / 状态可能变更：立即失效该用户鉴权缓存，确保权限即时生效
    this.authCache.invalidate(id);
    return this.getUserDetail(id);
  }

  /** 删除用户：超级管理员不可删除。 */
  async deleteUser(id: number): Promise<void> {
    const user = await this.findUserWithRoles(id);
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    if (this.isSuperAdmin(user.username, user.roles)) {
      throw AppException.conflict('超级管理员不可删除');
    }
    // 先清中间表（userRole 无 DB 级联），再删用户
    await this.prisma.userRole.deleteMany({ where: { userId: BigInt(id) } });
    await this.prisma.user.delete({ where: { id: BigInt(id) } });
    this.authCache.invalidate(id);
  }

  /**
   * 批量删除用户。
   *
   * 逐条复用 `deleteUser`（继承超管保护 / 中间表清理 / 缓存失效），单条失败只记原因不中断；
   * 额外拦「删除当前登录账号」——把自己删掉会立刻失去会话，属误操作而非正常诉求。
   *
   * @param ids 待删除的用户 id
   * @param currentUserId 当前登录用户 id
   */
  async batchDeleteUsers(ids: number[], currentUserId: number): Promise<BatchDeleteResult> {
    // 预取账号名：失败明细要能显示「哪个账号为什么没删掉」，而不是只给一个 id
    const rows = await this.prisma.user.findMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
      select: { id: true, username: true },
    });
    const nameMap = new Map(rows.map((row) => [Number(row.id), row.username]));

    return runBatchDelete(
      ids,
      async (id) => {
        if (id === currentUserId) {
          throw AppException.badRequest('不能删除当前登录账号');
        }
        await this.deleteUser(id);
      },
      (id) => nameMap.get(id) ?? `#${id}`,
    );
  }

  /** 启用/禁用：超级管理员不可禁用。 */
  async updateStatus(id: number, status: number): Promise<void> {
    const user = await this.findUserWithRoles(id);
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    if (status === Status.DISABLED && this.isSuperAdmin(user.username, user.roles)) {
      throw AppException.conflict('超级管理员不可禁用');
    }
    await this.prisma.user.update({ where: { id: BigInt(id) }, data: { status } });
    // 禁用后旧 Token 应立刻被拒（强制下线）
    this.authCache.invalidate(id);
  }

  /** 重置密码：超级管理员不可重置；写入 passwordChangedAt 使旧 Token 失效。 */
  async resetPassword(id: number, password: string): Promise<void> {
    const user = await this.findUserWithRoles(id);
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    if (this.isSuperAdmin(user.username, user.roles)) {
      throw AppException.conflict('超级管理员不可重置密码');
    }
    assertPasswordNotContainsAccount(password, user.username);
    await this.prisma.user.update({
      where: { id: BigInt(id) },
      data: {
        password: await hashPassword(password),
        passwordChangedAt: new Date(),
      },
    });
    // 改密：失效缓存的旧 passwordChangedAt，保持「旧 Token 立即失效」语义
    this.authCache.invalidate(id);
  }

  /** 分配角色（替换式：先清后建）。 */
  async assignRoles(id: number, roleIds: number[]): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
      select: { id: true },
    });
    if (!user) {
      throw AppException.notFound('用户不存在');
    }
    await this.syncUserRoles(id, roleIds);
    // 角色变更：立即失效该用户鉴权缓存，确保新权限即时生效
    this.authCache.invalidate(id);
  }
}
