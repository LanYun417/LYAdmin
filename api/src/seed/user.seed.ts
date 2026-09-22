/**
 * 用户种子数据。
 * 模块职责：写入超级管理员 `admin` / `123456` 并绑定 `super_admin` 角色，幂等执行。
 */
import { Status, SUPER_ADMIN_ROLE } from '@/constants';
import { Role, User, UserRole } from '@/models';
import { hashPassword } from '@/utils/password';

/**
 * 执行用户种子。
 */
export async function seedUser(): Promise<void> {
  const superRole = await Role.findOne({ where: { roleCode: SUPER_ADMIN_ROLE } });

  const [admin] = await User.findOrCreate({
    where: { username: 'admin' },
    defaults: {
      username: 'admin',
      password: await hashPassword('123456'),
      nickname: '超级管理员',
      status: Status.ENABLED,
      remark: '内置超级管理员账号',
    },
  });

  if (superRole) {
    await UserRole.findOrCreate({
      where: { userId: Number(admin.id), roleId: Number(superRole.id) },
      defaults: { userId: Number(admin.id), roleId: Number(superRole.id) },
    });
  }

  console.log('[Seed] 用户数据完成，超管账号 admin / 123456');
}
