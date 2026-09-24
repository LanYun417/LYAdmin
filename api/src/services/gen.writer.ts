/**
 * 代码生成落盘服务。
 * 模块职责：把生成的源码文件按固定映射写入真实项目目录（api/src 与 admin/src），
 * 并自动完成「模型注册」「路由挂载」两处接线；同名文件默认拒绝覆盖（409）。
 *
 * 安全约束：
 * - 目标路径一律由服务端依据 moduleName/businessName 派生，不接受客户端传入路径；
 * - moduleName/businessName 已在 gen.service 通过 NAME_PATTERN 校验（字母开头仅字母数字），
 *   此处再做 resolve 后前缀校验，双重防御路径穿越与任意写。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { isAbsolute, join, resolve, sep } from 'path';
import { AppError } from '@/utils/response';
import { previewGenCode, type GenConfig, type GenFile } from './gen.service';

/** 生成落盘结果。 */
export interface GenCreateResult {
  /** 成功写入的文件（相对项目根） */
  written: string[];
  /** 已自动接线的文件（相对项目根） */
  injected: string[];
  /** 生成后仍需人工完成的步骤 */
  manualSteps: string[];
}

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

  // 自动接线（模型注册 + 路由挂载），锚点缺失则跳过并提示人工处理
  const injected: string[] = [];
  const businessName = config.businessName;
  const cls = businessName.charAt(0).toUpperCase() + businessName.slice(1);
  if (injectModel(cls)) {
    injected.push('api/src/models/index.ts');
  }
  if (injectRoutes(businessName)) {
    injected.push('api/src/routes/index.ts');
  }

  const perm = `${config.moduleName}:${businessName}`;
  const manualSteps = [
    '后端已自动完成模型注册与路由挂载，重启后端（npm run dev）后生效；',
    `请在「系统管理-菜单管理」新增菜单：路径 /${config.moduleName}/${businessName}，组件 ${config.moduleName}/${businessName}/index；`,
    `并为角色授权以下权限码：${perm}:list / ${perm}:query / ${perm}:add / ${perm}:edit / ${perm}:remove（只读角色不得授予写操作码）；`,
    '前端路由由动态菜单驱动，配好菜单即可访问，无需手动注册。',
  ];

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
