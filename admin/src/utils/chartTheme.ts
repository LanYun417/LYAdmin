/**
 * 图表主题工具。
 * 模块职责：为 ECharts 图表提供统一的亮/暗主题配色、色板与渐变工厂。
 * 背景：canvas 无法读取 CSS 变量，必须按主题（暗黑 / 亮色）在 JS 侧取色，
 * 使图表与 Element Plus 暗黑模式、主题色自动适配。
 */
import echarts from '@/utils/echarts';

/** 图表配色结构 */
export interface ChartPalette {
  text: string;
  textSecondary: string;
  axisLine: string;
  splitLine: string;
  tooltipBg: string;
  tooltipText: string;
  tooltipBorder: string;
  cardBg: string;
}

/** 亮色主题配色 */
const LIGHT: ChartPalette = {
  text: '#303133',
  textSecondary: '#909399',
  axisLine: '#E4E7ED',
  splitLine: '#EBEEF5',
  tooltipBg: 'rgba(255, 255, 255, 0.96)',
  tooltipText: '#303133',
  tooltipBorder: '#E4E7ED',
  cardBg: '#ffffff',
};

/** 暗色主题配色 */
const DARK: ChartPalette = {
  text: '#E5EAF3',
  textSecondary: '#A3A6AD',
  axisLine: 'rgba(255, 255, 255, 0.14)',
  splitLine: 'rgba(255, 255, 255, 0.08)',
  tooltipBg: 'rgba(30, 30, 32, 0.94)',
  tooltipText: '#E5EAF3',
  tooltipBorder: 'rgba(255, 255, 255, 0.14)',
  cardBg: '#1d1e1f',
};

/** 饼图/多系列配色板（亮暗通用，对比度充足） */
export const CHART_COLORS = [
  '#5B8FF9',
  '#61DDAA',
  '#65789B',
  '#F6BD16',
  '#7262FD',
  '#78D3F8',
  '#9661BC',
  '#F6903D',
  '#008685',
  '#F08BB4',
] as const;

/**
 * 依据暗黑模式返回图表配色。
 * @param isDark 是否暗黑模式
 */
export function getChartPalette(isDark: boolean): ChartPalette {
  return isDark ? DARK : LIGHT;
}

/**
 * hex 色转 rgba（支持 3 位简写）。
 * @param hex 十六进制颜色，如 `#409eff`
 * @param alpha 透明度 0~1
 */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * 垂直线性渐变（用于折线面积 / 柱体），自上而下由深到浅。
 * @param from 起点颜色
 * @param to 终点颜色
 */
export function verticalGradient(from: string, to: string) {
  return new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: from },
    { offset: 1, color: to },
  ]);
}
