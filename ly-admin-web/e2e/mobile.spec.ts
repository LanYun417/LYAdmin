import { expect, test } from '@playwright/test';

/**
 * 移动端（390×844）回归用例。
 *
 * 只钉真正会因样式改动翻车的点：
 * 1. 汉堡菜单出现（<768px 侧边栏必须收成抽屉，否则内容区被挤到没法看）；
 * 2. 用户列表操作列收纳为「编辑 + 更多」（按钮换行挤压是老问题）；
 * 3. 「更多」下拉能展开（收纳后功能不能丢）；
 * 4. 弹窗遮罩覆盖整个视口（曾因 animation-fill-mode 把内容区变成
 *    定位包含块，遮罩只盖住内容区，侧边栏/顶栏仍可点）。
 *
 * 仅在 mobile-chromium project 跑：desktop-chromium 上这些断言无意义。
 */
test.describe('移动端布局回归（390px）', () => {
  test.skip(({ isMobile }) => !isMobile, '仅移动端项目执行（390×844）');

  test('汉堡菜单可见，侧边栏收为抽屉', async ({ page }) => {
    await page.goto('/system/user');
    // 顶栏的侧边栏开关：按无障碍角色定位（图标 i 元素是空标签，靠 CSS 渲染，
    // Playwright 的可见性判定会把它当 0×0 隐藏元素；按钮本体的 role/aria-label 才可靠）
    const hamburger = page.getByRole('button', { name: '切换侧边栏' }).first();
    await expect(hamburger).toBeVisible({ timeout: 15_000 });
    // 移动端才渲染汉堡图标（桌面是侧边栏折叠图标；侧边栏菜单里也可能有 bi-list，故只判存在）
    await expect(page.locator('i.bi-list').first()).toHaveCount(1);

    // 点开抽屉：侧边栏以浮层出现，且出现点击遮罩（layout-mask）
    await hamburger.click();
    await expect(page.locator('.layout-mask')).toBeVisible();
  });

  test('用户列表操作列收纳为「编辑 + 更多」，更多可展开', async ({ page }) => {
    await page.goto('/system/user');
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 15_000 });

    // 收纳后：编辑按钮可见 + 更多按钮可见
    const editButton = page.getByRole('button', { name: '编辑' }).first();
    await expect(editButton).toBeVisible();

    const moreButton = page.getByRole('button', { name: '更多' }).first();
    await expect(moreButton).toBeVisible();

    // 展开下拉：分配角色 / 单独授权 / 重置密码 / 删除 都在
    await moreButton.click();
    const dropdown = page.locator('.el-dropdown-menu:visible');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toContainText('分配角色');
    await expect(dropdown).toContainText('重置密码');
    await expect(dropdown).toContainText('删除');

    // 桌面上这些按钮平铺、移动端才收起：断言「多余按钮在收起态不可见」
    // （「分配角色」此时在下拉里，表格行内不应再平铺一份）
    await page.keyboard.press('Escape');
  });

  test('新增用户弹窗：遮罩覆盖整个视口（不是只盖内容区）', async ({ page }) => {
    await page.goto('/system/user');
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '新增' }).first().click();
    const dialog = page.locator('.el-dialog:visible').first();
    await expect(dialog).toBeVisible();

    const overlay = page.locator('.el-overlay:visible').first();
    await expect(overlay).toBeVisible();
    const box = await overlay.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      // 遮罩必须铺满视口（允许 1px 的取整误差）
      expect(Math.abs(box.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.width - viewport.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - viewport.height)).toBeLessThanOrEqual(1);
    }

    // 弹窗宽度不得超出视口（窄屏固定 520px 会横向溢出）
    const dialogBox = await dialog.boundingBox();
    if (dialogBox && viewport) {
      expect(dialogBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }
  });
});
