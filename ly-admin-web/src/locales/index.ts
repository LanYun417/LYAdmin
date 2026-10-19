/**
 * 国际化（i18n）实例与语言包。
 *
 * 范围说明：这是**基础设施**，不是"把全站文案翻一遍"。
 * - 现状：界面文案以中文为主，历史页面里大量硬编码中文；
 * - 约定：**新增/改动文案一律走 `t()`**（`common.*` / `nav.*` 等命名空间），
 *   存量硬编码按页面逐步迁移，不做一次性大改（那会让 diff 失去可读性）；
 * - 语言切换是**运行时行为**：切换后 EP 内置文案、分页、空状态等随语言一起变，
 *   业务文案按语言包缺 key 回退到中文（fallbackLocale: zh-CN）。
 *
 * 为什么用 vue-i18n 而不自己撸一个 `t()`：语言包合并、复数/插值、日期数字本地化、
 * 以及与 Element Plus 的 locale 联动都是成熟约定，自己实现等于长期维护一份半成品。
 * 前端本来就有 11 个运行时依赖（vue / pinia / element-plus / echarts …），
 * 「零运行时依赖」是**后端**的约束，不适用于前端。
 */
import { createI18n } from 'vue-i18n';
import zhCN from './zh-CN';
import enUS from './en-US';

/** 支持的语言（与 `store/modules/app.ts` 的 locale 取值一致）。 */
export const SUPPORT_LOCALES = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
] as const;

export type LocaleValue = (typeof SUPPORT_LOCALES)[number]['value'];

/** 默认语言。 */
export const DEFAULT_LOCALE: LocaleValue = 'zh-CN';

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LOCALE,
  fallbackLocale: DEFAULT_LOCALE,
  // 缺 key 时在控制台告警而不是静默显示 key：漏翻译要能被发现
  missingWarn: import.meta.env.DEV,
  fallbackWarn: false,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
});

export default i18n;
