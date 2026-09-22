/**
 * 种子数据入口。
 * 模块职责：按 menu → role → user 顺序执行种子，供 server 启动或 `npm run seed` 调用。
 */
import { connectDatabase, syncDatabase } from '@/config/database';
import { seedMenu } from './menu.seed';
import { seedRole } from './role.seed';
import { seedUser } from './user.seed';

/**
 * 执行全部种子（幂等）。
 */
export async function runSeed(): Promise<void> {
  const menuIdMap = await seedMenu();
  await seedRole(menuIdMap);
  await seedUser();
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
