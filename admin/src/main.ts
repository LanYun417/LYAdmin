import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import pinia from './store';
import { setupDirectives } from './directives';
import { appIcons } from '@/utils/icons';
import { setRequestRouter } from '@/api/request';

// 样式引入顺序（架构文档 1.4 风险 A）：
// 1) Element Plus 暗黑变量（组件基础样式由 unplugin 的 ElementPlusResolver 按组件按需注入，不在此全量引入，
//    避免整份 index.css 约 52 kB gzip 被拖进首屏）
// 2) NProgress → 3) Tailwind 入口样式
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
import '@/styles/index.css';
import '@/styles/element.scss';

/** 淡出时长（ms），与 index.html 中 `#app-loading` 的 transition 保持一致 */
const APP_LOADING_FADE_MS = 300;

/**
 * 隐藏并移除首屏加载动画（节点定义见 index.html 的 `#app-loading`）。
 *
 * 只在「刷新页面」的初始化流程中被调用一次；节点随后被移除，因此后续页面间路由切换
 * 不会再出现该动画（那类切换由路由守卫中的 NProgress 承担）。
 */
function hideAppLoading(): void {
  const el = document.getElementById('app-loading');
  if (!el) {
    return;
  }
  // is-hidden：立即放开点击（pointer-events: none）并触发淡出
  el.classList.add('is-hidden');
  // 淡出结束后移除节点，避免残留遮挡页面
  window.setTimeout(() => el.remove(), APP_LOADING_FADE_MS);
}

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
// app.use(router) 会在此处触发「首次导航」——首屏加载动画正是覆盖这一段等待
app.use(router);
setupDirectives(app);

// 初始路由就绪后再挂载应用，让首屏加载动画与「初始路由加载状态」精确绑定：
// - 显示时机：动画随 index.html 同步渲染（早于 JS 执行），覆盖首次导航的整个等待过程；
// - 隐藏时机：`router.isReady()` 在首次导航完成后 resolve，在 finally 中挂载应用并淡出动画；
// - 页面间切换不显示：`isReady()` 只在首次导航完成时 resolve 一次，且此时动画节点已被移除。
router
  .isReady()
  .catch((err) => {
    // 初始导航失败也照常挂载，避免一直卡在 loading 页
    console.error('[bootstrap] 初始路由导航失败：', err);
  })
  .finally(() => {
    app.mount('#app');
    hideAppLoading();
  });
