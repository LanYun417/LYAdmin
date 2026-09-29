/**
 * 服务入口。
 * 模块职责：加载装饰器元数据 → 连接数据库 → 同步建表 → 写入种子数据 → 启动 HTTP 服务。
 */
import 'reflect-metadata';
import fs from 'fs';
import { createApp } from '@/app';
import { config } from '@/config';
import { connectDatabase, syncDatabase } from '@/config/database';
import { auditCoverage, auditDocsCoverage } from '@/docs';
import { registerProcessHandlers, startLogScheduler, startRetentionScheduler } from '@/logging';
import { runSeed } from '@/seed';

/**
 * 启动流程。
 */
async function bootstrap(): Promise<void> {
  // 进程级异常与退出信号（异常写入 error 日志；退出时关流 + 停调度）
  registerProcessHandlers();
  // 日志归档调度：启动补跑 + 每日定时归档
  startLogScheduler();
  // 日志保留清理调度：启动补跑 + 每日定时分批清理过期日志（默认 00:10，避开 00:05 归档）
  startRetentionScheduler();

  await connectDatabase();
  await syncDatabase();
  await runSeed();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[Server] LYAdmin API 已启动: http://localhost:${config.port}/api`);
    console.log(`[Server] 静态资源目录: http://localhost:${config.port}/uploads`);
    // 同源部署：前端产物存在时由后端托管（含 history 回退），否则仅提供 API
    const webEnabled = fs.existsSync(config.web.distDir);
    console.log(
      webEnabled
        ? `[Server] 前端页面: http://localhost:${config.port}/（已托管 ${config.web.distDir}）`
        : `[Server] 前端页面: 未托管（未找到 ${config.web.distDir}，请先执行 admin 构建）`,
    );
    console.log(`[Docs] 接口文档: http://localhost:${config.port}/api-docs`);
  });

  // 接口文档覆盖校验：比对运行时注册路由与文档目录，仅打印提示，不影响启动
  auditDocsCoverage(app);
  // 留痕覆盖率守卫：列出「有写操作、无留痕」的写接口，仅打印提示，不影响启动
  auditCoverage(app);
}

bootstrap().catch((error) => {
  console.error('[Server] 启动失败:', error);
  process.exit(1);
});
