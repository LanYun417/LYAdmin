/**
 * Bootstrap Icons 全局组件类型声明（按需注册版）。
 *
 * `main.ts` 不再使用会注册全量图标的 `BootstrapIconsPlugin`，而是遍历 `utils/icons.ts`
 * 导出的 `appIcons` 逐个 `app.component(name, icon)` 注册。vue-tsc 无法感知运行时注册，
 * 故此处基于 `appIcons` 的键（即已注册的图标名）补齐 `GlobalComponents` 声明，
 * 保证模板中 `<BIconPerson />` 与 `<component :is="item.icon" />` 的类型安全。
 *
 * 若在 `utils/icons.ts` 新增图标，此处无需改动（类型自动跟随）。
 */
import type { appIcons } from '@/utils/icons';

/** 已注册图标组件的映射类型（键 = 图标名）。 */
type AppIconComponents = typeof appIcons;

declare module 'vue' {
  export interface GlobalComponents extends AppIconComponents {}
}
