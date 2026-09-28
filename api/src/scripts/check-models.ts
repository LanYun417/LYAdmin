/**
 * 模型关联装配冒烟检查（不连接数据库）。
 * 模块职责：构造 Sequelize 实例会触发 `addModels → associateModels`，任何
 * 「外键缺失 / 关联声明错误」都会在此处抛出 —— 把这类错误从「服务启动崩溃」
 * 提前到一条可单独执行的检查命令（`npm run check:models`）。
 *
 * 背景：TypeScript 编译期无法发现 sequelize-typescript 关联装配问题
 * （如 `@HasMany` 未显式指定 foreignKey 且对侧模型缺少 `@ForeignKey` 装饰器），
 * 此类错误只会在服务启动时以 `Foreign key for "X" is missing on "Y"` 崩溃。
 * 每次新增/调整模型关联后，先跑一遍本检查即可确认装配无损。
 */
import { sequelize } from '@/config/database';

const modelNames = Object.keys(sequelize.models).sort();
console.log(`[CheckModels] 模型关联装配成功，共 ${modelNames.length} 个模型：${modelNames.join(', ')}`);
