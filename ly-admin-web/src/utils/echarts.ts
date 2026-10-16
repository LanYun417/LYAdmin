/**
 * ECharts 按需引入（共享注册入口）。
 * 模块职责：集中注册后台实际用到的图表类型与组件，供各图表组件复用同一份 echarts 实例，
 * 避免「全量引入 echarts」（约 1.1 MB 原始 / 371 kB gzip）拖大产物。
 *
 * 已注册能力（与 `views/home/components/` 下三个图表实际用到的功能一一对应）：
 * - 图表类型：BarChart（柱状）/ LineChart（折线）/ PieChart（饼图）；
 * - 组件：GridComponent（直角坐标系网格）/ TooltipComponent（提示框）/ LegendComponent（图例）
 *   / GraphicComponent（原生图形元素——饼图中心的空态文案用到，缺失时控制台报
 *   `[ECharts] Component graphic is used but not imported`，且该文案不渲染）；
 * - 渲染器：CanvasRenderer。
 *
 * 若新增图表类型或组件（如 TitleComponent、DataSetComponent 等），请在此补充注册。
 */
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import { GraphicComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export default echarts;
