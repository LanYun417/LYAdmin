/**
 * 主题色工具：把主题色写入 Element Plus 的 CSS 变量。
 *
 * Element Plus 的组件样式全部基于 `--el-color-primary` 及其 light / dark 变体。
 * 若只覆盖主色，按钮的 hover / disabled / plain 等状态颜色仍会停留在默认蓝，
 * 与主色不匹配造成视觉错乱，因此这里同时生成全部变体。
 *
 * 变体算法与 Element Plus 保持一致：
 * - 亮色模式（`:root`）：light-N = 主色与白色按 N/10 混合；dark-2 = 主色与黑色按 2/10 混合。
 * - 暗黑模式（`html.dark`）：light-N = 主色与暗色基准 #141414 按 N/10 混合；
 *   dark-2 = 主色与白色按 2/10 混合。
 *
 * 通过注入 `<style>` 覆盖变量（而非写在 `documentElement.style` 上），
 * 才能同时区分亮色 / 暗黑两套变体。
 */

/** 默认主题色（Element Plus 默认蓝） */
export const DEFAULT_PRIMARY_COLOR = '#409eff';

/** 注入样式的元素 id，用于重复调用时复用同一节点 */
const STYLE_ELEMENT_ID = 'app-primary-color';

/** 需要生成的浅色变体档位 */
const LIGHT_LEVELS = [3, 5, 7, 8, 9] as const;

/** 深色变体档位 */
const DARK_LEVEL = 2;

/** RGB 三元组 */
interface Rgb {
  r: number;
  g: number;
  b: number;
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const BLACK: Rgb = { r: 0, g: 0, b: 0 };
/** Element Plus 暗黑模式的混合基准背景色（#141414） */
const DARK_MIX_BASE: Rgb = { r: 20, g: 20, b: 20 };

/**
 * 解析十六进制颜色字符串，兼容 `#rgb` 与 `#rrggbb`。
 *
 * @param color 颜色字符串
 * @returns RGB 三元组；非法输入返回 `null`
 */
function parseHexColor(color: unknown): Rgb | null {
  if (typeof color !== 'string') {
    return null;
  }
  let hex = color.trim().replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

/**
 * 按比例混合两种颜色。
 *
 * @param source 基色
 * @param target 目标色
 * @param weight 目标色占比（0~1，会被裁剪到合法区间）
 * @returns 混合后的 RGB
 */
function mix(source: Rgb, target: Rgb, weight: number): Rgb {
  const ratio = Math.min(Math.max(weight, 0), 1);
  return {
    r: Math.round(source.r * (1 - ratio) + target.r * ratio),
    g: Math.round(source.g * (1 - ratio) + target.g * ratio),
    b: Math.round(source.b * (1 - ratio) + target.b * ratio),
  };
}

/** RGB 转十六进制字符串（小写） */
function toHex({ r, g, b }: Rgb): string {
  const channel = (value: number): string => value.toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * 生成一组主题色 CSS 变量声明。
 *
 * @param base 主色
 * @param lightTarget 浅色变体的混合目标色
 * @param darkTarget 深色变体的混合目标色
 * @returns CSS 声明串，如 `--el-color-primary:#e24b4a;...`
 */
function buildVars(base: Rgb, lightTarget: Rgb, darkTarget: Rgb): string {
  const declarations: string[] = [`--el-color-primary:${toHex(base)};`];
  for (const level of LIGHT_LEVELS) {
    declarations.push(`--el-color-primary-light-${level}:${toHex(mix(base, lightTarget, level / 10))};`);
  }
  declarations.push(`--el-color-primary-dark-${DARK_LEVEL}:${toHex(mix(base, darkTarget, DARK_LEVEL / 10))};`);
  return declarations.join('');
}

/**
 * 将主题色应用到全局（亮色 + 暗黑两套 CSS 变量）。
 *
 * 传入非法颜色时静默回退到默认主题色，绝不抛异常，避免白屏。
 *
 * @param color 十六进制颜色字符串，如 `#409eff`
 */
export function applyPrimaryColor(color: string): void {
  const base = parseHexColor(color) ?? parseHexColor(DEFAULT_PRIMARY_COLOR);
  if (!base) {
    return;
  }
  const lightVars = buildVars(base, WHITE, BLACK);
  const darkVars = buildVars(base, DARK_MIX_BASE, WHITE);
  const css = `:root{${lightVars}}html.dark{${darkVars}}`;

  let styleElement = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleElement);
  }
  styleElement.textContent = css;
}
