/**
 * Pinia 实例创建：挂载持久化插件后供 main.ts 注册。
 */
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

/** Pinia 实例（挂载持久化插件） */
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

export default pinia;
