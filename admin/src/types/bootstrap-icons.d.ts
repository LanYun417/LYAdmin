/**
 * Bootstrap Icons 全局组件类型声明。
 *
 * `BootstrapIconsPlugin` 在运行时以 `BIconXxx` 为名全局注册全部图标组件，
 * 但 vue-tsc 无法感知运行时注册，模板里直接写 `<BIconPerson />` 或
 * `<component :is="item.icon" />` 会报 “Property does not exist”。
 * 这里从包的类型导出中提取所有 `BIcon*` 组件，补齐 `GlobalComponents` 声明。
 */
import type * as BootstrapIcons from 'bootstrap-icons-vue';

/** 仅保留 `BIcon` 前缀的图标组件（排除 `iconNames`、`BootstrapIconsPlugin` 等非组件导出）。 */
type BootstrapIconComponents = {
  [K in keyof typeof BootstrapIcons as K extends `BIcon${string}` ? K : never]: (typeof BootstrapIcons)[K];
};

declare module 'vue' {
  export interface GlobalComponents extends BootstrapIconComponents {}
}
