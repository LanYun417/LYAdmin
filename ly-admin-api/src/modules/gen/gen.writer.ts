/**
 * 代码生成落盘服务。
 * 模块职责：把生成的源码文件按固定映射写入真实项目目录（ly-admin-api/src 与 ly-admin-web/src），
 * 并自动完成「Nest 模块注册」「Prisma 模型」「菜单节点」三处接线；同名文件默认拒绝覆盖（409）。
 *
 * 接线实现（重要）：
 * - Nest 模块：向 `ly-admin-api/src/app.module.ts` 插入 import 行并把类加进 `imports: [...]`。
 * - Prisma 模型 / 菜单节点：这两个文件结构复杂（DSL / 嵌套树），靠语法匹配易错，故在各文件
 *   放置显式锚点注释 `// [GEN-ANCHOR] …`，生成器只在该锚点**之前**插入新内容；
 *   锚点缺失时**跳过该文件并不做半截修改**（交由人工处理，并在 manualSteps 中提示）。
 *
 * 安全约束：
 * - 目标路径一律由服务端依据 moduleName/businessName 派生，不接受客户端传入路径；
 * - moduleName/businessName 已在 gen.service 通过 NAME_PATTERN 校验（字母开头仅字母数字），
 *   此处再做 resolve 后前缀校验，双重防御路径穿越与任意写。
 */
import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';
import { AppException } from '../../common/app.exception.js';
import { toCamel, toPascal, unknownTypeNames } from './gen.templates.js';
import { GenService } from './gen.service.js';
import type { GenConfig, GenFile } from './gen.service.js';

/** 生成落盘结果。 */
export interface GenCreateResult {
  /** 成功写入的文件（相对项目根） */
  written: string[];
  /** 已自动接线的文件（相对项目根） */
  injected: string[];
  /** 生成后仍需人工完成的步骤 */
  manualSteps: string[];
}

/**
 * 锚点注释标识。各接线目标文件末尾（或数据区末尾）放置一行含此标识的注释，
 * 生成器只在该行**之前**插入新内容；修改时务必保持与源码注释一致。
 */
const GEN_ANCHOR = '[GEN-ANCHOR]';

/**
 * 代码生成器写入 Prisma 模型的**目标文件**（相对项目根）。
 *
 * schema 是目录式的（划分见 `ly-admin-api/prisma/schema/00-base.prisma` 的「文件划分」一节），
 * 生成物统一落在 `90-generated.prisma`：这样自动插入的 diff 不会混进业务模型文件，
 * 接手方 review「自己改的模型」时也不会被生成块干扰。
 */
const PRISMA_GENERATED_SCHEMA = 'ly-admin-api/prisma/schema/90-generated.prisma';

/** 自动插入结果。 */
type InjectionResult = 'injected' | 'exists' | 'no-anchor';

/** 项目根目录缓存（进程内只需解析一次）。 */
let cachedProjectRoot: string | null = null;

/**
 * 解析项目根目录（同时包含 ly-admin-web/src 与 ly-admin-api/src 的目录）。
 * @returns 项目根绝对路径
 */
function resolveProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(dir, 'ly-admin-web', 'src')) && existsSync(join(dir, 'ly-admin-api', 'src'))) {
      cachedProjectRoot = dir;
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new AppException('无法定位项目根目录（需同时存在 ly-admin-web/src 与 ly-admin-api/src）', 500, 500);
}

/**
 * 把生成文件的相对路径映射为项目内绝对路径。
 * @param relPath 生成文件相对路径（backend/... / frontend/... / README.md）
 * @returns 绝对路径；不参与落盘的文件（如 README.md）返回 null
 */
function mapGenPath(relPath: string): { absolute: string; display: string } | null {
  const root = resolveProjectRoot();
  const normalized = relPath.replace(/\\/g, '/');
  let targetDir: string;
  let rest: string;
  if (normalized.startsWith('backend/prisma/')) {
    // Prisma model 片段：**仅供预览 / ZIP 下载**，不单独落盘 ——
    // 实际内容由 injectBeforeAnchor 追加进 prisma/schema/90-generated.prisma（避免同一份定义两处存放）
    return null;
  }
  if (normalized.startsWith('backend/seed/')) {
    // 字典种子片段：落到 prisma/ 目录、紧挨 seed.ts（该目录不参与 tsc 编译，需人工合并进 DICT_SEEDS）
    targetDir = join(root, 'ly-admin-api', 'prisma');
    rest = normalized.slice('backend/seed/'.length);
  } else if (normalized.startsWith('backend/')) {
    // 新后端 NestJS + Prisma 源码目录
    targetDir = join(root, 'ly-admin-api', 'src');
    rest = normalized.slice('backend/'.length);
  } else if (normalized.startsWith('frontend/')) {
    // 前端 Vue3 源码目录（原 admin/ 已更名为 ly-admin-web/）
    targetDir = join(root, 'ly-admin-web', 'src');
    rest = normalized.slice('frontend/'.length);
  } else {
    // README 等说明文件不落盘
    return null;
  }
  const absolute = resolve(join(targetDir, rest));
  // 双重防御：目标必须位于 ly-admin-api/src 或 ly-admin-web/src 之内
  if (!absolute.startsWith(targetDir + sep)) {
    throw new AppException(`生成目标路径非法：${relPath}`, 400, 400);
  }
  return { absolute, display: relativeToRoot(absolute) };
}

/** 绝对路径 → 相对项目根的显示路径（统一 / 分隔）。 */
function relativeToRoot(absolute: string): string {
  const root = resolveProjectRoot();
  return absolute.slice(root.length + 1).replace(/\\/g, '/');
}

/**
 * 在指定文件的「行模式锚点」之后插入一行（找到最后一个匹配行）。
 * @param lines 文本行数组（原地修改）
 * @param pattern 行匹配正则
 * @param insertLine 待插入行
 * @returns 是否插入成功
 */
function insertAfterLastMatch(lines: string[], pattern: RegExp, insertLine: string): boolean {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    if (pattern.test(lines[i])) {
      lines.splice(i + 1, 0, insertLine);
      return true;
    }
  }
  return false;
}

/**
 * 自动接线：把新模块注册进 `ly-admin-api/src/app.module.ts`（import 行 + imports 数组）。
 * @param className 模块类名（PascalCase + Module，如 `ArticleModule`）
 * @param importPath 相对 app.module.ts 的导入路径（含 `.js`，如 `./modules/article/article.module.js`）
 * @returns 插入结果
 */
function injectNestModule(className: string, importPath: string): InjectionResult {
  const file = join(resolveProjectRoot(), 'ly-admin-api', 'src', 'app.module.ts');
  if (!existsSync(file)) {
    return 'no-anchor';
  }
  const content = readFileSync(file, 'utf8');
  // 幂等：已注册则跳过
  if (content.includes(importPath)) {
    return 'exists';
  }
  if (!/imports:\s*\[/.test(content)) {
    return 'no-anchor';
  }
  const lines = content.split('\n');
  // import 行插在最后一个 import 之后
  const okImport = insertAfterLastMatch(
    lines,
    /^import .+ from '.+';$/,
    `import { ${className} } from '${importPath}';`,
  );
  // 类名插在 imports 数组最后一个 *Module 项之后
  const okArray = insertAfterLastMatch(lines, /^ {4}[A-Za-z]\w*Module,$/, `    ${className},`);
  if (!okImport || !okArray) {
    // 锚点缺失时不做半截修改，交由人工接线
    return 'no-anchor';
  }
  writeFileSync(file, lines.join('\n'), 'utf8');
  return 'injected';
}

/**
 * 在目标文件的显式锚点注释「之前」插入一段源码。
 *
 * 约定：
 * - 幂等：目标内容已包含 `idempotencyToken` 时视为已接入，返回 `exists`，不重复插入；
 * - 锚点缺失：返回 `no-anchor`，**不做任何修改**（沿用「不半截改」约定，交由人工处理）。
 *
 * @param relPath 目标文件相对项目根的路径（如 `ly-admin-api/prisma/schema/90-generated.prisma`）
 * @param block 待插入源码（多行；缩进/引号需符合 prettier / Prisma 格式）
 * @param idempotencyToken 幂等令牌（目标文件已含有该子串即视为已插入）
 * @returns 插入结果
 */
function injectBeforeAnchor(relPath: string, block: string, idempotencyToken: string): InjectionResult {
  const file = join(resolveProjectRoot(), ...relPath.split('/'));
  if (!existsSync(file)) {
    return 'no-anchor';
  }
  const content = readFileSync(file, 'utf8');
  if (content.includes(idempotencyToken)) {
    return 'exists';
  }
  const lines = content.split('\n');
  // 只认「以 // [GEN-ANCHOR] 开头的行」：说明性注释里也可能提到该标记（曾因此把模型插到了说明文字之上）
  const index = lines.findIndex((line) => line.trim().startsWith(`// ${GEN_ANCHOR}`));
  if (index < 0) {
    return 'no-anchor';
  }
  lines.splice(index, 0, ...block.split('\n'));
  writeFileSync(file, lines.join('\n'), 'utf8');
  return 'injected';
}

/**
 * 读取菜单种子顶层节点的最大 sort（用于新目录排序 = 当前最大 + 1）。
 * 顶层节点 `sort` 恰好为 4 空格缩进，嵌套子级为 8/12 空格，故用精确缩进匹配避免误取。
 * @returns 顶层最大 sort；读取失败时返回 0
 */
function readMaxTopLevelMenuSort(): number {
  const file = join(resolveProjectRoot(), 'ly-admin-api', 'src', 'prisma', 'seed.service.ts');
  if (!existsSync(file)) {
    return 0;
  }
  const content = readFileSync(file, 'utf8');
  const pattern = /^ {4}sort: (\d+),\r?$/gm;
  let max = 0;
  let match = pattern.exec(content);
  while (match) {
    max = Math.max(max, Number(match[1]));
    match = pattern.exec(content);
  }
  return max;
}

/** 生成的按钮权限定义（权限后缀 + 中文菜单名 + 顺序）。 */
const GEN_BUTTON_DEFS: Array<{ code: string; label: string }> = [
  { code: 'query', label: '查询' },
  { code: 'add', label: '新增' },
  { code: 'edit', label: '编辑' },
  { code: 'remove', label: '删除' },
];

/**
 * 构建菜单种子节点源码（DIRECTORY → MENU → 4 个 BUTTON），风格对齐 seed.service.ts 的 MENU_TREE。
 * @param moduleName 模块名
 * @param businessName 业务名
 * @param cnName 中文模块名（取表注释，缺失时回退 moduleName）
 * @param sort 目录节点排序值
 * @returns 可直接插入 seed.service.ts 的源码块
 */
function buildMenuSeedBlock(moduleName: string, businessName: string, cnName: string, sort: number): string {
  const base = `${moduleName}:${businessName}`;
  const lines: string[] = [
    '  {',
    `    key: '${moduleName}',`,
    `    menuName: '${cnName}',`,
    '    menuType: MenuType.DIRECTORY,',
    `    path: '/${moduleName}',`,
    "    icon: 'gear',",
    `    sort: ${sort},`,
    '    visible: Status.ENABLED,',
    `    redirect: '/${moduleName}/${businessName}',`,
    '    children: [',
    '      {',
    `        key: '${base}',`,
    `        menuName: '${cnName}',`,
    '        menuType: MenuType.MENU,',
    `        path: '/${moduleName}/${businessName}',`,
    `        component: '${moduleName}/${businessName}/index',`,
    `        permission: '${base}:list',`,
    '        sort: 1,',
    '        visible: Status.ENABLED,',
    '        keepAlive: 1,',
    '        children: [',
  ];
  GEN_BUTTON_DEFS.forEach((button, index) => {
    lines.push(
      '          {',
      `            key: '${base}:${button.code}',`,
      `            menuName: '${button.label}',`,
      '            menuType: MenuType.BUTTON,',
      `            permission: '${base}:${button.code}',`,
      `            sort: ${index + 1},`,
      '          },',
    );
  });
  lines.push('        ],', '      },', '    ],', '  },');
  return lines.join('\n');
}

@Injectable()
export class GenWriter {
  constructor(private readonly genService: GenService) {}

  /**
   * 生成代码并直接写入项目目录（含自动接线）。
   * @param config 生成配置
   * @param overwrite 是否覆盖已存在文件
   * @returns 写入与接线结果
   */
  async createGenCode(config: GenConfig, overwrite: boolean): Promise<GenCreateResult> {
    const { files } = await this.genService.previewGenCode(config);

    // 冲突检测：同名文件默认拒绝覆盖
    const mapped = files
      .map((file: GenFile) => ({ file, target: mapGenPath(file.path) }))
      .filter((item) => item.target !== null) as Array<{
      file: GenFile;
      target: { absolute: string; display: string };
    }>;
    const conflicts = mapped.filter((item) => existsSync(item.target.absolute)).map((item) => item.target.display);
    if (conflicts.length > 0 && !overwrite) {
      throw AppException.conflict(`以下文件已存在：${conflicts.join('、')}；确认覆盖请再次生成`);
    }

    // 落盘
    const written: string[] = [];
    for (const item of mapped) {
      mkdirSync(item.target.absolute.slice(0, item.target.absolute.lastIndexOf(sep)), { recursive: true });
      writeFileSync(item.target.absolute, item.file.content, 'utf8');
      written.push(item.target.display);
    }

    const businessName = config.businessName;
    const name = toCamel(businessName);
    const cls = toPascal(businessName);
    const modelName = toPascal(config.tableName);
    // Prisma 模型片段直接取预览产物，保证「落盘文件」与「自动插入内容」完全一致
    const modelFile = files.find((file) => file.path === `backend/prisma/${config.tableName}.model.prisma`);

    // 中文模块名：优先取表注释，缺失时回退模块名（菜单与操作日志均需要中文名）
    const detail = await this.genService.getGenTableDetail(config.tableName);
    const cnName = (detail.tableComment || '').trim() || config.moduleName;

    // 三处接线：Nest 模块 / Prisma 模型 / 菜单节点
    const wiring: Array<{ path: string; result: InjectionResult }> = [
      {
        path: 'ly-admin-api/src/app.module.ts',
        result: injectNestModule(`${cls}Module`, `./modules/${name}/${name}.module.js`),
      },
      {
        path: PRISMA_GENERATED_SCHEMA,
        result: modelFile
          ? injectBeforeAnchor(PRISMA_GENERATED_SCHEMA, modelFile.content, `model ${modelName} {`)
          : 'no-anchor',
      },
      {
        path: 'ly-admin-api/src/prisma/seed.service.ts',
        result: injectBeforeAnchor(
          'ly-admin-api/src/prisma/seed.service.ts',
          buildMenuSeedBlock(config.moduleName, businessName, cnName, readMaxTopLevelMenuSort() + 1),
          `key: '${config.moduleName}:${businessName}',`,
        ),
      },
    ];

    const injected: string[] = [];
    wiring.forEach((item) => {
      if (item.result === 'injected') {
        injected.push(item.path);
      }
    });

    const manualSteps = [
      '后端已自动完成「Nest 模块注册 / Prisma 模型 / 菜单节点」接线；执行 npm run prisma:push 同步表结构后重启服务（启动即自动幂等种子）即生效；',
      '如需授予其它角色，请在「系统管理-角色管理-菜单授权」中勾选。',
    ];
    // 锚点缺失导致未能自动接线的文件，逐条提示人工处理（沿用「不半截改」约定）
    wiring.forEach((item) => {
      if (item.result === 'no-anchor') {
        manualSteps.push(`未找到 [GEN-ANCHOR] 锚点，未能自动接线 ${item.path}，请人工补充。`);
      }
    });
    // 未知列类型：生成物已兜底为 String，提示人工确认
    const unknownTypes = unknownTypeNames(detail.columns);
    if (unknownTypes.length > 0) {
      manualSteps.push(
        `以下列的 MySQL 类型无法可靠映射为 Prisma 类型，已兜底为 String @db.VarChar(255)，请人工确认：${unknownTypes.join('、')}；`,
      );
    }

    return { written, injected, manualSteps };
  }

  /** 导出给测试/诊断使用：确认路径解析结果合法（非项目内目录时抛错）。 */
  assertProjectRoot(): string {
    const root = resolveProjectRoot();
    if (isAbsolute(root) === false) {
      throw new AppException('项目根目录解析异常', 500, 500);
    }
    return root;
  }
}
