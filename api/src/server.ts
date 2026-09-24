/**
 * 服务入口。
 * 模块职责：加载装饰器元数据 → 连接数据库 → 同步建表 → 写入种子数据 → 启动 HTTP 服务。
 */
import 'reflect-metadata';
import { createApp } from '@/app';
import { config } from '@/config';
import { connectDatabase, syncDatabase } from '@/config/database';
import { registerProcessHandlers, startLogScheduler } from '@/logging';
import { runSeed } from '@/seed';

/**
 * 启动流程。
 */
async function bootstrap(): Promise<void> {
  // 进程级异常与退出信号（异常写入 error 日志；退出时关流 + 停调度）
  registerProcessHandlers();
  // 日志归档调度：启动补跑 + 每日定时归档
  startLogScheduler();

  await connectDatabase();
  await syncDatabase();
  await runSeed();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] LYAdmin API 已启动: http://localhost:${config.port}/api`);
    console.log(`[Server] 静态资源目录: http://localhost:${config.port}/uploads`);
  });
}

bootstrap().catch((error) => {
  console.error('[Server] 启动失败:', error);
  process.exit(1);
});
