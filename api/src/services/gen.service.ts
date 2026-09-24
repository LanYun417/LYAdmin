/**
 * 代码生成服务。
 * 模块职责：读取数据库表结构，按项目规范生成前后端 CRUD 代码，并打包为 ZIP（零第三方依赖）。
 *
 * 安全约束：表名必须与 information_schema 中真实存在的表匹配，模块名/业务名只允许
 * 字母数字（业务名会拼进生成物路径，必须挡住路径穿越）。
 */
import { QueryTypes } from 'sequelize';
import { sequelize } from '@/config/database';
import { AppError } from '@/utils/response';
import { createZip, type ZipEntry } from '@/utils/zip';
import { generateFiles, toCamel, toPascal, toTsType } from './gen.templates';

/** 表概要。 */
export interface GenTableItem {
  tableName: string;
  tableComment: string;
  engine: string;
  createTime: string;
}

/** 字段信息。 */
export interface GenColumn {
  columnName: string;
  fieldName: string;
  columnType: string;
  dataType: string;
  tsType: 'string' | 'number' | 'boolean' | 'Date';
  columnComment: string;
  isPk: boolean;
  isNullable: boolean;
}

/** 表结构详情。 */
export interface GenTableDetail {
  tableName: string;
  tableComment: string;
  columns: GenColumn[];
}

/** 生成配置。 */
export interface GenConfig {
  tableName: string;
  moduleName: string;
  businessName: string;
  author?: string;
}

/** 生成的文件。 */
export interface GenFile {
  path: string;
  content: string;
}

/** information_schema.TABLES 原始行。 */
interface TableRow {
  TABLE_NAME: string;
  TABLE_COMMENT: string | null;
  ENGINE: string | null;
  CREATE_TIME: Date | string | null;
}

/** information_schema.COLUMNS 原始行。 */
interface ColumnRow {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  DATA_TYPE: string;
  COLUMN_COMMENT: string | null;
  COLUMN_KEY: string | null;
  IS_NULLABLE: string;
}

/** 合法标识符（小写字母开头，仅字母数字），用于模块名/业务名。 */
const NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * 分页查询数据库中的物理表。
 * 只读 information_schema，排除视图。
 */
export async function listGenTables(): Promise<GenTableItem[]> {
  const rows = await sequelize.query<TableRow>(
    `SELECT TABLE_NAME, TABLE_COMMENT, ENGINE, CREATE_TIME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    { type: QueryTypes.SELECT },
  );

  return rows.map((row) => ({
    tableName: row.TABLE_NAME,
    tableComment: row.TABLE_COMMENT || '',
    engine: row.ENGINE || '',
    createTime: row.CREATE_TIME ? String(row.CREATE_TIME) : '',
  }));
}

/**
 * 查询指定表的字段结构。
 * @param tableName 表名
 */
export async function getGenTableDetail(tableName: string): Promise<GenTableDetail> {
  await assertTableExists(tableName);

  const columns = await sequelize.query<ColumnRow>(
    `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLUMN_COMMENT, COLUMN_KEY, IS_NULLABLE
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME = ?
     ORDER BY ORDINAL_POSITION`,
    { type: QueryTypes.SELECT, replacements: [tableName] },
  );

  const tables = await sequelize.query<TableRow>(
    `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME = ?`,
    { type: QueryTypes.SELECT, replacements: [tableName] },
  );

  return {
    tableName,
    tableComment: tables[0]?.TABLE_COMMENT || '',
    columns: columns.map((col) => ({
      columnName: col.COLUMN_NAME,
      fieldName: toCamel(col.COLUMN_NAME),
      columnType: col.COLUMN_TYPE,
      dataType: col.DATA_TYPE,
      tsType: toTsType(col.DATA_TYPE),
      columnComment: col.COLUMN_COMMENT || '',
      isPk: col.COLUMN_KEY === 'PRI',
      isNullable: col.IS_NULLABLE === 'YES',
    })),
  };
}

/**
 * 生成代码文件列表（用于在线预览）。
 * @param config 生成配置
 */
export async function previewGenCode(config: GenConfig): Promise<{ tableName: string; files: GenFile[] }> {
  const { config: safeConfig, detail } = await resolveGenContext(config);
  return {
    tableName: safeConfig.tableName,
    files: generateFiles(safeConfig, detail.columns, detail.tableComment),
  };
}

/**
 * 生成代码并打包为 ZIP 二进制（store 模式，零依赖自实现）。
 * @param config 生成配置
 * @returns ZIP 文件 Buffer
 */
export async function buildGenZip(config: GenConfig): Promise<{ filename: string; buffer: Buffer }> {
  const { config: safeConfig, detail } = await resolveGenContext(config);
  const files = generateFiles(safeConfig, detail.columns, detail.tableComment);

  const entries: ZipEntry[] = files.map((file) => ({ name: file.path, content: file.content }));
  return {
    filename: `${safeConfig.businessName}.zip`,
    buffer: createZip(entries),
  };
}

/** 校验配置并取回表结构（内部复用）。 */
async function resolveGenContext(config: GenConfig): Promise<{ config: GenConfig; detail: GenTableDetail }> {
  const moduleName = String(config.moduleName ?? '').trim();
  const businessName = String(config.businessName ?? '').trim();

  if (!NAME_PATTERN.test(moduleName)) {
    throw AppError.badRequest('模块名只能包含字母和数字，且以字母开头');
  }
  if (!NAME_PATTERN.test(businessName)) {
    throw AppError.badRequest('业务名只能包含字母和数字，且以字母开头');
  }

  await assertTableExists(config.tableName);
  const detail = await getGenTableDetail(config.tableName);
  if (detail.columns.length === 0) {
    throw AppError.badRequest('该表没有可读取的字段');
  }

  return {
    config: {
      tableName: config.tableName,
      moduleName,
      businessName,
      author: config.author ? String(config.author).trim() : '',
    },
    detail,
  };
}

/** 确认表名真实存在（防止拼错或越权读取）。 */
async function assertTableExists(tableName: string): Promise<void> {
  const name = String(tableName ?? '').trim();
  if (!name) {
    throw AppError.badRequest('表名不能为空');
  }
  const tables = await listGenTables();
  if (!tables.some((item) => item.tableName === name)) {
    throw AppError.notFound('指定的数据表不存在');
  }
}

/** 供外部复用：业务名 → PascalCase 类名。 */
export { toPascal };
