/**
 * 代码生成模板。
 * 模块职责：根据表结构渲染出前后端 CRUD 代码文本，风格对齐项目现有模块（user / role / menu）。
 *
 * 说明：生成物是「可直接落地的骨架」，生成器不追求覆盖全部业务细节，
 * 生成的 README 会写明接线步骤（注册模型、挂载路由、补菜单与权限码）。
 */
import type { GenColumn, GenConfig, GenFile } from './gen.service.js';

/** 时间戳类字段：不参与新增/编辑表单。 */
const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'create_time', 'update_time'];

/**
 * 内置「启用 / 禁用」状态字典类型。
 * 与 `gen.service.ts` 的推荐逻辑保持一致（那边是生成期建议值，这边用于决定生成哪种取字典方式）。
 */
const BUILTIN_STATUS_DICT = 'sys_common_status';

/** 首字母大写（PascalCase）。 */
export function toPascal(name: string): string {
  return name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

/** 驼峰（camelCase）。 */
export function toCamel(name: string): string {
  const pascal = toPascal(name);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** SQL 类型 → TypeScript 类型。 */
export function toTsType(dataType: string): GenColumn['tsType'] {
  const t = dataType.toLowerCase();
  if (['tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint', 'decimal', 'float', 'double'].includes(t)) {
    return 'number';
  }
  if (['bit', 'bool', 'boolean'].includes(t)) {
    return 'boolean';
  }
  if (['date', 'datetime', 'timestamp', 'time', 'year'].includes(t)) {
    return 'Date';
  }
  return 'string';
}

/** SQL 字段 → Sequelize DataType 表达式。 */
function toSequelizeType(col: GenColumn): string {
  const t = col.dataType.toLowerCase();
  if (t === 'bigint') {
    return 'DataType.BIGINT.UNSIGNED';
  }
  if (['int', 'integer', 'mediumint'].includes(t)) {
    return 'DataType.INTEGER';
  }
  if (['smallint'].includes(t)) {
    return 'DataType.SMALLINT';
  }
  if (['tinyint'].includes(t)) {
    return 'DataType.TINYINT';
  }
  if (['decimal', 'numeric'].includes(t)) {
    return 'DataType.DECIMAL(10, 2)';
  }
  if (['float'].includes(t)) {
    return 'DataType.FLOAT';
  }
  if (['double'].includes(t)) {
    return 'DataType.DOUBLE';
  }
  if (['date', 'datetime', 'timestamp'].includes(t)) {
    return 'DataType.DATE';
  }
  if (['time'].includes(t)) {
    return 'DataType.TIME';
  }
  if (['year'].includes(t)) {
    return 'DataType.INTEGER';
  }
  if (['text', 'longtext', 'mediumtext', 'tinytext'].includes(t)) {
    return 'DataType.TEXT';
  }
  if (['json'].includes(t)) {
    return 'DataType.JSON';
  }
  // 字符类：带上长度
  const len = col.columnType.match(/\((\d+)\)/);
  return len ? `DataType.STRING(${len[1]})` : 'DataType.STRING(255)';
}

/**
 * SQL 字段 → zod 校验表达式。
 * 注意链序：zod 必须先接校验器再接 .optional()，ZodOptional 上没有 min/int 等方法。
 * @param col 字段
 * @param forceOptional 强制可选（编辑表单/查询参数统一可选）
 */
function toZod(col: GenColumn, forceOptional = false): string {
  const max = col.columnType.match(/\((\d+)\)/);
  const maxLen = max ? Number(max[1]) : 255;
  let base: string;
  switch (col.tsType) {
    case 'number':
      base =
        col.dataType === 'decimal' || col.dataType === 'float' || col.dataType === 'double'
          ? 'z.coerce.number()'
          : 'z.coerce.number().int()';
      break;
    case 'boolean':
      base = 'z.coerce.number().int().min(0).max(1)';
      break;
    case 'Date':
      base = 'z.coerce.date()';
      break;
    default:
      base = `z.string().trim().max(${maxLen}, '长度不能超过 ${maxLen}')`;
      break;
  }
  // 可空字段或强制可选：校验链收尾后统一 .optional()
  if (forceOptional || col.isNullable) {
    return `${base}.optional()`;
  }
  return col.tsType === 'string' ? `${base}.min(1, '${col.columnComment || col.columnName}不能为空')` : base;
}

/**
 * 查询条件用的 zod 规则。
 *
 * 数值型额外允许空串：筛选框被清空时前端送出的是 `''`，而 `z.coerce.number()` 会把
 * `''` 变成 `0`，导致「清空筛选」反而变成「按 0 过滤」。保留空串后由 service 的
 * `!== ''` 判断跳过该条件。
 * @param col 字段
 */
function toQueryZod(col: GenColumn): string {
  if (col.tsType === 'number') {
    const numeric = ['decimal', 'float', 'double'].includes(col.dataType)
      ? 'z.coerce.number()'
      : 'z.coerce.number().int()';
    return `z.union([z.literal(''), ${numeric}]).optional()`;
  }
  return toZod(col, true);
}

/** 参与新增/编辑的字段（排除主键与时间戳）。 */
function editableColumns(columns: GenColumn[]): GenColumn[] {
  return columns.filter((c) => !c.isPk && !TIMESTAMP_FIELDS.includes(c.columnName));
}

/**
 * 参与列表查询的字段（仅字符串与数字，避免过多条件）。
 * @param columns 字段列表
 * @param exclude 需排除的字段名（树形表排除父级字段——在整棵树里按上级筛选语义混乱）
 */
function queryColumns(columns: GenColumn[], exclude: string[] = []): GenColumn[] {
  return editableColumns(columns)
    .filter((c) => (c.tsType === 'string' || c.tsType === 'number') && !exclude.includes(c.fieldName))
    .slice(0, 4);
}

/** 树形表的父级字段（未勾选树形、或字段不存在时返回 null）。 */
function treeParentColumn(config: GenConfig, columns: GenColumn[]): GenColumn | null {
  if (!config.isTree) {
    return null;
  }
  const field = config.treeParentField || 'parentId';
  return columns.find((c) => c.fieldName === field) ?? null;
}

/** 绑定了字典的下拉字段。 */
function dictColumns(columns: GenColumn[]): GenColumn[] {
  return columns.filter((c) => c.htmlType === 'select' && c.dictType);
}

/** 本次生成用到的字典类型（去重，顺序稳定）。 */
function usedDictTypes(columns: GenColumn[]): string[] {
  return [...new Set(dictColumns(columns).map((c) => c.dictType))];
}

/**
 * 项目 prettier 的 `printWidth`（见根目录 `.prettierrc.json`）。
 *
 * 生成 `<el-option>` 时用它决定写单行还是多行：属性总长随字典变量名变化，
 * 写死任何一种都会有一半情况与 prettier 的换行策略不符，导致生成物
 * 通不过 `prettier --check`、用户还得手工格式化一遍。
 */
const PRINT_WIDTH = 120;

/**
 * 计算字符串的显示宽度（中日韩字符按 2 列计）。
 * prettier 格式化 Markdown 表格时按**显示宽度**对齐，生成物必须与之保持一致，
 * 否则表格会被重排、产物过不了 `prettier --check`。
 * @param text 文本
 */
function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    width += (char.codePointAt(0) ?? 0) > 0x2e80 ? 2 : 1;
  }
  return width;
}

/**
 * 渲染 Markdown 表格（按显示宽度对齐，与 prettier 的格式化结果一致）。
 * @param header 表头
 * @param rows 数据行
 */
function renderMarkdownTable(header: string[], rows: string[][]): string[] {
  const widths = header.map((_, index) =>
    Math.max(displayWidth(header[index]), ...rows.map((row) => displayWidth(row[index] ?? ''))),
  );
  const renderRow = (cells: string[]): string =>
    `| ${cells.map((cell, index) => cell + ' '.repeat(widths[index] - displayWidth(cell))).join(' | ')} |`;
  return [renderRow(header), `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`, ...rows.map(renderRow)];
}

/**
 * 渲染具名导入语句：放得下写单行，超出 `printWidth` 则每项独占一行（与 prettier 策略一致）。
 * @param names 具名列表
 * @param from 模块路径
 * @param indent 缩进（默认无）
 */
function renderNamedImport(names: string[], from: string, indent = ''): string {
  const oneLine = `${indent}import { ${names.join(', ')} } from '${from}';`;
  if (oneLine.length <= PRINT_WIDTH) {
    return oneLine;
  }
  return [`${indent}import {`, ...names.map((name) => `${indent}  ${name},`), `${indent}} from '${from}';`].join('\n');
}

/**
 * 渲染路由注册：放得下写单行，超出 `printWidth` 则每个参数独占一行并保留尾逗号。
 * @param verb HTTP 方法（小写，如 `get`）
 * @param args 调用参数
 */
function renderRoute(verb: string, args: string[]): string {
  const oneLine = `router.${verb}(${args.join(', ')});`;
  if (oneLine.length <= PRINT_WIDTH) {
    return oneLine;
  }
  return [`router.${verb}(`, ...args.map((arg) => `  ${arg},`), `);`].join('\n');
}

/**
 * 渲染 `<el-option>`：放得下写单行，超出 `printWidth` 则每个属性独占一行（与 prettier 策略一致）。
 * @param optionsVar 选项变量名
 * @param indent 该元素的缩进
 */
function renderOption(optionsVar: string, indent: string): string {
  const attrs = `v-for="item in ${optionsVar}" :key="item.value" :label="item.label" :value="item.value"`;
  const oneLine = `${indent}<el-option ${attrs} />`;
  if (oneLine.length <= PRINT_WIDTH) {
    return oneLine;
  }
  const inner = `${indent}  `;
  return [
    `${indent}<el-option`,
    `${inner}v-for="item in ${optionsVar}"`,
    `${inner}:key="item.value"`,
    `${inner}:label="item.label"`,
    `${inner}:value="item.value"`,
    `${indent}/>`,
  ].join('\n');
}

/** 渲染 Sequelize 模型。 */
function renderModel(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const cls = toPascal(config.businessName);
  const parent = treeParentColumn(config, columns);
  // 树形表补上父子自关联（与 Dept / Menu 同一模式）
  const associations = parent
    ? [
        ``,
        `  // 树形自关联：显式指定外键并关闭数据库级约束（与 Dept / Menu 同一模式）。`,
        `  // 不用 @ForeignKey 建真实外键，避免根节点的 ${parent.fieldName}=0 不在本表中而被约束拒绝。`,
        `  @BelongsTo(() => ${cls}, { foreignKey: '${parent.fieldName}', constraints: false })`,
        `  declare parent: ${cls} | null;`,
      ].join('\n')
    : '';
  const fields = columns
    .filter((c) => !TIMESTAMP_FIELDS.includes(c.columnName))
    .map((c) => {
      if (c.isPk) {
        return [
          '  @PrimaryKey',
          '  @AutoIncrement',
          `  @Column({ type: DataType.BIGINT.UNSIGNED, comment: '${c.columnComment || '主键'}' })`,
          `  declare id: number;`,
        ].join('\n');
      }
      const nullSuffix = c.tsType === 'Date' ? ' | null' : c.isNullable ? ' | null' : '';
      return [
        `  @Column({ type: ${toSequelizeType(c)}, allowNull: ${c.isNullable}, comment: '${c.columnComment || c.columnName}' })`,
        `  declare ${c.fieldName}: ${c.tsType}${nullSuffix};`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    `/**`,
    ` * ${tableComment || config.tableName} 模型 \`${config.tableName}\`。`,
    ` * 模块职责：映射数据表字段（由代码生成器生成，请按需补充关联与约束）。`,
    ` */`,
    renderNamedImport(
      ['AutoIncrement', ...(parent ? ['BelongsTo'] : []), 'Column', 'DataType', 'Model', 'PrimaryKey', 'Table'],
      'sequelize-typescript',
    ),
    ``,
    `@Table({`,
    `  tableName: '${config.tableName}',`,
    `  underscored: true,`,
    `  timestamps: true,`,
    `  comment: '${tableComment || config.tableName}',`,
    `})`,
    `export class ${cls} extends Model {`,
    fields,
    // 非树形表不插入（插入空串会多出一个空行，导致产物过不了 prettier --check）
    ...(associations ? [associations] : []),
    `}`,
    ``,
  ].join('\n');
}

/** 渲染 zod 校验器。 */
function renderValidator(config: GenConfig, columns: GenColumn[]): string {
  const name = toCamel(config.businessName);
  const pascal = toPascal(config.businessName);
  const editable = editableColumns(columns);
  const parentField = treeParentColumn(config, columns)?.fieldName;
  const query = queryColumns(columns, parentField ? [parentField] : []);

  // 树形表返回整棵树，不做分页，故不生成分页参数
  const paginationFields = config.isTree
    ? []
    : [
        '  page: z.coerce.number().int().positive().optional(),',
        '  pageSize: z.coerce.number().int().positive().optional(),',
      ];

  const queryFields = [...paginationFields, ...query.map((c) => `  ${c.fieldName}: ${toQueryZod(c)},`)].join('\n');

  // 父级字段给默认值 0（根节点），与「部门」模块一致：不填即顶级
  const writeFields = (withRequired: boolean): string =>
    editable
      .map((c) =>
        c.fieldName === parentField
          ? `  ${c.fieldName}: z.coerce.number().int().min(0).default(0),`
          : `  ${c.fieldName}: ${toZod(c, !withRequired)},`,
      )
      .join('\n');

  return [
    `/**`,
    ` * ${config.businessName} 模块校验 schema。`,
    ` * 模块职责：列表查询、新增、编辑的 zod 规则（由代码生成器生成）。`,
    ` */`,
    `import { z } from 'zod';`,
    ``,
    `/** 列表查询。 */`,
    `export const ${name}ListQuerySchema = z.object({`,
    queryFields,
    `});`,
    ``,
    `/** 新增。 */`,
    `export const create${pascal}Schema = z.object({`,
    writeFields(true),
    `});`,
    ``,
    `/** 编辑。 */`,
    `export const update${pascal}Schema = z.object({`,
    writeFields(false),
    `});`,
    ``,
    `export type Create${pascal}Input = z.infer<typeof create${pascal}Schema>;`,
    `export type Update${pascal}Input = z.infer<typeof update${pascal}Schema>;`,
    ``,
  ].join('\n');
}

/** 渲染 service。 */
function renderService(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const parent = treeParentColumn(config, columns);
  const parentField = parent?.fieldName ?? '';
  const query = queryColumns(columns, parentField ? [parentField] : []);
  const whereLines = query
    .map((c) => {
      if (c.tsType === 'string') {
        return [
          `  const ${c.fieldName} = typeof query.${c.fieldName} === 'string' ? String(query.${c.fieldName}).trim() : '';`,
          `  if (${c.fieldName}) {`,
          `    where.${c.fieldName} = { [Op.like]: \`%\${${c.fieldName}}%\` };`,
          `  }`,
        ].join('\n');
      }
      return [
        `  if (query.${c.fieldName} !== undefined && query.${c.fieldName} !== '') {`,
        `    where.${c.fieldName} = Number(query.${c.fieldName});`,
        `  }`,
      ].join('\n');
    })
    .join('\n\n');

  // 树形表返回整棵树（不分页）；普通表返回分页结果
  const listBlock = parent
    ? [
        `/**`,
        ` * 查询${config.businessName}（返回整棵树，不做分页）。`,
        ` * @param query 查询参数`,
        ` */`,
        `export async function list${cls}s(query: Record<string, unknown>): Promise<${cls}TreeNode[]> {`,
        `  const where: WhereOptions = {};`,
        ``,
        whereLines || '  // 无可用查询条件，可按业务补充',
        ``,
        `  const rows = await ${cls}.findAll({ where, order: [['id', 'ASC']] });`,
        `  // buildTree 依赖 id / parentId，且内部会浅拷贝节点；直接传 Sequelize 实例会因`,
        `  // 列值挂在原型上而丢掉数据，必须先转成普通对象。`,
        `  const nodes = rows.map((row) => row.get({ plain: true }) as unknown as TreeNode);`,
        `  return buildTree(nodes) as unknown as ${cls}TreeNode[];`,
        `}`,
      ]
    : [
        `/**`,
        ` * 分页查询${config.businessName}。`,
        ` * @param query 查询参数`,
        ` */`,
        `export async function list${cls}s(query: Record<string, unknown>): Promise<PageResult<${cls}>> {`,
        `  const { page, pageSize, offset, limit } = parsePagination(query);`,
        `  const where: WhereOptions = {};`,
        ``,
        whereLines || '  // 无可用查询条件，可按业务补充',
        ``,
        `  const { rows, count } = await ${cls}.findAndCountAll({`,
        `    where,`,
        `    order: [['id', 'DESC']],`,
        `    offset,`,
        `    limit,`,
        `  });`,
        ``,
        `  return buildPageResult(rows, count, page, pageSize);`,
        `}`,
      ];

  return [
    `/**`,
    ` * ${config.businessName} 服务。`,
    ` * 模块职责：${parent ? '树形查询' : '分页查询'}与 CRUD（由代码生成器生成）。`,
    ` */`,
    `import { Op, type WhereOptions } from 'sequelize';`,
    `import { ${cls} } from '@/models';`,
    ...(parent
      ? [`import { AppError } from '@/utils/response';`, `import { buildTree, type WithChildren } from '@/utils/tree';`]
      : [
          `import type { PageResult } from '@/types';`,
          `import { buildPageResult, parsePagination } from '@/utils/pagination';`,
          `import { AppError } from '@/utils/response';`,
        ]),
    ``,
    ...(parent
      ? [
          `/** 树节点类型（记录字段 + children）。 */`,
          `export type ${cls}TreeNode = WithChildren<Record<string, unknown>>;`,
          ``,
          `/** buildTree 所需的最小节点结构。 */`,
          `interface TreeNode {`,
          `  id: number;`,
          `  parentId: number;`,
          `  sort?: number;`,
          `}`,
          ``,
        ]
      : []),
    ...listBlock,
    ``,
    `/**`,
    ` * 查询详情。`,
    ` * @param id 主键`,
    ` */`,
    `export async function get${cls}Detail(id: number): Promise<${cls}> {`,
    `  const record = await ${cls}.findByPk(id);`,
    `  if (!record) {`,
    `    throw AppError.notFound('记录不存在');`,
    `  }`,
    `  return record;`,
    `}`,
    ``,
    `/**`,
    ` * 新增。`,
    ` * @param input 新增参数`,
    ` */`,
    `export async function create${cls}(input: Record<string, unknown>): Promise<${cls}> {`,
    ...(parent ? [`  await assertParentValid(Number(input.${parentField} ?? 0));`] : []),
    `  return ${cls}.create(input as never);`,
    `}`,
    ``,
    `/**`,
    ` * 编辑。`,
    ` * @param id 主键`,
    ` * @param input 编辑参数`,
    ` */`,
    `export async function update${cls}(id: number, input: Record<string, unknown>): Promise<${cls}> {`,
    `  const record = await get${cls}Detail(id);`,
    ...(parent ? [`  await assertParentValid(Number(input.${parentField} ?? 0), id);`] : []),
    `  await record.update(input as never);`,
    `  return record;`,
    `}`,
    ``,
    `/**`,
    ` * 删除。`,
    ` * @param id 主键`,
    ` */`,
    `export async function remove${cls}(id: number): Promise<void> {`,
    `  const record = await get${cls}Detail(id);`,
    ...(parent
      ? [
          `  const childCount = await ${cls}.count({ where: { ${parentField}: id } });`,
          `  if (childCount > 0) {`,
          `    throw AppError.conflict('存在下级节点，请先删除下级');`,
          `  }`,
        ]
      : []),
    `  await record.destroy();`,
    `}`,
    ``,
    ...(parent
      ? [
          `/** 收集指定节点的全部后代 id。 */`,
          `async function collectDescendantIds(id: number): Promise<number[]> {`,
          `  const result: number[] = [];`,
          `  let currentLevel: number[] = [id];`,
          ``,
          `  while (currentLevel.length > 0) {`,
          `    const children = await ${cls}.findAll({`,
          `      where: { ${parentField}: { [Op.in]: currentLevel } },`,
          `      attributes: ['id'],`,
          `    });`,
          `    const childIds = children.map((child) => Number(child.id));`,
          `    if (childIds.length === 0) {`,
          `      break;`,
          `    }`,
          `    result.push(...childIds);`,
          `    currentLevel = childIds;`,
          `  }`,
          ``,
          `  return result;`,
          `}`,
          ``,
          `/**`,
          ` * 校验父级合法性：不能选自己，也不能选自己的后代，否则树会成环。`,
          ` * @param parentId 待设置的父级 id（0 表示根节点）`,
          ` * @param selfId 当前节点 id（新增时不传）`,
          ` */`,
          `async function assertParentValid(parentId: number, selfId?: number): Promise<void> {`,
          `  if (parentId === 0 || selfId === undefined) {`,
          `    return;`,
          `  }`,
          `  if (parentId === selfId) {`,
          `    throw AppError.badRequest('上级不能是自己');`,
          `  }`,
          `  const descendants = await collectDescendantIds(selfId);`,
          `  if (descendants.includes(parentId)) {`,
          `    throw AppError.badRequest('上级不能是自己的下级');`,
          `  }`,
          `}`,
          ``,
        ]
      : []),
    `/** 供 controller 复用的导出别名（保持命名一致）。 */`,
    `export const ${name}Service = {`,
    `  list: list${toPascal(config.businessName)}s,`,
    `  detail: get${cls}Detail,`,
    `  create: create${cls},`,
    `  update: update${cls},`,
    `  remove: remove${cls},`,
    `};`,
    ``,
  ].join('\n');
}

/** 渲染 controller。 */
function renderController(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const plural = `${toPascal(config.businessName)}s`;
  return [
    `/**`,
    ` * ${config.businessName} 控制器。`,
    ` * 模块职责：接收请求参数、调用 service、返回统一响应（由代码生成器生成）。`,
    ` */`,
    `import type { Request, Response } from 'express';`,
    `import * as ${toCamel(config.businessName)}Service from '@/services/${toCamel(config.businessName)}.service';`,
    `import { ok } from '@/utils/response';`,
    ``,
    `/** 分页列表。 */`,
    `export async function list${plural}(req: Request, res: Response): Promise<void> {`,
    `  const result = await ${toCamel(config.businessName)}Service.list${plural}(req.query as Record<string, unknown>);`,
    `  ok(res, result);`,
    `}`,
    ``,
    `/** 详情。 */`,
    `export async function get${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.get${cls}Detail(Number(req.params.id));`,
    `  ok(res, record);`,
    `}`,
    ``,
    `/** 新增。 */`,
    `export async function create${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.create${cls}(req.body as Record<string, unknown>);`,
    `  ok(res, record, '新增成功');`,
    `}`,
    ``,
    `/** 编辑。 */`,
    `export async function update${cls}(req: Request, res: Response): Promise<void> {`,
    `  const record = await ${toCamel(config.businessName)}Service.update${cls}(Number(req.params.id), req.body as Record<string, unknown>);`,
    `  ok(res, record, '修改成功');`,
    `}`,
    ``,
    `/** 删除。 */`,
    `export async function remove${cls}(req: Request, res: Response): Promise<void> {`,
    `  await ${toCamel(config.businessName)}Service.remove${cls}(Number(req.params.id));`,
    `  ok(res, null, '删除成功');`,
    `}`,
    ``,
  ].join('\n');
}

/** 渲染路由（含独立权限码）。 */
function renderRoutes(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const plural = `${cls}s`;
  const perm = `${config.moduleName}:${toCamel(config.businessName)}`;
  return [
    `/**`,
    ` * ${config.businessName} 路由 \`/api/${toCamel(config.businessName)}\`。`,
    ` * 模块职责：挂载 CRUD 接口并施加鉴权与权限码（由代码生成器生成）。`,
    ` */`,
    `import { Router } from 'express';`,
    `import * as ${toCamel(config.businessName)}Controller from '@/controllers/${toCamel(config.businessName)}.controller';`,
    `import { authenticate } from '@/middlewares/auth';`,
    `import { requirePermission } from '@/middlewares/permission';`,
    `import { validate } from '@/middlewares/validate';`,
    `import { asyncHandler } from '@/utils/asyncHandler';`,
    renderNamedImport(
      [`create${cls}Schema`, `update${cls}Schema`, `${toCamel(config.businessName)}ListQuerySchema`],
      `@/validators/${toCamel(config.businessName)}.validator`,
    ),
    ``,
    `const router = Router();`,
    ``,
    `router.use(authenticate);`,
    ``,
    renderRoute('get', [
      `'/'`,
      `validate({ query: ${toCamel(config.businessName)}ListQuerySchema })`,
      `requirePermission('${perm}:list')`,
      `asyncHandler(${toCamel(config.businessName)}Controller.list${plural})`,
    ]),
    ``,
    renderRoute('get', [
      `'/:id'`,
      `requirePermission('${perm}:query')`,
      `asyncHandler(${toCamel(config.businessName)}Controller.get${cls})`,
    ]),
    ``,
    renderRoute('post', [
      `'/'`,
      `validate({ body: create${cls}Schema })`,
      `requirePermission('${perm}:add')`,
      `asyncHandler(${toCamel(config.businessName)}Controller.create${cls})`,
    ]),
    ``,
    renderRoute('put', [
      `'/:id'`,
      `validate({ body: update${cls}Schema })`,
      `requirePermission('${perm}:edit')`,
      `asyncHandler(${toCamel(config.businessName)}Controller.update${cls})`,
    ]),
    ``,
    renderRoute('delete', [
      `'/:id'`,
      `requirePermission('${perm}:remove')`,
      `asyncHandler(${toCamel(config.businessName)}Controller.remove${cls})`,
    ]),
    ``,
    `export default router;`,
    ``,
  ].join('\n');
}

/** 渲染前端 api。 */
function renderFrontendApi(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const isTree = treeParentColumn(config, columns) !== null;
  return [
    `/**`,
    ` * ${config.businessName} 接口封装（由代码生成器生成）。`,
    ` */`,
    `import { del, get, post, put } from './request';`,
    // 树形表的列表返回整棵树，用不到分页类型；不引入未使用的 import（会被 eslint 判为告警）
    ...(isTree ? [] : [`import type { PageResult } from '@/types/api';`]),
    ``,
    `const BASE = '/${name}';`,
    ``,
    `/** ${config.businessName} 记录。 */`,
    `export interface ${cls} {`,
    `  id: number;`,
    `  [key: string]: unknown;`,
    `}`,
    ``,
    ...(isTree
      ? [
          `/** 树节点。 */`,
          `export interface ${cls}TreeNode extends ${cls} {`,
          `  children?: ${cls}TreeNode[];`,
          `}`,
          ``,
          `/** 查询树（返回整棵树，不做分页）。 */`,
          `export function get${cls}List(params: Record<string, unknown>): Promise<${cls}TreeNode[]> {`,
          `  return get<${cls}TreeNode[]>(BASE, params);`,
          `}`,
        ]
      : [
          `/** 分页查询。 */`,
          `export function get${cls}List(params: Record<string, unknown>): Promise<PageResult<${cls}>> {`,
          `  return get<PageResult<${cls}>>(BASE, params);`,
          `}`,
        ]),
    ``,
    `/** 详情。 */`,
    `export function get${cls}(id: number): Promise<${cls}> {`,
    `  return get<${cls}>(BASE + '/' + id);`,
    `}`,
    ``,
    `/** 新增。 */`,
    `export function create${cls}(data: Partial<${cls}>): Promise<${cls}> {`,
    `  return post<${cls}>(BASE, data);`,
    `}`,
    ``,
    `/** 编辑。 */`,
    `export function update${cls}(id: number, data: Partial<${cls}>): Promise<${cls}> {`,
    `  return put<${cls}>(BASE + '/' + id, data);`,
    `}`,
    ``,
    `/** 删除。 */`,
    `export function delete${cls}(id: number): Promise<null> {`,
    `  return del<null>(BASE + '/' + id);`,
    `}`,
    ``,
  ].join('\n');
}

/** 渲染前端页面。 */
function renderFrontendView(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  const editable = editableColumns(columns);
  const parent = treeParentColumn(config, columns);
  const parentField = parent?.fieldName ?? '';
  const dictTypes = usedDictTypes(columns);
  /** 字典类型 → 变量前缀（`article_status` → `articleStatus`；状态字典沿用 useStatusDict 的 `status`） */
  const dictVar = (dictType: string): string =>
    dictType === BUILTIN_STATUS_DICT ? 'status' : toCamel(dictType.replace(/[^a-zA-Z0-9]+/g, '_'));
  const optionsVar = (c: GenColumn): string => `${dictVar(c.dictType)}Options`;
  const labelVar = (c: GenColumn): string => `${dictVar(c.dictType)}Label`;
  /** 树形下拉的显示字段：取第一个可编辑的字符串字段（排除父级字段本身） */
  const treeLabelField = editable.find((c) => c.tsType === 'string' && c.fieldName !== parentField)?.fieldName || 'id';
  const commentOf = (c: GenColumn): string => c.columnComment || c.columnName;

  const tableCols = editable
    // 树形表的层级已由表格缩进表达，再列一个上级 id 是噪音
    .filter((c) => c.fieldName !== parentField)
    .slice(0, 8)
    .map((c) => {
      // 字典字段必须显示中文标签，直接渲染会看到存储值（1 / 0）
      if (c.htmlType === 'select') {
        return [
          `        <el-table-column label="${commentOf(c)}" min-width="120" show-overflow-tooltip>`,
          `          <template #default="{ row }">{{ ${labelVar(c)}(row.${c.fieldName}) }}</template>`,
          `        </el-table-column>`,
        ].join('\n');
      }
      return `        <el-table-column prop="${c.fieldName}" label="${commentOf(c)}" min-width="120" show-overflow-tooltip />`;
    })
    .join('\n');

  const formItems = editable
    .map((c) => {
      // 树形表的父级字段：用树形下拉选择
      if (c.fieldName === parentField) {
        return [
          `        <el-form-item label="${commentOf(c)}" prop="${c.fieldName}">`,
          `          <el-tree-select`,
          `            v-model="form.${c.fieldName}"`,
          `            :data="parentOptions"`,
          `            :props="{ label: '${treeLabelField}', children: 'children' }"`,
          `            node-key="id"`,
          `            check-strictly`,
          `            :render-after-expand="false"`,
          `            placeholder="请选择上级"`,
          `            style="width: 100%"`,
          `          />`,
          `        </el-form-item>`,
        ].join('\n');
      }
      if (c.htmlType === 'select') {
        return [
          `        <el-form-item label="${commentOf(c)}" prop="${c.fieldName}">`,
          `          <el-select v-model="form.${c.fieldName}" placeholder="请选择${commentOf(c)}" style="width: 100%">`,
          renderOption(optionsVar(c), '            '),
          `          </el-select>`,
          `        </el-form-item>`,
        ].join('\n');
      }
      return [
        `        <el-form-item label="${commentOf(c)}" prop="${c.fieldName}">`,
        `          <el-input v-model="form.${c.fieldName}" placeholder="请输入${commentOf(c)}" />`,
        `        </el-form-item>`,
      ];
    })
    .join('\n');

  const searchItems = queryColumns(columns, parentField ? [parentField] : [])
    .map((c) => {
      if (c.htmlType === 'select') {
        return [
          `        <el-form-item label="${commentOf(c)}">`,
          `          <el-select v-model="query.${c.fieldName}" placeholder="请选择${commentOf(c)}" clearable style="width: 160px">`,
          renderOption(optionsVar(c), '            '),
          `          </el-select>`,
          `        </el-form-item>`,
        ].join('\n');
      }
      return [
        `        <el-form-item label="${commentOf(c)}">`,
        `          <el-input v-model="query.${c.fieldName}" placeholder="请输入${commentOf(c)}" clearable />`,
        `        </el-form-item>`,
      ];
    })
    .join('\n');

  const formInit = editable.map((c) => `  ${c.fieldName}: ${c.tsType === 'number' ? '0' : "''"},`).join('\n');
  // 查询字段必须先在 reactive 中声明，否则模板绑定 query.xxx 会产生类型错误
  const queryInit = queryColumns(columns, parentField ? [parentField] : [])
    .map((c) => `  ${c.fieldName}: '',`)
    .join('\n');

  // 字典引入与声明：状态类走项目封装的 useStatusDict（值为数字，与库中一致），其余走 useDict
  const usesStatusDict = dictTypes.includes(BUILTIN_STATUS_DICT);
  const usesCustomDict = dictTypes.some((t) => t !== BUILTIN_STATUS_DICT);
  const dictImportLines =
    dictTypes.length > 0
      ? [
          `import { ${[...(usesStatusDict ? ['useStatusDict'] : []), ...(usesCustomDict ? ['useDict'] : [])].sort().join(', ')} } from '@/composables/useDict';`,
        ]
      : [];
  const dictDecls = dictTypes.map((dictType) =>
    dictType === BUILTIN_STATUS_DICT
      ? `const { statusOptions, statusLabel } = useStatusDict();`
      : `const { options: ${dictVar(dictType)}Options, labelOf: ${dictVar(dictType)}Label } = useDict('${dictType}');`,
  );

  return [
    `<script setup lang="ts">`,
    `/**`,
    ` * ${config.businessName} 列表页（由代码生成器生成）。`,
    ` */`,
    `import { ${parent ? 'computed, ' : ''}onMounted, reactive, ref } from 'vue';`,
    `import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus';`,
    ...dictImportLines,
    renderNamedImport(
      [
        `create${cls}`,
        `delete${cls}`,
        `get${cls}List`,
        `update${cls}`,
        `type ${cls}`,
        ...(parent ? [`type ${cls}TreeNode`] : []),
      ],
      `@/api/${name}`,
    ),
    ``,
    ...(parent
      ? [`const list = ref<${cls}TreeNode[]>([]);`, `const loading = ref(false);`]
      : [`const list = ref<${cls}[]>([]);`, `const loading = ref(false);`, `const total = ref(0);`]),
    `const dialogVisible = ref(false);`,
    `const editingId = ref<number | null>(null);`,
    `const formRef = ref<FormInstance>();`,
    ``,
    `const query = reactive({`,
    ...(parent ? [] : [`  page: 1,`, `  pageSize: 10,`]),
    queryInit || `  // 无可用查询字段`,
    `});`,
    `const form = reactive({`,
    formInit || `  // 无可用字段`,
    `});`,
    ``,
    ...(dictDecls.length > 0 ? [`/** 字典选项与取值标签。 */`, ...dictDecls, ``] : []),
    ...(parent
      ? [
          `/** 上级候选：整棵树剔除自身及其后代，避免把自己挂到自己下面。 */`,
          `function filterSelf(nodes: ${cls}TreeNode[], selfId: number | null): ${cls}TreeNode[] {`,
          `  return nodes`,
          `    .filter((node) => node.id !== selfId)`,
          `    .map((node) => ({ ...node, children: node.children ? filterSelf(node.children, selfId) : [] }));`,
          `}`,
          ``,
          `/** 可选的上级节点（编辑时需排除自身及其子树）。 */`,
          `const parentOptions = computed(() => filterSelf(list.value, editingId.value));`,
          ``,
        ]
      : []),
    `/** 加载列表。 */`,
    `async function loadList() {`,
    `  loading.value = true;`,
    `  try {`,
    ...(parent
      ? [`    // 树形表返回整棵树，无分页`, `    list.value = await get${cls}List(query);`]
      : [`    const res = await get${cls}List(query);`, `    list.value = res.list;`, `    total.value = res.total;`]),
    `  } finally {`,
    `    loading.value = false;`,
    `  }`,
    `}`,
    ``,
    `/** 打开新增。 */`,
    `function handleAdd() {`,
    `  editingId.value = null;`,
    `  dialogVisible.value = true;`,
    `}`,
    ``,
    `/** 打开编辑。 */`,
    `function handleEdit(row: ${cls}) {`,
    `  editingId.value = row.id;`,
    `  Object.assign(form, row);`,
    `  dialogVisible.value = true;`,
    `}`,
    ``,
    `/** 提交表单。 */`,
    `async function handleSubmit() {`,
    `  await formRef.value?.validate();`,
    `  if (editingId.value) {`,
    `    await update${cls}(editingId.value, form);`,
    `    ElMessage.success('修改成功');`,
    `  } else {`,
    `    await create${cls}(form);`,
    `    ElMessage.success('新增成功');`,
    `  }`,
    `  dialogVisible.value = false;`,
    `  loadList();`,
    `}`,
    ``,
    `/** 删除。 */`,
    `async function handleDelete(row: ${cls}) {`,
    `  await ElMessageBox.confirm('确定删除该记录吗？', '删除确认', { type: 'warning' });`,
    `  await delete${cls}(row.id);`,
    `  ElMessage.success('删除成功');`,
    `  loadList();`,
    `}`,
    ``,
    `onMounted(loadList);`,
    `</script>`,
    ``,
    `<template>`,
    `  <div>`,
    `    <el-card shadow="never" class="mb-3">`,
    `      <el-form :model="query" inline>`,
    searchItems || `        <!-- 无可用查询条件 -->`,
    `        <el-form-item>`,
    `          <el-button type="primary" @click="loadList">`,
    `            <template #icon><i class="bi bi-search" /></template>`,
    `            查询`,
    `          </el-button>`,
    `        </el-form-item>`,
    `      </el-form>`,
    `    </el-card>`,
    ``,
    `    <el-card shadow="never">`,
    `      <div class="flex items-center justify-between mb-3">`,
    `        <span class="table-title">${config.businessName} 列表</span>`,
    `        <el-button v-permission="'${perm}:add'" type="primary" @click="handleAdd">`,
    `          <template #icon><i class="bi bi-plus" /></template>`,
    `          新增`,
    `        </el-button>`,
    `      </div>`,
    ``,
    parent
      ? `      <el-table v-loading="loading" :data="list" row-key="id" :tree-props="{ children: 'children' }" default-expand-all>`
      : `      <el-table v-loading="loading" :data="list">`,
    tableCols || `        <el-table-column prop="id" label="ID" width="80" />`,
    `        <el-table-column label="操作" width="160" fixed="right">`,
    `          <template #default="{ row }">`,
    `            <el-button v-permission="'${perm}:edit'" type="primary" link @click="handleEdit(row as ${cls})">`,
    `              <template #icon><i class="bi bi-pencil-square" /></template>`,
    `              编辑`,
    `            </el-button>`,
    `            <el-button v-permission="'${perm}:remove'" type="danger" link @click="handleDelete(row as ${cls})">`,
    `              <template #icon><i class="bi bi-trash" /></template>`,
    `              删除`,
    `            </el-button>`,
    `          </template>`,
    `        </el-table-column>`,
    `      </el-table>`,
    `    </el-card>`,
    ``,
    `    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑' : '新增'" width="520">`,
    `      <el-form ref="formRef" :model="form" label-width="100px">`,
    formItems,
    `      </el-form>`,
    `      <template #footer>`,
    `        <el-button @click="dialogVisible = false">取消</el-button>`,
    `        <el-button type="primary" @click="handleSubmit">确定</el-button>`,
    `      </template>`,
    `    </el-dialog>`,
    `  </div>`,
    `</template>`,
    ``,
  ].join('\n');
}

/**
 * 渲染「字典种子」片段，仅在用到**自定义**字典时生成。
 *
 * 状态类字段用的是内置 `sys_common_status`，无需新建字典；只有用户指定了别的
 * 字典类型时才需要准备。片段供粘贴进 `api/src/seed/dict.seed.ts` 的 `DICT_SEEDS`，
 * 字典项是**占位示例**，需按实际业务替换。
 * @returns 片段文本；无需新建字典时返回 null
 */
function renderDictSeedSnippet(config: GenConfig, columns: GenColumn[]): string | null {
  const custom = usedDictTypes(columns).filter((t) => t !== BUILTIN_STATUS_DICT);
  if (custom.length === 0) {
    return null;
  }
  const nameOfDict = new Map<string, string>();
  for (const c of dictColumns(columns)) {
    if (!nameOfDict.has(c.dictType)) {
      nameOfDict.set(c.dictType, c.columnComment || c.columnName);
    }
  }
  return [
    `/**`,
    ` * 字典种子片段（由代码生成器生成）。`,
    ` *`,
    ` * 用法：把下面数组里的各项合并进 \`api/src/seed/dict.seed.ts\` 的 \`DICT_SEEDS\`，再重启服务`,
    ` *（种子幂等：已存在的类型/项会跳过，不会覆盖界面上改过的内容）。`,
    ` *`,
    ` * ⚠️ 字典项内容是**占位示例**，请按实际业务改成真实的选项与取值。`,
    ` */`,
    `export const GENERATED_DICT_SEEDS = [`,
    ...custom.flatMap((dictType) => [
      `  {`,
      `    dictName: '${nameOfDict.get(dictType) ?? dictType}',`,
      `    dictType: '${dictType}',`,
      `    remark: '${config.businessName} 模块使用',`,
      `    items: [`,
      `      { dictLabel: '待补充', dictValue: '1', sort: 1 },`,
      `      { dictLabel: '待补充', dictValue: '2', sort: 2 },`,
      `    ],`,
      `  },`,
    ]),
    `];`,
    ``,
  ].join('\n');
}

/** 渲染接线说明。 */
function renderReadme(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  const parent = treeParentColumn(config, columns);
  const dictTypes = usedDictTypes(columns);
  const customDictTypes = dictTypes.filter((t) => t !== BUILTIN_STATUS_DICT);
  /** 控件类型的中文名，用于字段清单 */
  const htmlTypeLabel: Record<GenColumn['htmlType'], string> = {
    input: '输入框',
    select: '字典下拉',
    treeSelect: '树形父级',
  };

  // 接线步骤：前 5 步固定，字典与树形按实际情况追加，末尾补一条控件核对
  const stepBodies: string[] = [
    `**注册模型**：\`api/src/models/index.ts\`（自动：import / export / models 数组）`,
    `**挂载路由**：\`api/src/routes/index.ts\`（自动：\`router.use('/${name}', ${name}Routes);\`）`,
    `**菜单与权限码**：\`api/src/seed/menu.seed.ts\`（自动：目录 / MENU 与 4 个按钮节点，权限码依次为 ${perm}:list、:query、:add、:edit、:remove）`,
    `**接口文档 / 操作日志**：\`api/src/docs/catalog.ts\`、\`api/src/middlewares/operationLog.ts\`（自动接线）`,
    `**角色授权**：超管（menuKeys: 'ALL'）自动可见；其它角色请在「系统管理-角色管理-菜单授权」中勾选`,
  ];
  if (customDictTypes.length > 0) {
    stepBodies.push(
      `**字典准备**：本次用到了自定义字典（${customDictTypes.join('、')}），请把 \`backend/seed/dict.seed.snippet.ts\` ` +
        `合并进 \`api/src/seed/dict.seed.ts\` 的 \`DICT_SEEDS\` 后重启服务（种子幂等，已存在的会跳过）`,
    );
  } else if (dictTypes.length > 0) {
    stepBodies.push(`**字典准备**：字典字段用的是内置 \`${BUILTIN_STATUS_DICT}\`，库中已有，无需新建`);
  }
  if (parent) {
    stepBodies.push(
      `**树形表已生成**：列表返回整棵树（不分页，前端无需分页组件）；父级用树形下拉；` +
        `新增/编辑会校验「上级不能是自己或自己的下级」；删除前会校验是否存在下级`,
    );
  }
  stepBodies.push(
    `**控件核对**：如需日期选择、图片上传等控件，请替换对应的 \`el-input\`（见 \`knowledge/开发规范/09-ElementPlus使用.md\`）`,
  );
  const stepLines = stepBodies.map((body, index) => `${index + 1}. ${body}`);

  return [
    `# ${tableComment || config.tableName} 代码生成产物`,
    ``,
    `- 数据表：\`${config.tableName}\``,
    `- 模块名：\`${config.moduleName}\``,
    `- 业务名：\`${config.businessName}\``,
    `- 生成时间：由代码生成器生成`,
    ``,
    `## 目录说明`,
    ``,
    `\`\`\``,
    `backend/models/${cls}.ts              Sequelize 模型`,
    `backend/validators/${name}.validator.ts   zod 校验`,
    `backend/services/${name}.service.ts       业务逻辑`,
    `backend/controllers/${name}.controller.ts 接口层`,
    `backend/routes/${name}.routes.ts          路由（含权限码）`,
    `frontend/api/${name}.ts                   前端接口封装`,
    `frontend/views/${config.moduleName}/${name}/index.vue  前端列表页`,
    ...(customDictTypes.length > 0 ? [`backend/seed/dict.seed.snippet.ts        字典种子片段（需手动合并）`] : []),
    `\`\`\``,
    ``,
    `## 接线步骤（连接线状态）`,
    ``,
    `> 通过「生成到项目」接口（POST /api/gen/create）生成时，以下 1~4 步已由代码生成器**自动完成**；`,
    `> 若通过下载 ZIP 手动落地，请按下列步骤自行接线。`,
    ``,
    ...stepLines,
    ``,
    `## 字段清单`,
    ``,
    ...renderMarkdownTable(
      ['列名', '类型', '驼峰', '控件', '字典', '主键', '可空', '说明'],
      columns.map((c) => [
        c.columnName,
        c.columnType,
        c.fieldName,
        htmlTypeLabel[c.htmlType],
        c.htmlType === 'select' ? c.dictType : '-',
        c.isPk ? '是' : '否',
        c.isNullable ? '是' : '否',
        c.columnComment || '',
      ]),
    ),
    ``,
  ].join('\n');
}

/**
 * 生成全部文件。
 * @param config 生成配置
 * @param columns 字段列表
 * @param tableComment 表注释
 * @returns 文件列表
 */
export function generateFiles(config: GenConfig, columns: GenColumn[], tableComment: string): GenFile[] {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const dictSnippet = renderDictSeedSnippet(config, columns);
  return [
    { path: `backend/models/${cls}.ts`, content: renderModel(config, columns, tableComment) },
    { path: `backend/validators/${name}.validator.ts`, content: renderValidator(config, columns) },
    { path: `backend/services/${name}.service.ts`, content: renderService(config, columns) },
    { path: `backend/controllers/${name}.controller.ts`, content: renderController(config) },
    { path: `backend/routes/${name}.routes.ts`, content: renderRoutes(config) },
    { path: `frontend/api/${name}.ts`, content: renderFrontendApi(config, columns) },
    { path: `frontend/views/${config.moduleName}/${name}/index.vue`, content: renderFrontendView(config, columns) },
    // 仅在用到自定义字典时附带种子片段（状态类字段用内置字典，无需新建）
    ...(dictSnippet ? [{ path: 'backend/seed/dict.seed.snippet.ts', content: dictSnippet }] : []),
    { path: 'README.md', content: renderReadme(config, columns, tableComment) },
  ];
}
