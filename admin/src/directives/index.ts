import type { App } from 'vue';
import permission from './permission';

/**
 * 统一注册全局指令。
 *
 * @param app Vue 应用实例
 */
export function setupDirectives(app: App): void {
  app.directive('permission', permission);
}

export { permission };
