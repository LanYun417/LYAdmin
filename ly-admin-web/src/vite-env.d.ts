/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** 站点标题 */
  readonly VITE_APP_TITLE: string;
  /** axios baseURL（走 Vite 代理） */
  readonly VITE_API_BASE_URL: string;
  /** 静态资源前缀 */
  readonly VITE_UPLOAD_BASE_URL: string;
  /** dev server 端口 */
  readonly VITE_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
