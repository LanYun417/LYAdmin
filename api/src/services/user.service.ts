/**
 * 用户服务。
 * 模块职责：用户分页查询、CRUD、角色绑定、状态切换、密码重置（唯一操作 User/Role 关联的层）。
 */
import { Op, type WhereOptions } from 'sequelize';
import { Status } from '@/constants';
import { Dept, Role, User, UserRole } from '@/models';
import { getDataScope } from '@/services/dataScope.service';
import { invalidateAuthCache } from '@/services/authCache';
import { toUserBrief } from '@/services/auth.service';
import type { AuthUserContext, PageResult, UserDetail } from '@/types';
import { buildPageResult, parsePagination } from '@/utils/pagination';
import { hashPassword } from '@/utils/password';
import { AppError } from '@/utils/response';
import type { CreateUserInput, UpdateUserInput } from '@/validators/user.validator';

/** 内置超管账号，禁止删除/禁用。 */
const BUILTIN_ADMIN = 'admin';

/** 将 User 实例转换为详情 DTO。 */
function toUserDetail(user: User): UserDetail {
  const roles = user.roles ?? [];
  const dept = user.dept as Dept | undefined;
  return {
    ...toUserBrief(user),
    deptId: Number(user.deptId ?? 0),
    deptName: dept?.deptName ?? null,
    remark: user.remark,
    roleIds: roles.map((role) => Number(role.id)),
    roleNames: roles.map((role) => role.roleName),
  };
}

/** 按 id 查询用户（含角色与部门）。 */
async function findUserWithRoles(id: number): Promise<User | null> {
  return User.findByPk(id, {
    include: [
      { model: Role, through: { attributes: [] } },
      { model: Dept, attributes: ['id', 'deptName'], required: false },
    ],
  });
}

/** 同步用户角色（先清后建）。 */
async function syncUserRoles(userId: number, roleIds: number[]): Promise<void> {
  await UserRole.destroy({ where: { userId } });
  const unique = Array.from(new Set(roleIds));
  if (unique.length > 0) {
    await UserRole.bulkCreate(
      unique.map((roleId) => ({ userId, roleId })),
      { ignoreDuplicates: true },
    );
  }
}

/**
 * 分页查询用户。
 * 数据权限：依据当前用户角色的数据范围裁剪可见行——
 * 「仅本人」只能看到自己；「自定义部门 / 本部门及以下」只能看到所属部门集合内的用户；超管或「全部」不裁剪。
 * @param query 查询参数（page/pageSize/username/status/deptId）
 * @param authUser 鉴权上下文（用于数据权限计算；缺省时仅用于内部调用，不做裁剪）
 * @returns 分页结果
 */
export async function listUsers(
  query: Record<string, unknown>,
  authUser?: AuthUserContext,
): Promise<PageResult<UserDetail>> {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where: WhereOptions = {};

  const username = typeof query.username === 'string' ? query.username.trim() : '';
  if (username) {
    where.username = { [Op.like]: `%${username}%` };
  }
  if (query.status !== undefined && query.status !== '') {
    where.status = Number(query.status);
  }

  // 数据权限裁剪 + 显式部门筛选求交集
  const explicitDeptId =
    query.deptId !== undefined && query.deptId !== '' && Number(query.deptId) > 0 ? Number(query.deptId) : null;

  if (authUser) {
    const scope = await getDataScope(authUser);
    if (scope.mode === 'self') {
      where.id = scope.userId;
    } else if (scope.mode === 'dept') {
      if (explicitDeptId !== null) {
        // 请求筛选的部门必须在可见范围内，否则直接返回空集（防止越权探测）
        where.deptId = scope.deptIds.includes(explicitDeptId) ? explicitDeptId : -1;
      } else {
        where.deptId = { [Op.in]: scope.deptIds };
      }
    } else if (explicitDeptId !== null) {
      where.deptId = explicitDeptId;
    }
  } else if (explicitDeptId !== null) {
    where.deptId = explicitDeptId;
  }

  const { rows, count } = await User.findAndCountAll({
    where,
    include: [
      { model: Role, through: { attributes: [] } },
      { model: Dept, attributes: ['id', 'deptName'], required: false },
    ],
    order: [['id', 'DESC']],
    offset,
    limit,
    distinct: true,
  });

  return buildPageResult(rows.map(toUserDetail), count, page, pageSize);
}

/**
 * 查询用户详情。
 * @param id 用户 id
 */
export async function getUserDetail(id: number): Promise<UserDetail> {
  const user = await findUserWithRoles(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  return toUserDetail(user);
}

/**
 * 新增用户。
 * @param input 新增参数
 */
export async function createUser(input: CreateUserInput): Promise<UserDetail> {
  const exists = await User.findOne({ where: { username: input.username } });
  if (exists) {
    throw AppError.conflict('用户名已存在');
  }

  const user = await User.create({
    username: input.username,
    password: await hashPassword(input.password),
    nickname: input.nickname,
    email: input.email || null,
    phone: input.phone || null,
    gender: input.gender || null,
    status: input.status,
    deptId: input.deptId,
    remark: input.remark || null,
  });

  await syncUserRoles(Number(user.id), input.roleIds);
  return getUserDetail(Number(user.id));
}

/**
 * 编辑用户。
 * @param id 用户 id
 * @param input 编辑参数
 */
export async function updateUser(id: number, input: UpdateUserInput): Promise<UserDetail> {
  const user = await User.findByPk(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }

  await user.update({
    nickname: input.nickname,
    email: input.email || null,
    phone: input.phone || null,
    gender: input.gender || null,
    status: input.status,
    deptId: input.deptId,
    remark: input.remark || null,
  });

  await syncUserRoles(id, input.roleIds);
  // 角色 / 状态可能变更：立即失效该用户鉴权缓存，确保权限即时生效
  invalidateAuthCache(id);
  return getUserDetail(id);
}

/**
 * 删除用户。
 * @param id 用户 id
 */
export async function deleteUser(id: number): Promise<void> {
  const user = await User.findByPk(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  if (user.username === BUILTIN_ADMIN) {
    throw AppError.conflict('内置管理员账号不可删除');
  }
  await UserRole.destroy({ where: { userId: id } });
  await user.destroy();
  // 用户已删除：立即失效其鉴权缓存（防旧 Token 仍在 TTL 内通过）
  invalidateAuthCache(id);
}

/**
 * 启用/禁用用户。
 * @param id 用户 id
 * @param status 目标状态（1 启用 / 0 禁用）
 */
export async function updateStatus(id: number, status: number): Promise<void> {
  const user = await User.findByPk(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  if (user.username === BUILTIN_ADMIN && status === Status.DISABLED) {
    throw AppError.conflict('内置管理员账号不可禁用');
  }
  await user.update({ status });
  // 启用 / 禁用：立即失效鉴权缓存，禁用后旧 Token 应立刻被拒（强制下线）
  invalidateAuthCache(id);
}

/**
 * 重置用户密码（写入 passwordChangedAt 使旧 Token 失效）。
 * @param id 用户 id
 * @param password 新密码明文
 */
export async function resetPassword(id: number, password: string): Promise<void> {
  const user = await User.findByPk(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  await user.update({
    password: await hashPassword(password),
    passwordChangedAt: new Date(),
  });
  // 改密：失效缓存的旧 passwordChangedAt，保持「旧 Token 立即失效」语义
  invalidateAuthCache(id);
}

/**
 * 分配角色。
 * @param id 用户 id
 * @param roleIds 角色 id 列表
 */
export async function assignRoles(id: number, roleIds: number[]): Promise<void> {
  const user = await User.findByPk(id);
  if (!user) {
    throw AppError.notFound('用户不存在');
  }
  await syncUserRoles(id, roleIds);
  // 角色变更：立即失效该用户鉴权缓存，确保新权限即时生效
  invalidateAuthCache(id);
}
