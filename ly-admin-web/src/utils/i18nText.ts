/**
 * 界面文案的中英文选择。
 *
 * 用途：菜单名称等「后端下发的动态数据」没有走静态语言包（`locales/*`），
 * 无法用 `t()` 翻译；改为在库里存一份中文、一份英文，前端按当前语言挑选。
 * - 中文（zh-CN 或未设置）→ 用中文；
 * - 其他语言（如 en-US）→ 优先英文；
 * - 英文缺失（未填 / null）→ 回退中文，保证任何语言下都有可读文案。
 *
 * 该函数在模板 / computed 中调用：读取 `appStore.locale` 会自动建立响应依赖，
 * 切换语言后相关文案即时刷新，无需额外刷新页面或重建路由。
 */
import { useAppStore } from '@/store/modules/app';

export function pickLocaleText(zh: string, en?: string | null): string {
  const appStore = useAppStore();
  if (appStore.locale !== 'zh-CN' && en) {
    return en;
  }
  return zh;
}
