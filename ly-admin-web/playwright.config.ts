import { defineConfig, devices } from '@playwright/test';

/**
 * Web E2E 配置（Playwright）。
 *
 * 覆盖重点：**移动端（390px）回归**——操作列收纳、弹窗遮罩覆盖视口、汉堡菜单。
 * 这几处是 CSS/布局层的历史翻车点（桌面改样式时最容易只在桌面验证）。
 *
 * 前置（两个服务都要在跑）：
 * - 后端 3100：`CAPTCHA_ENABLED=false npm run start:dev`（E2E 不处理图形验证码；
 *   该变量通过 webServer.env 注入，dotenv 不会覆盖已存在的环境变量）；
 * - 前端 5173：`npm run dev`（reuseExistingServer：本地已起则直接复用）。
 *
 * 运行：`npm run test:e2e:web`（首次需 `npx playwright install chromium`）。
 */
export default defineConfig({
  testDir: './e2e',
  /** 登录态准备（一次登录，全量用例复用 storageState） */
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    storageState: 'e2e/.auth/state.json',
    // 本地可用系统浏览器免下 Chromium（内网/下载慢时的逃生口）：
    // E2E_BROWSER_CHANNEL=msedge npm run test:e2e:web
    // CI 不设该变量 → 走 `npx playwright install chromium` 的产物。
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  },

  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      // 390×844（iPhone 13 视口）：命中 <768px 断点，触发移动端布局。
      // 显式 browserName: 'chromium'——devices['iPhone 13'] 默认 defaultBrowserType
      // 是 webkit，直接用会尝试起 WebKit（本地 channel=msedge 时直接报不支持）。
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent: devices['iPhone 13'].userAgent,
      },
    },
  ],

  webServer: [
    {
      // 后端：CAPTCHA_ENABLED=false 让登录只需账号口令（dotenv 不覆盖已存在的 env）
      command: 'npm --prefix ../ly-admin-api run start:dev',
      url: 'http://localhost:3100/api/health/ready',
      reuseExistingServer: true,
      timeout: 180_000,
      env: { CAPTCHA_ENABLED: 'false' },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
