import { createApp } from 'vue';
import { BootstrapIconsPlugin } from 'bootstrap-icons-vue';
import App from './App.vue';
import router from './router';
import pinia from './store';
import { setupDirectives } from './directives';

// 样式引入顺序（架构文档 1.4 风险 A）：
// 1) Element Plus 基础样式 → 2) Element Plus 暗黑变量 → 3) NProgress → 4) Tailwind 入口样式
import 'element-plus/dist/index.css';
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import '@/styles/index.css';
import '@/styles/element.scss';

const app = createApp(App);

// 全局注册 Bootstrap Icons（注册名形如 BIconPerson），支持后端下发 icon 名称的动态渲染
app.use(BootstrapIconsPlugin);

app.use(pinia);
app.use(router);
setupDirectives(app);

app.mount('#app');
