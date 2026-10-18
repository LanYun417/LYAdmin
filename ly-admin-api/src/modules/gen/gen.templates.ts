/**
 * 代码生成模板（NestJS 12 + Prisma 7 + Vue3）。
 * 模块职责：根据表结构渲染出前后端 CRUD 代码文本，后端风格对齐 `modules/dict`，
 * 前端风格对齐 `ly-admin-web/src/api` 与 `views/system/dict`。
 *
 * 生成物是「可直接落地的骨架」，不追求覆盖全部业务细节：
 * - 后端：Prisma model 片段 + NestJS module/controller/service + class-validator DTO；
 * - 前端：API 封装 + 列表页；
 * - 生成的 README 写明接线步骤（同步表结构、注册模块、菜单与权限码）。
 *
 * 约定（与项目现有代码保持一致，勿自创）：
 * - 相对导入带 `.js` 后缀（纯 ESM）；DI 类用值导入；
 * - 自定义提示语返回 `ResponseEnvelope`（`{ __raw: true, data, message }`）；
 * - 分页复用 `common/utils/utils` 的 parsePagination / buildPageResult / readString / readNumber；
 * - 错误用 `AppException.badRequest / notFound / conflict`；权限码 `@RequirePermissions`；
 *   操作日志 `@OperationLog`；通用校验文案复用 `common/utils/validation-messages` 的 MSG。
 */
import type { GenColumn, GenConfig, GenFile } from './gen.service.js';

/** 时间戳类字段：不参与新增/编辑表单（由数据库 / Prisma 默认值维护）。 */
const TIMESTAMP_FIELDS = ['created_at', 'updated_at', 'deleted_at', 'create_time', 'update_time'];

/**
 * 内置「启用 / 禁用」状态字典类型。
 * 与 `gen.service.ts` 的推荐逻辑保持一致（那边是生成期建议值，这边用于决定生成哪种取字典方式）。
 */
const BUILTIN_STATUS_DICT = 'sys_common_status';

/* ------------------------------ 命名工具 ------------------------------ */

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

/* ------------------------------ Prisma 类型映射 ------------------------------ */

/** Prisma 标量类型 + MySQL 原生类型注解。 */
interface PrismaFieldType {
  /** Prisma 标量类型（BigInt / Int / String / DateTime / Decimal / Json / Boolean / Float / Bytes） */
  scalar: string;
  /** 原生类型注解（如 `@db.VarChar(50)`）；无需注解时为空串 */
  native: string;
}

/** 可识别的 MySQL DATA_TYPE 集合（超出该集合的类型会兜底为 String 并提示人工确认）。 */
const KNOWN_DATA_TYPES = new Set([
  'bigint',
  'int',
  'integer',
  'mediumint',
  'smallint',
  'tinyint',
  'float',
  'double',
  'real',
  'decimal',
  'numeric',
  'char',
  'varchar',
  'tinytext',
  'text',
  'mediumtext',
  'longtext',
  'date',
  'datetime',
  'timestamp',
  'time',
  'year',
  'json',
  'bit',
  'bool',
  'boolean',
  'binary',
  'varbinary',
  'blob',
  'tinyblob',
  'mediumblob',
  'longblob',
  'enum',
]);

/** 从 COLUMN_TYPE 中取第一个括号内的数字（如 `varchar(50)` → 50，`datetime(3)` → 3）。 */
function firstLength(columnType: string, fallback: number): number {
  const match = columnType.match(/\((\d+)/);
  return match ? Number(match[1]) : fallback;
}

/** 取 decimal 的精度与标度（如 `decimal(10,2)` → `10, 2`；缺省 `10, 2`）。 */
function decimalArgs(columnType: string): string {
  const match = columnType.match(/\((\d+)\s*,\s*(\d+)\)/);
  return match ? `${match[1]}, ${match[2]}` : '10, 2';
}

/**
 * MySQL 字段 → Prisma 标量类型与原生注解。
 * 未知类型兜底为 `String @db.VarChar(255)`（README 与 manualSteps 会提示人工确认）。
 * @param col 字段
 */
function toPrismaType(col: GenColumn): PrismaFieldType {
  const t = col.dataType.toLowerCase();
  switch (t) {
    case 'bigint':
      return { scalar: 'BigInt', native: '@db.BigInt' };
    case 'int':
    case 'integer':
    case 'mediumint':
      return { scalar: 'Int', native: '@db.Int' };
    case 'smallint':
      return { scalar: 'Int', native: '@db.SmallInt' };
    case 'tinyint':
      return { scalar: 'Int', native: '@db.TinyInt' };
    case 'float':
      return { scalar: 'Float', native: '@db.Float' };
    case 'double':
    case 'real':
      return { scalar: 'Float', native: '@db.Double' };
    case 'decimal':
    case 'numeric':
      return { scalar: 'Decimal', native: `@db.Decimal(${decimalArgs(col.columnType)})` };
    case 'char':
      return { scalar: 'String', native: `@db.Char(${firstLength(col.columnType, 1)})` };
    case 'varchar':
      return { scalar: 'String', native: `@db.VarChar(${firstLength(col.columnType, 255)})` };
    case 'tinytext':
      return { scalar: 'String', native: '@db.TinyText' };
    case 'text':
      return { scalar: 'String', native: '@db.Text' };
    case 'mediumtext':
      return { scalar: 'String', native: '@db.MediumText' };
    case 'longtext':
      return { scalar: 'String', native: '@db.LongText' };
    case 'date':
      return { scalar: 'DateTime', native: '@db.Date' };
    case 'datetime':
      return { scalar: 'DateTime', native: `@db.DateTime(${firstLength(col.columnType, 0)})` };
    case 'timestamp':
      return { scalar: 'DateTime', native: `@db.Timestamp(${firstLength(col.columnType, 0)})` };
    case 'time':
      return { scalar: 'DateTime', native: `@db.Time(${firstLength(col.columnType, 0)})` };
    case 'year':
      return { scalar: 'Int', native: '@db.Year' };
    case 'json':
      return { scalar: 'Json', native: '' };
    case 'bit':
    case 'bool':
    case 'boolean':
      return { scalar: 'Boolean', native: '' };
    case 'binary':
    case 'varbinary':
    case 'blob':
    case 'tinyblob':
    case 'mediumblob':
    case 'longblob':
      return { scalar: 'Bytes', native: '' };
    case 'enum':
      return { scalar: 'String', native: `@db.VarChar(${firstLength(col.columnType, 255)})` };
    default:
      return { scalar: 'String', native: `@db.VarChar(${firstLength(col.columnType, 255)})` };
  }
}

/**
 * 表中无法可靠映射为 Prisma 类型的列名（供 README / manualSteps 提示人工确认）。
 * @param columns 字段列表
 */
export function unknownTypeNames(columns: GenColumn[]): string[] {
  return columns.filter((c) => !KNOWN_DATA_TYPES.has(c.dataType.toLowerCase())).map((c) => c.columnName);
}

/** 该列在 Prisma 侧是否为 BigInt（JS 需转换后才能 JSON 序列化）。 */
function isBigIntColumn(col: GenColumn): boolean {
  return toPrismaType(col).scalar === 'BigInt';
}

/** 数值型标量（用于决定查询走 readNumber 还是 readString）。 */
function isNumericScalar(col: GenColumn): boolean {
  return ['BigInt', 'Int', 'Float', 'Decimal'].includes(toPrismaType(col).scalar);
}

/** 该列可用的字符串长度上限（仅 varchar / char；其它返回 0 表示不生成 MaxLength）。 */
function maxLengthOf(col: GenColumn): number {
  const t = col.dataType.toLowerCase();
  if (t !== 'varchar' && t !== 'char') {
    return 0;
  }
  return firstLength(col.columnType, 255);
}

/** 该列在 Prisma 侧是否为二进制（Bytes）。 */
function isBinaryColumn(col: GenColumn): boolean {
  return toPrismaType(col).scalar === 'Bytes';
}

/** 该列在 Prisma 侧是否为 Json。 */
function isJsonColumn(col: GenColumn): boolean {
  return toPrismaType(col).scalar === 'Json';
}

/**
 * Decimal 列能否安全转成 JS number。
 *
 * IEEE 754 双精度最多精确表示 15~16 位有效十进制位，故声明精度超过 15 位的列转 number 会**静默丢精度**
 * （如 `decimal(20,4)`）。这类列对外一律用字符串承载 —— Prisma 的 Decimal 入参本身就接受 string，
 * 写入方向无需任何转换。
 */
const DECIMAL_SAFE_PRECISION = 15;

/** 见 {@link DECIMAL_SAFE_PRECISION}。 */
function decimalIsSafeNumber(col: GenColumn): boolean {
  if (toPrismaType(col).scalar !== 'Decimal') {
    return true;
  }
  // decimalArgs 形如 '10, 2'，取逗号前的精度部分
  const precision = Number(decimalArgs(col.columnType).split(',')[0]);
  return !Number.isFinite(precision) || precision <= DECIMAL_SAFE_PRECISION;
}

/* ------------------------------ 字段筛选工具 ------------------------------ */

/** 参与新增/编辑的字段（排除主键、时间戳与二进制列——二进制走文件上传，不适合通用表单）。 */
function editableColumns(columns: GenColumn[]): GenColumn[] {
  return columns.filter(
    (c) => !c.isPk && !TIMESTAMP_FIELDS.includes(c.columnName) && toPrismaType(c).scalar !== 'Bytes',
  );
}

/**
 * 参与列表查询的字段（仅字符串与数字，避免过多条件）。
 * @param columns 字段列表
 * @param exclude 需排除的字段名（树形表排除父级字段——在整棵树里按上级筛选语义混乱）
 */
function queryColumns(columns: GenColumn[], exclude: string[] = []): GenColumn[] {
  return editableColumns(columns)
    .filter(
      (c) =>
        (c.tsType === 'string' || c.tsType === 'number') &&
        // Json 列必须排除：字符串模糊查询生成的是 `{ contains }`，而 Prisma 的 JsonFilter 没有
        // contains（会直接编译不过）。需要按 JSON 内容筛选时人工改用 Prisma 的 json 过滤语法。
        !isJsonColumn(c) &&
        !exclude.includes(c.fieldName),
    )
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

/* ------------------------------ 文本排版工具 ------------------------------ */

/**
 * 项目 prettier 的 `printWidth`（见根目录 `.prettierrc.json`）。
 *
 * 生成 `<el-option>` / 具名导入时用它决定写单行还是多行：属性总长随变量名变化，
 * 写死任何一种都会有一半情况与 prettier 的换行策略不符，导致生成物通不过 `prettier --check`。
 */
const PRINT_WIDTH = 120;

/**
 * 计算字符串的显示宽度（中日韩字符按 2 列计）。
 * prettier 格式化 Markdown 表格时按**显示宽度**对齐，生成物必须与之保持一致。
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

/* ------------------------------ 后端模板：Prisma model ------------------------------ */

/** 渲染单个 Prisma 字段（含 `///` 注释、`@map` 与原生命名）。 */
function renderPrismaField(col: GenColumn): string[] {
  const { scalar, native } = toPrismaType(col);
  const field = col.fieldName;
  const comment = col.columnComment ? [`  /// ${col.columnComment}`] : [];

  if (col.isPk) {
    const attrs = [
      '@id',
      '@default(autoincrement())',
      field === col.columnName ? '' : `@map("${col.columnName}")`,
      native,
    ].filter(Boolean);
    return [...comment, `  ${field} ${scalar} ${attrs.join(' ')}`.trimEnd()];
  }

  const attrs: string[] = [];
  if (field !== col.columnName) {
    // 多词字段必须 @map 回 Snake_Case：库里列名全是 snake_case，不映射会造出 camelCase 列
    attrs.push(`@map("${col.columnName}")`);
  }
  if (native) {
    attrs.push(native);
  }
  // 时间戳字段补默认值 / 自动更新，与项目既有模型一致
  const lower = col.columnName.toLowerCase();
  if (scalar === 'DateTime' && !col.isNullable) {
    if (lower === 'created_at' || lower === 'create_time') {
      attrs.push('@default(now())');
    } else if (lower === 'updated_at' || lower === 'update_time') {
      attrs.push('@updatedAt');
    }
  }
  const optional = col.isNullable ? '?' : '';
  return [...comment, `  ${field} ${scalar}${optional} ${attrs.join(' ')}`.trimEnd()];
}

/**
 * 渲染 Prisma model 片段（供追加进 `ly-admin-api/prisma/schema/generated.prisma`）。
 *
 * - 主键：`BigInt @id @default(autoincrement()) @db.BigInt`；
 * - 表名 → PascalCase model 名 + `@@map("原表名")`；
 * - 列名 → camelCase 字段名 + `@map("原列名")`（多词字段必须映射）。
 * @param config 生成配置
 * @param columns 字段列表
 * @param tableComment 表注释
 */
function renderPrismaModel(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const modelName = toPascal(config.tableName);
  return [
    `/// ${tableComment || config.tableName}`,
    `model ${modelName} {`,
    ...columns.flatMap((col) => renderPrismaField(col)),
    ``,
    `  @@map("${config.tableName}")`,
    `}`,
    ``,
  ].join('\n');
}

/* ------------------------------ 后端模板：DTO ------------------------------ */

/** class-validator 导入顺序（字母序，便于稳定输出）。 */
const VALIDATOR_NAMES = [
  'IsBoolean',
  'IsDateString',
  'IsInt',
  'IsNotEmpty',
  'IsNumber',
  'IsNumberString',
  'IsOptional',
  'IsString',
  'MaxLength',
  'Min',
];

/**
 * 对外 DTO 字段类型（BigInt / Decimal → number；Date → Date）。
 *
 * 两处例外：
 * - 超过 {@link DECIMAL_SAFE_PRECISION} 位的 Decimal 用 string 承载（number 会丢精度）；
 * - Json 列统一按 **JSON 字符串** 对外（见 `briefValueOf`），故类型为 string。
 */
function briefTypeOf(col: GenColumn, forceNumber: boolean): string {
  if (forceNumber) {
    return 'number';
  }
  const scalar = toPrismaType(col).scalar;
  let base: string;
  switch (scalar) {
    case 'BigInt':
    case 'Int':
    case 'Float':
      base = 'number';
      break;
    case 'Decimal':
      base = decimalIsSafeNumber(col) ? 'number' : 'string';
      break;
    case 'Boolean':
      base = 'boolean';
      break;
    case 'DateTime':
      base = 'Date';
      break;
    case 'Bytes':
      base = 'Uint8Array';
      break;
    case 'Json':
      base = 'string';
      break;
    default:
      base = 'string';
  }
  // `unknown` 无需（也不该）再拼 `| null`
  return col.isNullable && base !== 'unknown' ? `${base} | null` : base;
}

/** toBrief 入参（Prisma 记录）的字段类型。 */
function rowTypeOf(col: GenColumn): string {
  const scalar = toPrismaType(col).scalar;
  let base: string;
  switch (scalar) {
    case 'BigInt':
      base = 'bigint';
      break;
    case 'Int':
    case 'Float':
      base = 'number';
      break;
    case 'Boolean':
      base = 'boolean';
      break;
    case 'DateTime':
      base = 'Date';
      break;
    case 'Bytes':
      base = 'Uint8Array';
      break;
    case 'Json':
    case 'Decimal':
      base = 'unknown';
      break;
    default:
      base = 'string';
  }
  // `unknown` 无需（也不该）再拼 `| null`
  return col.isNullable && base !== 'unknown' ? `${base} | null` : base;
}

/**
 * toBrief 取值表达式。
 *
 * - BigInt：转 number（避免 JSON 序列化失败；主键为自增，不会超出安全整数范围）；
 * - Decimal：安全精度内转 number，否则 `String()` 保留全部有效位；
 * - Json：统一压平为 JSON 字符串（库里已是对象时 `JSON.stringify`，避免前端显示成 `[object Object]`）。
 */
function briefValueOf(col: GenColumn, forceNumber: boolean): string {
  const scalar = toPrismaType(col).scalar;
  if (forceNumber) {
    return `Number(row.${col.fieldName} ?? 0)`;
  }
  const nullSafe = (expr: string): string => (col.isNullable ? `row.${col.fieldName} === null ? null : ${expr}` : expr);

  if (scalar === 'BigInt') {
    return nullSafe(`Number(row.${col.fieldName})`);
  }
  if (scalar === 'Decimal') {
    return decimalIsSafeNumber(col)
      ? nullSafe(`Number(row.${col.fieldName})`)
      : nullSafe(`String(row.${col.fieldName})`);
  }
  if (scalar === 'Json') {
    return nullSafe(
      `typeof row.${col.fieldName} === 'string' ? row.${col.fieldName} : JSON.stringify(row.${col.fieldName})`,
    );
  }
  return `row.${col.fieldName}`;
}

/** DTO 字段的 TS 类型（须与 {@link briefTypeOf} 保持一致，否则同一字段读写类型不一致）。 */
function dtoTypeOf(col: GenColumn): string {
  const scalar = toPrismaType(col).scalar;
  switch (scalar) {
    case 'BigInt':
    case 'Int':
    case 'Float':
      return 'number';
    case 'Decimal':
      // 与对外类型一致：安全精度内为 number，超出则用字符串承载（避免往返丢精度）
      return decimalIsSafeNumber(col) ? 'number' : 'string';
    case 'Boolean':
      return 'boolean';
    default:
      // DateTime 用 ISO 字符串（Prisma 直接接受）；String / Json 用 string
      return 'string';
  }
}

/**
 * 渲染单个 DTO 字段（含校验装饰器）。
 * @param col 字段
 * @param mode create 必填按列可空性判定；update / query 一律可选
 * @param isParent 是否为树形父级字段（给 0 默认值语义）
 */
function renderDtoField(col: GenColumn, mode: 'create' | 'update' | 'query', isParent: boolean): string {
  const scalar = toPrismaType(col).scalar;
  const required = mode === 'create' && !col.isNullable && !isParent;
  const comment = col.columnComment || col.fieldName;
  const decorators: string[] = [];
  if (!required) {
    decorators.push('@IsOptional()');
  }

  if (isParent) {
    decorators.push('@IsInt({ message: MSG.isInt })', '@Min(0, { message: MSG.min(0) })');
  } else {
    switch (scalar) {
      case 'BigInt':
      case 'Int':
        decorators.push('@IsInt({ message: MSG.isInt })');
        break;
      case 'Float':
        decorators.push("@IsNumber({}, { message: '必须为数字' })");
        break;
      case 'Decimal':
        // 高精度小数以字符串传输（见 decimalIsSafeNumber），故校验的是「数字字符串」
        decorators.push(
          decimalIsSafeNumber(col)
            ? "@IsNumber({}, { message: '必须为数字' })"
            : "@IsNumberString({}, { message: '必须为数字' })",
        );
        break;
      case 'Boolean':
        decorators.push('@IsBoolean({ message: MSG.isBoolean })');
        break;
      case 'DateTime':
        decorators.push("@IsDateString({ message: '日期格式不正确' })");
        break;
      case 'Json':
        // Json 列按 JSON 字符串存取（与 briefTypeOf 的 string 一致）：非字符串直接拒绝，
        // 避免 body 里传对象时被隐式转换成 `[object Object]` 再入库
        decorators.push('@IsString({ message: MSG.isString })');
        break;
      default: {
        decorators.push('@IsString({ message: MSG.isString })', '@Transform(trim)');
        if (required) {
          decorators.push(`@IsNotEmpty({ message: '${comment}不能为空' })`);
        }
        const maxLength = maxLengthOf(col);
        if (maxLength > 0) {
          decorators.push(`@MaxLength(${maxLength}, { message: MSG.maxLength(${maxLength}) })`);
        }
        break;
      }
    }
  }

  return [
    `  /** ${comment} */`,
    ...decorators.map((item) => `  ${item}`),
    `  ${col.fieldName}${required ? '!' : '?'}: ${dtoTypeOf(col)};`,
  ].join('\n');
}

/** 渲染分页参数 DTO 字段。 */
function renderPaginationField(field: 'page' | 'pageSize'): string {
  const comment = field === 'page' ? '页码' : '每页条数';
  return [
    `  /** ${comment} */`,
    '  @IsOptional()',
    '  @IsInt({ message: MSG.isInt })',
    '  @Min(1, { message: MSG.min(1) })',
    `  ${field}?: number;`,
  ].join('\n');
}

/**
 * 渲染 class-validator DTO（Create / Update / Query / IdParam）。
 * @param config 生成配置
 * @param columns 字段列表
 */
function renderNestDto(config: GenConfig, columns: GenColumn[]): string {
  const cls = toPascal(config.businessName);
  const parent = treeParentColumn(config, columns);
  const parentField = parent?.fieldName ?? '';
  const editable = editableColumns(columns);
  const query = queryColumns(columns, parentField ? [parentField] : []);
  const isParentCol = (c: GenColumn): boolean => c.fieldName === parentField;

  const createBody = editable.map((c) => renderDtoField(c, 'create', isParentCol(c))).join('\n\n');
  const updateBody = editable.map((c) => renderDtoField(c, 'update', isParentCol(c))).join('\n\n');
  const queryBody = [
    ...(config.isTree ? [] : [renderPaginationField('page'), renderPaginationField('pageSize')]),
    ...query.map((c) => renderDtoField(c, 'query', false)),
  ].join('\n\n');
  const idParamBody = [
    '  /** 主键 */',
    '  @IsInt({ message: MSG.isInt })',
    '  @Min(1, { message: MSG.min(1) })',
    '  id!: number;',
  ].join('\n');

  // 按实际用到的装饰器收敛 import，避免生成物出现未使用导入
  const allText = [createBody, updateBody, queryBody, idParamBody].join('\n');
  const validators = VALIDATOR_NAMES.filter((name) => allText.includes(`${name}(`));
  const usesTransform = allText.includes('Transform(');

  return [
    `/**`,
    ` * ${config.businessName} 模块 DTO（class-validator）。`,
    ` * 模块职责：${config.businessName}的新增、编辑、查询与主键参数校验（由代码生成器生成）。`,
    ` * 说明：查询参数走独立 DTO；通用文案复用 common/utils/validation-messages 的 MSG。`,
    ` */`,
    renderNamedImport(validators, 'class-validator'),
    ...(usesTransform ? [`import { Transform } from 'class-transformer';`] : []),
    `import { MSG } from '../../../common/utils/validation-messages.js';`,
    ``,
    `/** 去除首尾空白（对字符串入参统一处理）。 */`,
    `const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);`,
    ``,
    `/** 新增。 */`,
    `export class Create${cls}Dto {`,
    createBody || `  // 无可用字段`,
    `}`,
    ``,
    `/** 编辑。 */`,
    `export class Update${cls}Dto {`,
    updateBody || `  // 无可用字段`,
    `}`,
    ``,
    `/** 查询。 */`,
    `export class Query${cls}Dto {`,
    queryBody || `  // 无可用查询字段`,
    `}`,
    ``,
    `/** 主键参数。 */`,
    `export class IdParamDto {`,
    idParamBody,
    `}`,
    ``,
  ].join('\n');
}

/* ------------------------------ 后端模板：Service ------------------------------ */

/** 新增时的 Prisma data 取值表达式。 */
function createDataExpr(col: GenColumn, isParent: boolean): string {
  const scalar = toPrismaType(col).scalar;
  if (isParent) {
    return scalar === 'BigInt' ? `BigInt(dto.${col.fieldName} ?? 0)` : `dto.${col.fieldName} ?? 0`;
  }
  if (scalar === 'BigInt') {
    return col.isNullable
      ? `dto.${col.fieldName} == null ? null : BigInt(dto.${col.fieldName})`
      : `BigInt(dto.${col.fieldName})`;
  }
  // Json 列：可空时用 undefined 缺省（Prisma 可空 Json 不接受裸 null，需 DbNull/JsonNull）
  if (scalar === 'Json') {
    return `dto.${col.fieldName}`;
  }
  return col.isNullable ? `dto.${col.fieldName} ?? null` : `dto.${col.fieldName}`;
}

/** 编辑时的 Prisma data 取值表达式（undefined 表示跳过该字段）。 */
function updateDataExpr(col: GenColumn): string {
  const scalar = toPrismaType(col).scalar;
  if (scalar === 'BigInt') {
    return `dto.${col.fieldName} === undefined ? undefined : BigInt(dto.${col.fieldName})`;
  }
  return `dto.${col.fieldName}`;
}

/**
 * 渲染 NestJS service（Prisma CRUD + 分页 / 树形查询）。
 * @param config 生成配置
 * @param columns 字段列表
 * @param cnName 中文模块名（取表注释，缺失时回退模块名）
 */
function renderNestService(config: GenConfig, columns: GenColumn[], cnName: string): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const accessor = toCamel(config.tableName);
  const pk = columns.find((c) => c.isPk);
  const pkField = pk?.fieldName ?? 'id';
  const idArg = pk && isBigIntColumn(pk) ? 'BigInt(id)' : 'id';
  const parent = treeParentColumn(config, columns);
  const parentField = parent?.fieldName ?? '';
  const parentBigInt = parent ? isBigIntColumn(parent) : false;
  const parentArg = (expr: string): string => (parentBigInt ? `BigInt(${expr})` : expr);

  /**
   * 二进制列（Bytes）不进响应体，也不参与通用表单：
   * Prisma 的 Bytes 会被 JSON 序列化成 `{"0":137,"1":80,...}` 的字节下标对象（既没用又会撑爆响应），
   * 而且查询时不排除的话会把整个 blob 读进内存。内容一律走文件上传（见 sys_file）。
   */
  const binaryColumns = columns.filter((col) => isBinaryColumn(col));
  /** 参与 toBrief / 查询的列（排除二进制列）。 */
  const briefColumns = columns.filter((col) => !isBinaryColumn(col));

  const query = queryColumns(columns, parentField ? [parentField] : []);
  const editable = editableColumns(columns);
  const parentKey = 'parentId';
  const needsSyntheticParent = parent !== null && parentField !== parentKey;

  // brief 字段（树形表补充 buildTree 所需的 parentId）
  const briefFields = [
    ...briefColumns.map((col) => ({
      field: col.fieldName,
      type: briefTypeOf(col, parentField !== '' && col.fieldName === parentField),
      value: briefValueOf(col, parentField !== '' && col.fieldName === parentField),
    })),
    ...(needsSyntheticParent
      ? [{ field: parentKey, type: 'number', value: briefValueOf(parent as GenColumn, true) }]
      : []),
  ];

  const rowShape = [
    '  private toBrief(row: {',
    ...briefColumns.map((col) => `    ${col.fieldName}: ${rowTypeOf(col)};`),
    '  }): ' + `${cls}Brief {`,
  ];

  const briefBlock = [
    `/** 对外 DTO（BigInt / Decimal 转 number，便于 JSON 序列化）。 */`,
    `export interface ${cls}Brief {`,
    ...briefFields.map((item) => `  ${item.field}: ${item.type};`),
    `}`,
  ];

  const toBriefBlock = [
    `  /** Prisma 记录 → 对外 DTO（BigInt / Decimal 转 number）。 */`,
    ...rowShape,
    `    return {`,
    ...briefFields.map((item) => `      ${item.field}: ${item.value},`),
    `    };`,
    `  }`,
  ];

  // 查询条件（按字段类型生成 where 片段）
  const usesReadString = query.some((c) => !isNumericScalar(c));
  const usesReadNumber = query.some((c) => isNumericScalar(c));
  const whereLines = query.flatMap((c) => {
    if (isNumericScalar(c)) {
      return [`    const ${c.fieldName} = readNumber(params.${c.fieldName});`];
    }
    return [`    const ${c.fieldName} = readString(params.${c.fieldName});`];
  });
  const whereEntries = query.map((c) =>
    isNumericScalar(c)
      ? `      ...(${c.fieldName} !== undefined ? { ${c.fieldName} } : {}),`
      : `      ...(${c.fieldName} ? { ${c.fieldName}: { contains: ${c.fieldName} } } : {}),`,
  );
  const whereBlock = query.length > 0 ? [`    const where = {`, ...whereEntries, `    };`] : [`    const where = {};`];

  /** 有二进制列时：类外声明 omit 常量（Prisma 的 omit 让这些列不出现在查询结果里）。 */
  const omitBlock =
    binaryColumns.length > 0
      ? [
          `/** 二进制列不参与查询：避免把 blob 读进内存，也不会出现在响应体里（Prisma omit）。 */`,
          `const OMIT_BINARY = { ${binaryColumns.map((col) => `${col.fieldName}: true`).join(', ')} } as const;`,
          ``,
        ]
      : [];
  /** 查询参数里的 omit 片段（无二进制列时为空数组，保证无 blob 的表生成物不变）。 */
  const omitArg = binaryColumns.length > 0 ? [`      omit: OMIT_BINARY,`] : [];

  const listBlock = parent
    ? [
        `  /**`,
        `   * 查询${cnName}（返回整棵树，不做分页）。`,
        `   * @param query 查询参数`,
        `   */`,
        `  async list(query: Query${cls}Dto): Promise<WithChildren<${cls}Brief>[]> {`,
        ...(query.length > 0 ? [`    const params: Record<string, unknown> = { ...query };`] : []),
        ...whereLines,
        ...whereBlock,
        ...(omitArg.length > 0
          ? [
              `    const rows = await this.prisma.${accessor}.findMany({`,
              `      where,`,
              `      orderBy: { ${pkField}: 'asc' },`,
              ...omitArg,
              `    });`,
            ]
          : [`    const rows = await this.prisma.${accessor}.findMany({ where, orderBy: { ${pkField}: 'asc' } });`]),
        `    return buildTree(rows.map((row) => this.toBrief(row)));`,
        `  }`,
      ]
    : [
        `  /**`,
        `   * 分页查询${cnName}。`,
        `   * @param query 查询参数`,
        `   */`,
        `  async list(query: Query${cls}Dto): Promise<PageResult<${cls}Brief>> {`,
        `    const params: Record<string, unknown> = { ...query };`,
        `    const { page, pageSize, offset, limit } = parsePagination(params);`,
        ...whereLines,
        ...whereBlock,
        `    const rows = await this.prisma.${accessor}.findMany({`,
        `      where,`,
        `      orderBy: { ${pkField}: 'desc' },`,
        `      skip: offset,`,
        `      take: limit,`,
        ...omitArg,
        `    });`,
        `    const count = await this.prisma.${accessor}.count({ where });`,
        `    return buildPageResult(`,
        `      rows.map((row) => this.toBrief(row)),`,
        `      count,`,
        `      page,`,
        `      pageSize,`,
        `    );`,
        `  }`,
      ];

  const treeHelpers = parent
    ? [
        ``,
        `  /** 收集指定节点的全部后代 id（防止把上级挂到自己的子树下）。 */`,
        `  private async collectDescendantIds(id: number): Promise<number[]> {`,
        `    const result: number[] = [];`,
        `    let level = [${parentArg('id')}];`,
        `    while (level.length > 0) {`,
        `      const children = await this.prisma.${accessor}.findMany({`,
        `        where: { ${parentField}: { in: level } },`,
        `        select: { ${pkField}: true },`,
        `      });`,
        `      const next = children.map((child) => Number(child.${pkField}));`,
        `      if (next.length === 0) {`,
        `        break;`,
        `      }`,
        `      result.push(...next);`,
        `      level = next.map((childId) => ${parentArg('childId')});`,
        `    }`,
        `    return result;`,
        `  }`,
        ``,
        `  /**`,
        `   * 校验父级合法性：不能选自己，也不能选自己的后代，否则树会成环。`,
        `   * @param parentId 待设置的父级 id（0 表示根节点）`,
        `   * @param selfId 当前节点 id（新增时不传）`,
        `   */`,
        `  private async assertParentValid(parentId: number, selfId?: number): Promise<void> {`,
        `    if (parentId === 0 || selfId === undefined) {`,
        `      return;`,
        `    }`,
        `    if (parentId === selfId) {`,
        `      throw AppException.badRequest('上级不能是自己');`,
        `    }`,
        `    const descendants = await this.collectDescendantIds(selfId);`,
        `    if (descendants.includes(parentId)) {`,
        `      throw AppException.badRequest('上级不能是自己的下级');`,
        `    }`,
        `  }`,
      ]
    : [];

  const utilsNames = parent
    ? ['buildTree', ...(usesReadNumber ? ['readNumber'] : []), ...(usesReadString ? ['readString'] : [])]
    : [
        'buildPageResult',
        'parsePagination',
        ...(usesReadNumber ? ['readNumber'] : []),
        ...(usesReadString ? ['readString'] : []),
      ];

  return [
    `/**`,
    ` * ${config.businessName} 服务。`,
    ` * 模块职责：${parent ? '树形查询' : '分页查询'}与 CRUD（由代码生成器生成）。`,
    ` */`,
    `import { Injectable } from '@nestjs/common';`,
    `import { AppException } from '../../common/exception/app.exception.js';`,
    renderNamedImport(utilsNames, '../../common/utils/utils.js'),
    `import { PrismaService } from '../../prisma/prisma.service.js';`,
    `import type { ${parent ? 'WithChildren' : 'PageResult'} } from '../../common/types.js';`,
    `import type { Create${cls}Dto, Query${cls}Dto, Update${cls}Dto } from './dto/${name}.dto.js';`,
    ``,
    ...briefBlock,
    ``,
    ...omitBlock,
    `@Injectable()`,
    `export class ${cls}Service {`,
    `  constructor(private readonly prisma: PrismaService) {}`,
    ``,
    ...toBriefBlock,
    ``,
    ...listBlock,
    ``,
    `  /**`,
    `   * 查询${cnName}详情。`,
    `   * @param id 主键`,
    `   */`,
    `  async detail(id: number): Promise<${cls}Brief> {`,
    ...(omitArg.length > 0
      ? [
          `    const row = await this.prisma.${accessor}.findUnique({`,
          `      where: { ${pkField}: ${idArg} },`,
          ...omitArg,
          `    });`,
        ]
      : [`    const row = await this.prisma.${accessor}.findUnique({ where: { ${pkField}: ${idArg} } });`]),
    `    if (!row) {`,
    `      throw AppException.notFound('记录不存在');`,
    `    }`,
    `    return this.toBrief(row);`,
    `  }`,
    ``,
    `  /**`,
    `   * 新增${cnName}。`,
    `   * @param dto 新增参数`,
    `   */`,
    `  async create(dto: Create${cls}Dto): Promise<${cls}Brief> {`,
    ...(parent ? [`    await this.assertParentValid(dto.${parentField} ?? 0);`] : []),
    `    const row = await this.prisma.${accessor}.create({`,
    `      data: {`,
    ...editable.map((c) => `        ${c.fieldName}: ${createDataExpr(c, c.fieldName === parentField)},`),
    `      },`,
    ...omitArg,
    `    });`,
    `    return this.toBrief(row);`,
    `  }`,
    ``,
    `  /**`,
    `   * 编辑${cnName}。`,
    `   * @param id 主键`,
    `   * @param dto 编辑参数`,
    `   */`,
    `  async update(id: number, dto: Update${cls}Dto): Promise<${cls}Brief> {`,
    `    const existing = await this.prisma.${accessor}.findUnique({ where: { ${pkField}: ${idArg} } });`,
    `    if (!existing) {`,
    `      throw AppException.notFound('记录不存在');`,
    `    }`,
    ...(parent ? [`    await this.assertParentValid(dto.${parentField} ?? 0, id);`] : []),
    `    const row = await this.prisma.${accessor}.update({`,
    `      where: { ${pkField}: ${idArg} },`,
    `      data: {`,
    ...editable.map((c) => `        ${c.fieldName}: ${updateDataExpr(c)},`),
    `      },`,
    ...omitArg,
    `    });`,
    `    return this.toBrief(row);`,
    `  }`,
    ``,
    `  /**`,
    `   * 删除${cnName}。`,
    `   * @param id 主键`,
    `   */`,
    `  async remove(id: number): Promise<void> {`,
    `    const existing = await this.prisma.${accessor}.findUnique({ where: { ${pkField}: ${idArg} } });`,
    `    if (!existing) {`,
    `      throw AppException.notFound('记录不存在');`,
    `    }`,
    ...(parent
      ? [
          `    const childCount = await this.prisma.${accessor}.count({ where: { ${parentField}: ${parentArg('id')} } });`,
          `    if (childCount > 0) {`,
          `      throw AppException.conflict('存在下级节点，请先删除下级');`,
          `    }`,
        ]
      : []),
    `    await this.prisma.${accessor}.delete({ where: { ${pkField}: ${idArg} } });`,
    `  }`,
    ...treeHelpers,
    `}`,
    ``,
  ].join('\n');
}

/* ------------------------------ 后端模板：Controller ------------------------------ */

/**
 * 渲染 NestJS controller（路由 + 权限码 + 操作日志）。
 * @param config 生成配置
 * @param columns 字段列表
 * @param cnName 中文模块名（取表注释，缺失时回退模块名）
 */
function renderNestController(config: GenConfig, columns: GenColumn[], cnName: string): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  const isTree = treeParentColumn(config, columns) !== null;

  return [
    `/**`,
    ` * ${config.businessName} 控制器。`,
    ` * 模块职责：解析请求参数、调用服务、组装统一响应（由代码生成器生成）。`,
    ` */`,
    `import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';`,
    `import { OperationLog } from '../../common/log/operation-log.decorator.js';`,
    `import { RequirePermissions } from '../../common/auth/permission.guard.js';`,
    `import type { ResponseEnvelope } from '../../common/http/response.interceptor.js';`,
    `import { ${cls}Service } from './${name}.service.js';`,
    `import { Create${cls}Dto, IdParamDto, Query${cls}Dto, Update${cls}Dto } from './dto/${name}.dto.js';`,
    ``,
    `@Controller('${name}')`,
    `export class ${cls}Controller {`,
    `  constructor(private readonly ${name}Service: ${cls}Service) {}`,
    ``,
    `  /** ${isTree ? '查询整棵树（不分页）。' : '分页查询。'} */`,
    `  @Get()`,
    `  @RequirePermissions('${perm}:list')`,
    `  list(@Query() query: Query${cls}Dto): Promise<unknown> {`,
    `    return this.${name}Service.list(query);`,
    `  }`,
    ``,
    `  /** 详情。 */`,
    `  @Get(':id')`,
    `  @RequirePermissions('${perm}:query')`,
    `  detail(@Param() params: IdParamDto): Promise<unknown> {`,
    `    return this.${name}Service.detail(params.id);`,
    `  }`,
    ``,
    `  /** 新增。 */`,
    `  @Post()`,
    `  @RequirePermissions('${perm}:add')`,
    `  @OperationLog('${cnName}', '新增')`,
    `  async create(@Body() dto: Create${cls}Dto): Promise<ResponseEnvelope<unknown>> {`,
    `    const data = await this.${name}Service.create(dto);`,
    `    return { __raw: true, data, message: '新增成功' };`,
    `  }`,
    ``,
    `  /** 编辑。 */`,
    `  @Put(':id')`,
    `  @RequirePermissions('${perm}:edit')`,
    `  @OperationLog('${cnName}', '编辑')`,
    `  async update(@Param() params: IdParamDto, @Body() dto: Update${cls}Dto): Promise<ResponseEnvelope<unknown>> {`,
    `    const data = await this.${name}Service.update(params.id, dto);`,
    `    return { __raw: true, data, message: '修改成功' };`,
    `  }`,
    ``,
    `  /** 删除。 */`,
    `  @Delete(':id')`,
    `  @RequirePermissions('${perm}:remove')`,
    `  @OperationLog('${cnName}', '删除')`,
    `  async remove(@Param() params: IdParamDto): Promise<ResponseEnvelope<unknown>> {`,
    `    await this.${name}Service.remove(params.id);`,
    `    return { __raw: true, data: null, message: '删除成功' };`,
    `  }`,
    `}`,
    ``,
  ].join('\n');
}

/* ------------------------------ 后端模板：Module ------------------------------ */

/**
 * 渲染 NestJS module。
 * @param config 生成配置
 */
function renderNestModule(config: GenConfig): string {
  const cls = toPascal(config.businessName);
  const name = toCamel(config.businessName);
  return [
    `/**`,
    ` * ${config.businessName} 模块。`,
    ` * 模块职责：装配${config.businessName}的控制器与服务（PrismaService 由全局 PrismaModule 提供）。`,
    ` */`,
    `import { Module } from '@nestjs/common';`,
    `import { ${cls}Controller } from './${name}.controller.js';`,
    `import { ${cls}Service } from './${name}.service.js';`,
    ``,
    `@Module({`,
    `  controllers: [${cls}Controller],`,
    `  providers: [${cls}Service],`,
    `})`,
    `export class ${cls}Module {}`,
    ``,
  ].join('\n');
}

/* ------------------------------ 前端模板：API ------------------------------ */

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

/* ------------------------------ 前端模板：页面 ------------------------------ */

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
      ].join('\n');
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
      ].join('\n');
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

/* ------------------------------ 字典种子片段 ------------------------------ */

/**
 * 渲染「字典种子」片段，仅在用到**自定义**字典时生成。
 *
 * 状态类字段用的是内置 `sys_common_status`，无需新建字典；只有用户指定了别的
 * 字典类型时才需要准备。片段供合并进 `ly-admin-api/prisma/seed.ts`（或 `src/prisma/seed.service.ts`）
 * 的字典种子数组，字典项是**占位示例**，需按实际业务替换。
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
    ` * 用法：把下面数组里的各项合并进 \`ly-admin-api/prisma/seed.ts\` 的字典种子（DICT_SEEDS），再重启服务`,
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

/* ------------------------------ 接线说明 ------------------------------ */

/**
 * 渲染接线说明（README，不落盘）。
 * @param config 生成配置
 * @param columns 字段列表
 * @param tableComment 表注释
 */
function renderReadme(config: GenConfig, columns: GenColumn[], tableComment: string): string {
  const name = toCamel(config.businessName);
  const perm = `${config.moduleName}:${name}`;
  const parent = treeParentColumn(config, columns);
  const dictTypes = usedDictTypes(columns);
  const customDictTypes = dictTypes.filter((t) => t !== BUILTIN_STATUS_DICT);
  const unknownTypes = unknownTypeNames(columns);
  /** 二进制列：已从响应体与通用表单排除，需人工走文件上传。 */
  const binaryCols = columns.filter((col) => isBinaryColumn(col));
  /** 超出安全精度的小数列：对外按字符串传输。 */
  const highPrecisionDecimals = columns.filter(
    (col) => toPrismaType(col).scalar === 'Decimal' && !decimalIsSafeNumber(col),
  );
  /** Json 列：按 JSON 字符串存取。 */
  const jsonCols = columns.filter((col) => isJsonColumn(col));
  /** 控件类型的中文名，用于字段清单 */
  const htmlTypeLabel: Record<GenColumn['htmlType'], string> = {
    input: '输入框',
    select: '字典下拉',
    treeSelect: '树形父级',
  };

  // 接线步骤：前 3 步固定，字典 / 树形 / 未知类型按实际情况追加，末尾补一条控件核对
  const stepBodies: string[] = [
    `**同步表结构**：把 \`backend/prisma/${config.tableName}.model.prisma\` 的 model 追加进 \`ly-admin-api/prisma/schema/generated.prisma\` ` +
      `（用「生成到项目」时已自动插入 \`[GEN-ANCHOR]\` 锚点之前），然后执行 \`npm run prisma:push\``,
    `**注册模块**：\`ly-admin-api/src/app.module.ts\`（自动：import 与 \`imports\` 数组加入 \`${toPascal(config.businessName)}Module\`）`,
    `**菜单与权限码**：\`ly-admin-api/src/prisma/seed.service.ts\`（自动：目录 / MENU 与 4 个按钮节点，权限码依次为 ${perm}:list、:query、:add、:edit、:remove）；重启服务即自动幂等种子`,
    `**角色授权**：超管（menuKeys: 'ALL'）自动可见；其它角色请在「系统管理-角色管理-菜单授权」中勾选`,
    `**前端路由**：无需手改（路由由菜单动态生成，页面已落到 \`frontend/views/${config.moduleName}/${name}/index.vue\`）`,
  ];
  if (customDictTypes.length > 0) {
    stepBodies.push(
      `**字典准备**：本次用到了自定义字典（${customDictTypes.join('、')}），请把 \`backend/seed/dict.seed.snippet.ts\` ` +
        `合并进 \`ly-admin-api/prisma/seed.ts\` 的字典种子后重启服务（种子幂等，已存在的会跳过）`,
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
  if (unknownTypes.length > 0) {
    stepBodies.push(
      `**⚠️ 类型核对**：以下列的 MySQL 类型无法可靠映射为 Prisma 类型，已兜底为 \`String @db.VarChar(255)\`，` +
        `请人工确认并修正：${unknownTypes.join('、')}`,
    );
  }
  if (binaryCols.length > 0) {
    stepBodies.push(
      `**⚠️ 二进制列已排除**：${binaryCols.map((col) => col.columnName).join('、')} 为 blob / binary 类型，` +
        `已从列表与详情响应、通用表单中排除（查询走 Prisma \`omit\`，不会把内容读进内存）——` +
        `否则会被 JSON 序列化成 \`{"0":137,"1":80,…}\` 的字节下标对象。` +
        `如需在页面展示或上传，请参考文件管理（sys_file）用独立的上传/下载接口；` +
        `若该列是 NOT NULL 且无默认值，新增前需人工补默认值或改由上传流程写入`,
    );
  }
  if (highPrecisionDecimals.length > 0) {
    stepBodies.push(
      `**高精度小数按字符串传输**：${highPrecisionDecimals.map((col) => col.columnName).join('、')} 的声明精度超过 15 位，` +
        `对外统一用字符串承载（JS number 只能精确表示约 15~16 位有效数字，直接转会静默丢精度）；` +
        `写入方向 Prisma 的 Decimal 入参本身接受字符串，无需转换`,
    );
  }
  if (jsonCols.length > 0) {
    stepBodies.push(
      `**Json 列按 JSON 字符串存取**：${jsonCols.map((col) => col.columnName).join('、')} 在通用表单里是普通输入框，` +
        `库中存储的是 JSON 字符串（读出来同样是字符串，往返一致）。` +
        `如需结构化编辑或格式校验，请自行替换为 JSON 编辑器控件并在提交前校验合法性`,
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
    `backend/modules/${name}/${name}.module.ts        NestJS 模块`,
    `backend/modules/${name}/${name}.controller.ts    控制器（路由 + 权限码 + 操作日志）`,
    `backend/modules/${name}/${name}.service.ts       服务（Prisma CRUD + 分页）`,
    `backend/modules/${name}/dto/${name}.dto.ts       class-validator DTO`,
    `backend/prisma/${config.tableName}.model.prisma  Prisma model 片段（需同步进 schema/generated.prisma）`,
    `frontend/api/${name}.ts                          前端接口封装`,
    `frontend/views/${config.moduleName}/${name}/index.vue  前端列表页`,
    ...(customDictTypes.length > 0 ? [`backend/seed/dict.seed.snippet.ts             字典种子片段（需手动合并）`] : []),
    `\`\`\``,
    ``,
    `## 接线步骤（连接线状态）`,
    ``,
    `> 通过「生成到项目」接口（POST /api/gen/create）生成时，步骤 1~3 已由代码生成器**自动完成**；`,
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

/* ------------------------------ 产物清单 ------------------------------ */

/**
 * 生成全部文件。
 * @param config 生成配置
 * @param columns 字段列表
 * @param tableComment 表注释
 * @returns 文件列表
 */
export function generateFiles(config: GenConfig, columns: GenColumn[], tableComment: string): GenFile[] {
  const name = toCamel(config.businessName);
  const cnName = (tableComment || '').trim() || config.moduleName;
  const dictSnippet = renderDictSeedSnippet(config, columns);
  return [
    { path: `backend/modules/${name}/${name}.module.ts`, content: renderNestModule(config) },
    { path: `backend/modules/${name}/${name}.controller.ts`, content: renderNestController(config, columns, cnName) },
    { path: `backend/modules/${name}/${name}.service.ts`, content: renderNestService(config, columns, cnName) },
    { path: `backend/modules/${name}/dto/${name}.dto.ts`, content: renderNestDto(config, columns) },
    {
      path: `backend/prisma/${config.tableName}.model.prisma`,
      content: renderPrismaModel(config, columns, tableComment),
    },
    { path: `frontend/api/${name}.ts`, content: renderFrontendApi(config, columns) },
    { path: `frontend/views/${config.moduleName}/${name}/index.vue`, content: renderFrontendView(config, columns) },
    // 仅在用到自定义字典时附带种子片段（状态类字段用内置字典，无需新建）
    ...(dictSnippet ? [{ path: 'backend/seed/dict.seed.snippet.ts', content: dictSnippet }] : []),
    { path: 'README.md', content: renderReadme(config, columns, tableComment) },
  ];
}
