import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import pinia from './store';
import { setupDirectives } from './directives';
import { appIcons } from '@/utils/icons';
import { setRequestRouter } from '@/api/request';

// 样式引入顺序（架构文档 1.4 风险 A）：
// 1) Element Plus 基础样式 → 2) Element Plus 暗黑变量 → 3) NProgress → 4) Tailwind 入口样式
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import '@/styles/index.css';
import '@/styles/element.scss';

const app = createApp(App);

// 注入 router 实例到请求层：使 request 拦截器能以「路由内跳转」（非整页刷新）处理
// 401/403，同时避免 request.ts 直接 import router 造成循环依赖（依赖链 router → guard → store → api/request）。
setRequestRouter(router);

// 按需注册 Bootstrap Icons（仅注册实际使用的图标，注册名形如 BIconPerson）。
// 不用 `BootstrapIconsPlugin`（会注册全量 2052 个图标，引入约 222 kB gzip 的无用 chunk）；
// 逐个 `app.component` 注册后，`<component :is="item.icon" />` 的动态渲染能力保持不变。
Object.entries(appIcons).forEach(([name, icon]) => {
  app.component(name, icon);
});

app.use(pinia);
app.use(router);
setupDirectives(app);

app.mount('#app');
