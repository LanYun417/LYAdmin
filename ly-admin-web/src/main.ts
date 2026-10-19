import App from './App.vue';
import router from './router';
import pinia from './store';
import { useAppStore } from './store/modules/app';
import { setupDirectives } from './directives';
import { setRequestRouter } from '@/api/request';
import i18n from '@/locales';

// 样式引入顺序（架构文档 1.4 风险 A）：
// 1) Element Plus 暗黑变量（组件基础样式由 unplugin 的 ElementPlusResolver 按组件按需注入，不在此全量引入，
//    避免整份 index.css 约 52 kB gzip 被拖进首屏）
// 2) NProgress → 3) Tailwind 入口样式 → 4) Element Plus 覆盖样式（element.scss）
import 'element-plus/theme-chalk/dark/css-vars.css';
import 'nprogress/nprogress.css';
// Bootstrap Icons 图标字体（全量 2078 个）：以 CSS 类名使用（`<i class="bi bi-house" />`），
// 无需逐个注册组件，菜单里任选图标都立即可用；字体文件由 Vite 构建时抽取为独立静态资源。
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@/styles/index.css';
import '@/styles/element.scss';

/** 淡出时长（ms），与 index.html 中 `#app-loading` 的 transition 保持一致 */
const APP_LOADING_FADE_MS = 300;

/**
 * 隐藏并移除首屏加载动画（节点定义见 index.html 的 `#app-loading`）。
 *
 * 只在「刷新页面」的初始化流程中被调用一次；节点随后被移除，因此后续页面间路由切换
 * 不会再出现该动画（那类切换由 axios 请求驱动的 NProgress 承担，见 api/request.ts）。
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

app.use(pinia);
// 界面语言：先按持久化偏好设置，再挂载 i18n（否则首屏会用默认语言闪一下）
i18n.global.locale.value = useAppStore().locale;
app.use(i18n);
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
