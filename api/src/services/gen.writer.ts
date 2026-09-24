/**
 * 代码生成落盘服务。
 * 模块职责：把生成的源码文件按固定映射写入真实项目目录（api/src 与 admin/src），
 * 并自动完成「模型注册」「路由挂载」「菜单节点」「接口文档」「操作日志」五处接线；
 * 同名文件默认拒绝覆盖（409）。
 *
 * 接线实现（重要）：
 * - 模型/路由：沿用行模式锚点（import/export/models 数组、router.use）。
 * - 菜单/接口文档/操作日志：这三个文件结构复杂（嵌套树 / 常量数组），靠语法匹配易错，
 *   故在各文件末尾放置显式锚点注释 `// [GEN-ANCHOR] …`，生成器只在该锚点**之前**插入新内容；
 *   锚点缺失时**跳过该文件并不做半截修改**（交由人工处理，并在 manualSteps 中提示）。
 *
 * 安全约束：
 * - 目标路径一律由服务端依据 moduleName/businessName 派生，不接受客户端传入路径；
 * - moduleName/businessName 已在 gen.service 通过 NAME_PATTERN 校验（字母开头仅字母数字），
 *   此处再做 resolve 后前缀校验，双重防御路径穿越与任意写。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';
import { AppError } from '@/utils/response';
import { getGenTableDetail, previewGenCode, type GenConfig, type GenFile } from './gen.service';

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
 * 锚点注释标识。各接线目标文件末尾放置一行含此标识的注释，
 * 生成器只在该行**之前**插入新内容；修改时务必保持与源码注释一致。
 */
const GEN_ANCHOR = '[GEN-ANCHOR]';

/** 自动插入结果。 */
type InjectionResult = 'injected' | 'exists' | 'no-anchor';

/** 项目根目录缓存（进程内只需解析一次）。 */
let cachedProjectRoot: string | null = null;

/**
 * 解析项目根目录（同时包含 api/src 与 admin/src 的目录）。
 * @returns 项目根绝对路径
 */
function resolveProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }
  let dir = process.cwd();
  for (let depth = 0; depth < 5; depth += 1) {
    if (existsSync(join(dir, 'api', 'src')) && existsSync(join(dir, 'admin', 'src'))) {
      cachedProjectRoot = dir;
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new AppError('无法定位项目根目录（需同时存在 api/src 与 admin/src）', 500, 500);
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
  if (normalized.startsWith('backend/')) {
    targetDir = join(root, 'api', 'src');
    rest = normalized.slice('backend/'.length);
  } else if (normalized.startsWith('frontend/')) {
    targetDir = join(root, 'admin', 'src');
    rest = normalized.slice('frontend/'.length);
  } else {
    // README 等说明文件不落盘
    return null;
  }
  const absolute = resolve(join(targetDir, rest));
  // 双重防御：目标必须位于 api/src 或 admin/src 之内
  if (!absolute.startsWith(targetDir + sep)) {
    throw new AppError(`生成目标路径非法：${relPath}`, 400, 400);
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
 * 自动接线：把新模型注册进 api/src/models/index.ts（import / export / models 数组）。
 * @param cls 模型类名（PascalCase）
 * @returns 是否完成注入
 */
function injectModel(cls: string): boolean {
  const file = join(resolveProjectRoot(), 'api', 'src', 'models', 'index.ts');
  if (!existsSync(file)) {
    return false;
  }
  const content = readFileSync(file, 'utf8');
  // 幂等：已注册则跳过
  if (content.includes(`from './${cls}'`)) {
    return false;
  }
  const lines = content.split('\n');
  const okImport = insertAfterLastMatch(
    lines,
    /^import \{[^}]*\} from '\.\/.+';$/,
    `import { ${cls} } from './${cls}';`,
  );
  const okExport = insertAfterLastMatch(
    lines,
    /^export \{[^}]*\} from '\.\/.+';$/,
    `export { ${cls} } from './${cls}';`,
  );
  const arrayPattern = /export const models = \[([\s\S]*?)\];/;
  const okArray = arrayPattern.test(content);
  if (!okImport || !okExport || !okArray) {
    // 锚点缺失时不做半截修改，交由人工接线
    return false;
  }
  const next = lines.join('\n').replace(arrayPattern, `export const models = [$1, ${cls}];`);
  writeFileSync(file, next, 'utf8');
  return true;
}

/**
 * 自动接线：把新路由挂载进 api/src/routes/index.ts（import + router.use）。
 * @param name 业务名（camelCase，与生成文件名一致）
 * @returns 是否完成注入
 */
function injectRoutes(name: string): boolean {
  const file = join(resolveProjectRoot(), 'api', 'src', 'routes', 'index.ts');
  if (!existsSync(file)) {
    return false;
  }
  const content = readFileSync(file, 'utf8');
  // 幂等：已挂载则跳过
  if (content.includes(`./${name}.routes`) || content.includes(`router.use('/${name}'`)) {
    return false;
  }
  const lines = content.split('\n');
  const okImport = insertAfterLastMatch(
    lines,
    /^import \w+ from '\.\/.+';$/,
    `import ${name}Routes from './${name}.routes';`,
  );
  const okMount = insertAfterLastMatch(lines, /^router\.use\(.+\);$/, `router.use('/${name}', ${name}Routes);`);
  if (!okImport || !okMount) {
    return false;
  }
  writeFileSync(file, lines.join('\n'), 'utf8');
  return true;
}

/**
 * 在目标文件的显式锚点注释「之前」插入一段源码。
 *
 * 约定：
 * - 幂等：目标内容已包含 `idempotencyToken` 时视为已接入，返回 `exists`，不重复插入；
 * - 锚点缺失：返回 `no-anchor`，**不做任何修改**（沿用「不半截改」约定，交由人工处理）。
 *
 * @param relPath 目标文件相对项目根的路径（如 `api/src/seed/menu.seed.ts`）
 * @param block 待插入源码（多行；缩进/引号需符合 prettier）
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
  const index = lines.findIndex((line) => line.includes(GEN_ANCHOR));
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
  const file = join(resolveProjectRoot(), 'api', 'src', 'seed', 'menu.seed.ts');
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
 * 构建菜单种子节点源码（DIRECTORY → MENU → 4 个 BUTTON），风格对齐 tool/gen 模块。
 * @param moduleName 模块名
 * @param businessName 业务名
 * @param cnName 中文模块名（取表注释，缺失时回退 moduleName）
 * @param sort 目录节点排序值
 * @returns 可直接插入 menu.seed.ts 的源码块
 */
function buildMenuSeedBlock(moduleName: string, businessName: string, cnName: string, sort: number): string {
  const base = `${moduleName}:${businessName}`;
  const lines: string[] = [
    '  {',
    `    key: '${moduleName}',`,
    `    menuName: '${cnName}',`,
    '    menuType: MenuType.DIRECTORY,',
    `    path: '/${moduleName}',`,
    "    icon: 'BIconGear',",
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

/**
 * 渲染 responseExample 多行数组源码（内容较长、prettier 会保持分行）。
 * @param jsonLines JSON 行内容（每行作为单引号字符串字面量）
 * @returns 源码行数组
 */
function renderResponseExampleMultiLine(jsonLines: string[]): string[] {
  return ['        responseExample: [', ...jsonLines.map((line) => `          '${line}',`), "        ].join('\\n'),"];
}

/**
 * 渲染 responseExample 单行数组源码（内容短，prettier 保持单行）。
 * @param jsonLines JSON 行内容（每行作为单引号字符串字面量）
 * @returns 单行源码
 */
function renderResponseExampleInline(jsonLines: string[]): string {
  const items = jsonLines.map((line) => `'${line}'`).join(', ');
  return `        responseExample: [${items}].join('\\n'),`;
}

/**
 * 构建接口文档模块源码（5 个 endpoint，路由与实际生成路由一一对应）。
 * @param moduleName 模块名
 * @param businessName 业务名
 * @param cnName 中文模块名（取表注释，缺失时回退 moduleName）
 * @returns 可直接插入 catalog.ts 的源码块
 */
function buildCatalogBlock(moduleName: string, businessName: string, cnName: string): string {
  const permBase = `${moduleName}:${businessName}`;
  const basePath = `/api/${businessName}`;
  const listExample = [
    '{',
    '  "code": 200,',
    '  "message": "success",',
    '  "data": { "list": [], "total": 0, "page": 1, "pageSize": 10 }',
    '}',
  ];
  const detailExample = [
    '{',
    '  "code": 200,',
    '  "message": "success",',
    '  "data": { "id": 1, "name": "demo" }',
    '}',
  ];
  const createExample = [
    '{',
    '  "code": 200,',
    '  "message": "新增成功",',
    '  "data": { "id": 1, "name": "demo" }',
    '}',
  ];
  const updateExample = [
    '{',
    '  "code": 200,',
    '  "message": "修改成功",',
    '  "data": { "id": 1, "name": "demo" }',
    '}',
  ];
  const removeExample = ['{', '  "code": 200,', '  "message": "删除成功",', '  "data": null', '}'];

  return [
    '  {',
    `    key: '${moduleName}',`,
    `    name: '${cnName}',`,
    `    basePath: '${basePath}',`,
    `    description: '${cnName}相关接口（由代码生成器自动生成）。',`,
    '    endpoints: [',
    '      {',
    "        method: 'GET',",
    `        path: '${basePath}',`,
    `        summary: '分页查询${cnName}',`,
    `        description: '分页查询${cnName}列表（由代码生成器自动生成）。',`,
    '        auth: true,',
    `        permission: '${permBase}:list',`,
    "        contentType: 'application/json',",
    ...renderResponseExampleMultiLine(listExample),
    '      },',
    '      {',
    "        method: 'GET',",
    `        path: '${basePath}/:id',`,
    `        summary: '${cnName}详情',`,
    `        description: '查询单条${cnName}详情（由代码生成器自动生成）。',`,
    '        auth: true,',
    `        permission: '${permBase}:query',`,
    "        contentType: 'application/json',",
    ...renderResponseExampleMultiLine(detailExample),
    '      },',
    '      {',
    "        method: 'POST',",
    `        path: '${basePath}',`,
    `        summary: '新增${cnName}',`,
    `        description: '新增一条${cnName}记录（由代码生成器自动生成）。',`,
    '        auth: true,',
    `        permission: '${permBase}:add',`,
    "        contentType: 'application/json',",
    ...renderResponseExampleMultiLine(createExample),
    '      },',
    '      {',
    "        method: 'PUT',",
    `        path: '${basePath}/:id',`,
    `        summary: '编辑${cnName}',`,
    `        description: '按主键编辑${cnName}记录（由代码生成器自动生成）。',`,
    '        auth: true,',
    `        permission: '${permBase}:edit',`,
    "        contentType: 'application/json',",
    ...renderResponseExampleMultiLine(updateExample),
    '      },',
    '      {',
    "        method: 'DELETE',",
    `        path: '${basePath}/:id',`,
    `        summary: '删除${cnName}',`,
    `        description: '按主键删除${cnName}记录（由代码生成器自动生成）。',`,
    '        auth: true,',
    `        permission: '${permBase}:remove',`,
    "        contentType: 'application/json',",
    renderResponseExampleInline(removeExample),
    '      },',
    '    ],',
    '  },',
  ].join('\n');
}

/**
 * 构建操作日志规则源码（2 条：`/:id` 写操作 + 集合 POST 新增）。
 * 注意：正则中的业务名是**运行期字面量**（插入到静态配置数组的合法源码），非字符串拼接。
 * @param businessName 业务名（即实际挂载的路由段 `/api/<businessName>`）
 * @param cnName 中文模块名（取表注释，缺失时回退 moduleName）
 * @returns 可直接插入 operationLog.ts 的源码块
 */
function buildOperationLogBlock(businessName: string, cnName: string): string {
  return [
    `  // ${cnName}：以下两条规则覆盖该模块的写操作；action 为空时按请求方法推断（DELETE→删除 / POST→新增 / 其他→编辑）`,
    `  { pattern: /^\\/api\\/${businessName}\\/\\d+$/, module: '${cnName}', action: '' },`,
    `  { pattern: /^\\/api\\/${businessName}$/, module: '${cnName}', action: '新增' },`,
  ].join('\n');
}

/**
 * 生成代码并直接写入项目目录（含自动接线）。
 * @param config 生成配置
 * @param overwrite 是否覆盖已存在文件
 * @returns 写入与接线结果
 */
export async function createGenCode(config: GenConfig, overwrite: boolean): Promise<GenCreateResult> {
  const { files } = await previewGenCode(config);

  // 冲突检测：同名文件默认拒绝覆盖
  const mapped = files
    .map((file: GenFile) => ({ file, target: mapGenPath(file.path) }))
    .filter((item) => item.target !== null) as Array<{ file: GenFile; target: { absolute: string; display: string } }>;
  const conflicts = mapped.filter((item) => existsSync(item.target.absolute)).map((item) => item.target.display);
  if (conflicts.length > 0 && !overwrite) {
    throw AppError.conflict(`以下文件已存在：${conflicts.join('、')}；确认覆盖请再次生成`);
  }

  // 落盘
  const written: string[] = [];
  for (const item of mapped) {
    mkdirSync(item.target.absolute.slice(0, item.target.absolute.lastIndexOf(sep)), { recursive: true });
    writeFileSync(item.target.absolute, item.file.content, 'utf8');
    written.push(item.target.display);
  }

  // 自动接线（模型注册 + 路由挂载）
  const injected: string[] = [];
  const businessName = config.businessName;
  const cls = businessName.charAt(0).toUpperCase() + businessName.slice(1);
  if (injectModel(cls)) {
    injected.push('api/src/models/index.ts');
  }
  if (injectRoutes(businessName)) {
    injected.push('api/src/routes/index.ts');
  }

  // 中文模块名：优先取表注释，缺失时回退模块名（菜单与操作日志均需要中文名）
  const detail = await getGenTableDetail(config.tableName);
  const cnName = (detail.tableComment || '').trim() || config.moduleName;

  // 三处接线（菜单 / 接口文档 / 操作日志），均基于显式锚点，锚点缺失则跳过并提示人工处理
  const wiring: Array<{ path: string; result: InjectionResult }> = [
    {
      path: 'api/src/seed/menu.seed.ts',
      result: injectBeforeAnchor(
        'api/src/seed/menu.seed.ts',
        buildMenuSeedBlock(config.moduleName, businessName, cnName, readMaxTopLevelMenuSort() + 1),
        `key: '${config.moduleName}:${businessName}',`,
      ),
    },
    {
      path: 'api/src/docs/catalog.ts',
      result: injectBeforeAnchor(
        'api/src/docs/catalog.ts',
        buildCatalogBlock(config.moduleName, businessName, cnName),
        `basePath: '/api/${businessName}',`,
      ),
    },
    {
      path: 'api/src/middlewares/operationLog.ts',
      result: injectBeforeAnchor(
        'api/src/middlewares/operationLog.ts',
        buildOperationLogBlock(businessName, cnName),
        `pattern: /^\\/api\\/${businessName}\\/`,
      ),
    },
  ];
  wiring.forEach((item) => {
    if (item.result === 'injected') {
      injected.push(item.path);
    }
  });

  const manualSteps = [
    '后端已自动完成「模型注册 / 路由挂载 / 菜单节点 / 接口文档 / 操作日志」接线，重启后端（npm run dev）后生效；',
    '如需授予其它角色，请在「系统管理-角色管理-菜单授权」中勾选。',
  ];
  // 锚点缺失导致未能自动接线的文件，逐条提示人工处理（沿用「不半截改」约定）
  wiring.forEach((item) => {
    if (item.result === 'no-anchor') {
      manualSteps.push(`未找到 [GEN-ANCHOR] 锚点，未能自动接线 ${item.path}，请人工补充。`);
    }
  });

  return { written, injected, manualSteps };
}

/** 导出给测试/诊断使用：确认路径解析结果合法（非项目内目录时抛错）。 */
export function assertProjectRoot(): string {
  const root = resolveProjectRoot();
  if (isAbsolute(root) === false) {
    throw new AppError('项目根目录解析异常', 500, 500);
  }
  return root;
}
