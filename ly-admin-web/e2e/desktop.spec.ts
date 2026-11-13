import { expect, test } from '@playwright/test';

/**
 * 桌面端冒烟（1440×900）：登录态可用、核心页能加载、操作列平铺。
 * 这些是「改坏了立刻知道」的底线，不做穷举。
 */
test.describe('桌面端冒烟', () => {
  test.skip(({ isMobile }) => Boolean(isMobile), '仅桌面项目执行（1440×900）');

  test('登录态有效：直达首页不出登录页', async ({ page }) => {
    await page.goto('/home');
    await expect(page).toHaveURL(/\/home/);
    // 有内容渲染（ECharts 容器存在）
    await expect(page.locator('.el-card').first()).toBeVisible({ timeout: 15_000 });
  });

  test('用户列表：操作列平铺（编辑等按钮直接在行内，不收起）', async ({ page }) => {
    await page.goto('/system/user');
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 15_000 });

    // 桌面宽度下「编辑」可见，且「更多」不应出现（收纳是移动端专属）
    await expect(page.getByRole('button', { name: '编辑' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '更多' })).toHaveCount(0);
  });

  test('导航可达：日志管理 → 下载中心（新增页面已挂菜单）', async ({ page }) => {
    await page.goto('/log/download-center');
    // 页面标题（下载中心）与表格骨架存在
    await expect(page.getByText('下载中心').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.el-table')).toBeVisible();
  });
});
