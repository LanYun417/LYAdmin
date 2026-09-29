/**
 * Element Plus 命令式 API（ElMessage / ElMessageBox）按需引入入口。
 *
 * 背景：业务层曾直接 `import { ElMessage } from '@/utils/element';`，从包根引入会触发
 * 整库打包（约 284 kB 原始 / 90 kB gzip 被拖进首屏）。这里改从子路径引入并显式加载样式，
 * 与「组件按需加载」保持一致，显著减小首屏 JS。
 *
 * 组件（<el-button> 等）仍由 unplugin 的 ElementPlusResolver 按需处理，无需在此引入。
 * 若后续用到 ElNotification / ElLoading，按相同模式补导出与样式即可。
 */
export { default as ElMessage } from 'element-plus/es/components/message/index';
export { default as ElMessageBox } from 'element-plus/es/components/message-box/index';

import 'element-plus/es/components/message/style/css';
import 'element-plus/es/components/message-box/style/css';
