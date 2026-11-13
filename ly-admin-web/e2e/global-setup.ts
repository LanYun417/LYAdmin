import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';

/**
 * 全局登录态准备：调后端登录接口拿双 Token，写入 localStorage 后落 storageState。
 *
 * 为什么不用 UI 登录：登录页首屏依赖 Vite 按需编译 + 登录后守卫要拉菜单，
 * 在 CI 的冷启动里偶发 30s 超时（本地也间歇复现），把 E2E 变成拼机器性能的测试。
 * 登录页的 UI 路径由「桌面端冒烟」里的登录页用例单独覆盖，这里只负责
 * 高效、稳定地拿到登录态。
 *
 * 前置：后端以 CAPTCHA_ENABLED=false 启动（见 playwright.config 的 webServer.env）。
 * 账号口令：E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD，默认 admin / 123456（种子默认值）。
 */

/** localStorage 键名（与 src/utils/auth.ts 对齐）。 */
const ACCESS_TOKEN_KEY = 'ly_admin_access_token';
const REFRESH_TOKEN_KEY = 'ly_admin_refresh_token';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';
  const username = process.env.E2E_ADMIN_USERNAME ?? 'admin';
  const password = process.env.E2E_ADMIN_PASSWORD ?? '123456';
  // 不从 project.use.channel 读：`--project=mobile-chromium` 过滤后配置形态会变
  const channel = process.env.E2E_BROWSER_CHANNEL;

  const browser = await chromium.launch(channel ? { channel } : {});
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // 先打开同源页面（localhost:5173）：page.request 与 localStorage 都需要在前端源下
  await page.goto('/login');

  // 验证码开启时后端会拒绝无 captcha 的登录：提前给出可执行提示
  const captcha = await page.request.get('/api/auth/captcha');
  const captchaBody = (await captcha.json()) as { data?: { enabled?: boolean } };
  if (captchaBody.data?.enabled) {
    throw new Error('E2E 需要关闭验证码：请以 CAPTCHA_ENABLED=false 启动后端（playwright.config 的 webServer 已注入）');
  }

  const login = await page.request.post('/api/auth/login', { data: { username, password } });
  if (!login.ok()) {
    throw new Error(`E2E 登录失败：HTTP ${login.status()} ${await login.text()}`);
  }
  const payload = (await login.json()) as { data?: { accessToken?: string; refreshToken?: string } };
  const accessToken = payload.data?.accessToken;
  const refreshToken = payload.data?.refreshToken;
  if (!accessToken || !refreshToken) {
    throw new Error('E2E 登录响应缺少令牌字段');
  }

  await page.evaluate(
    ([access, refresh, accessKey, refreshKey]) => {
      // 键名由 Node 侧传入（page.evaluate 的回调在浏览器里执行，无法直接捕获外部常量）
      localStorage.setItem(accessKey as string, access as string);
      localStorage.setItem(refreshKey as string, refresh as string);
    },
    [accessToken, refreshToken, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY],
  );

  // 落到首页确认登录态真的生效（而不是只写了两个键）
  await page.goto('/home');
  await page.waitForURL('**/home**', { timeout: 30_000 });

  const statePath = path.resolve('e2e/.auth/state.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await context.storageState({ path: statePath });
  await browser.close();
}
