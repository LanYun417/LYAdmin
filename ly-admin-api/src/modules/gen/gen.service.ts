/**
 * 代码生成服务。
 * 模块职责：读取数据库表结构，按项目规范生成前后端 CRUD 代码，并打包为 ZIP（零第三方依赖）。
 *
 * 安全约束：表名必须与 information_schema 中真实存在的表匹配，模块名/业务名只允许
 * 字母数字（业务名会拼进生成物路径，必须挡住路径穿越）。
 *
 */
import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/exception/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { generateFiles, toCamel, toPascal, toTsType } from './gen.templates.js';
import type { ZipEntry } from './zip.util.js';
import { zipStore } from './zip.util.js';

/** 表概要。 */
export interface GenTableItem {
  tableName: string;
  tableComment: string;
  engine: string;
  createTime: string;
}

/** 字段控件类型：普通输入框 / 字典下拉 / 树形父级选择。 */
export type GenHtmlType = 'input' | 'select' | 'treeSelect';

/** 单字段的生成选项（由生成页提交，按 columnName 合并到表结构探测结果上）。 */
export interface GenColumnOption {
  columnName: string;
  htmlType: GenHtmlType;
  /** 字典类型编码（htmlType=select 时必填） */
  dictType?: string;
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
  /** 控件类型（探测时给出**推荐值**，生成页可覆盖） */
  htmlType: GenHtmlType;
  /** 绑定的字典类型编码（仅 htmlType=select 时有意义） */
  dictType: string;
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
  /** 是否树形表：列表返回整棵树、父级字段用树形选择、不生成分页 */
  isTree?: boolean;
  /** 树形表的父级字段名（默认 `parentId`） */
  treeParentField?: string;
  /** 各字段的控件类型 / 字典绑定（按 columnName 合并） */
  columnOptions?: GenColumnOption[];
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

/** 树形表默认的父级字段名（对应 `parent_id` 列的驼峰形式）。 */
const DEFAULT_TREE_PARENT_FIELD = 'parentId';

/** 会推荐为「树形父级选择」的列名。 */
const TREE_PARENT_COLUMN_NAMES = ['parent_id'];

/** 会推荐为「字典下拉」的列名。 */
const STATUS_COLUMN_NAMES = ['status', 'state'];

/** 内置「启用 / 禁用」字典类型（已在 sys_dict 中，无需新建）。 */
const BUILTIN_STATUS_DICT = 'sys_common_status';

/** 允许的控件类型（用于校验前端传值）。 */
const HTML_TYPES: GenHtmlType[] = ['input', 'select', 'treeSelect'];

/**
 * 推荐字段的控件类型与字典绑定。
 *
 * ⚠️ 这里只产出**建议值**，生成页会把它显示出来供人工确认或修改，不做静默自动化：
 * 猜错了用户在界面上看不出来，最终生成出错误代码，比不猜更糟。
 *
 * 规则（按优先级）：
 * 1. 注释里显式写了字典类型（如 `字典:article_status` / `dict:article_status`）→ 字典下拉；
 * 2. 列名为 `parent_id` → 树形父级选择；
 * 3. 列名为 `status`/`state` 且是整型 → 字典下拉，直接复用内置的启用/禁用字典。
 * @param columnName 列名（下划线形式）
 * @param dataType MySQL DATA_TYPE（列的数据类型）
 * @param comment 列注释
 */
function suggestFieldControl(
  columnName: string,
  dataType: string,
  comment: string,
): { htmlType: GenHtmlType; dictType: string } {
  const hinted = comment.match(/(?:字典|dict)\s*[:：]\s*([a-zA-Z0-9_]+)/);
  if (hinted) {
    return { htmlType: 'select', dictType: hinted[1] };
  }
  if (TREE_PARENT_COLUMN_NAMES.includes(columnName)) {
    return { htmlType: 'treeSelect', dictType: '' };
  }
  const isInteger = ['tinyint', 'smallint', 'mediumint', 'int', 'integer'].includes(dataType.toLowerCase());
  if (STATUS_COLUMN_NAMES.includes(columnName) && isInteger) {
    return { htmlType: 'select', dictType: BUILTIN_STATUS_DICT };
  }
  return { htmlType: 'input', dictType: '' };
}

/** 分页查询数据库中的物理表（只读 information_schema，排除视图）。 */
async function listGenTables(prisma: PrismaService): Promise<GenTableItem[]> {
  const rows = (await prisma.$queryRawUnsafe(
    `SELECT TABLE_NAME, TABLE_COMMENT, ENGINE, CREATE_TIME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
  )) as unknown as TableRow[];

  return rows.map((row) => ({
    tableName: row.TABLE_NAME,
    tableComment: row.TABLE_COMMENT || '',
    engine: row.ENGINE || '',
    createTime: row.CREATE_TIME ? String(row.CREATE_TIME) : '',
  }));
}

@Injectable()
export class GenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询指定表的字段结构。
   * @param tableName 表名
   */
  async getGenTableDetail(tableName: string): Promise<GenTableDetail> {
    await this.assertTableExists(tableName);

    const columns = (await this.prisma.$queryRawUnsafe(
      `SELECT COLUMN_NAME, COLUMN_TYPE, DATA_TYPE, COLUMN_COMMENT, COLUMN_KEY, IS_NULLABLE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      tableName,
    )) as unknown as ColumnRow[];

    const tables = (await this.prisma.$queryRawUnsafe(
      `SELECT TABLE_NAME, TABLE_COMMENT FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = (SELECT DATABASE()) AND TABLE_NAME = ?`,
      tableName,
    )) as unknown as TableRow[];

    return {
      tableName,
      tableComment: tables[0]?.TABLE_COMMENT || '',
      columns: columns.map((col) => {
        const comment = col.COLUMN_COMMENT || '';
        return {
          columnName: col.COLUMN_NAME,
          fieldName: toCamel(col.COLUMN_NAME),
          columnType: col.COLUMN_TYPE,
          dataType: col.DATA_TYPE,
          tsType: toTsType(col.DATA_TYPE),
          columnComment: comment,
          isPk: col.COLUMN_KEY === 'PRI',
          isNullable: col.IS_NULLABLE === 'YES',
          // 控件类型的**推荐值**：生成页展示为预选项，用户确认或修改后再提交
          ...suggestFieldControl(col.COLUMN_NAME, col.DATA_TYPE, comment),
        };
      }),
    };
  }

  /** 列出全部业务表（读 information_schema.TABLES）。 */
  listTables(): Promise<GenTableItem[]> {
    return listGenTables(this.prisma);
  }

  /**
   * 生成代码文件列表（用于在线预览）。
   * @param config 生成配置
   */
  async previewGenCode(config: GenConfig): Promise<{ tableName: string; files: GenFile[] }> {
    const { config: safeConfig, detail } = await this.resolveGenContext(config);
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
  async buildGenZip(config: GenConfig): Promise<{ filename: string; buffer: Buffer }> {
    const { config: safeConfig, detail } = await this.resolveGenContext(config);
    const files = generateFiles(safeConfig, detail.columns, detail.tableComment);

    const entries: ZipEntry[] = files.map((file) => ({ name: file.path, data: Buffer.from(file.content, 'utf8') }));
    return {
      filename: `${safeConfig.businessName}.zip`,
      buffer: zipStore(entries),
    };
  }

  /** 校验配置并取回表结构（内部复用）。 */
  private async resolveGenContext(config: GenConfig): Promise<{ config: GenConfig; detail: GenTableDetail }> {
    const moduleName = String(config.moduleName ?? '').trim();
    const businessName = String(config.businessName ?? '').trim();

    if (!NAME_PATTERN.test(moduleName)) {
      throw AppException.badRequest('模块名只能包含字母和数字，且以字母开头');
    }
    if (!NAME_PATTERN.test(businessName)) {
      throw AppException.badRequest('业务名只能包含字母和数字，且以字母开头');
    }

    await this.assertTableExists(config.tableName);
    const detail = await this.getGenTableDetail(config.tableName);
    if (detail.columns.length === 0) {
      throw AppException.badRequest('该表没有可读取的字段');
    }

    // 合并前端提交的「字段控件类型 / 字典绑定」，并做一致性校验
    const columns = this.applyColumnOptions(detail.columns, config.columnOptions);
    this.assertColumnOptions(columns);

    const isTree = config.isTree === true;
    const treeParentField = String(config.treeParentField ?? '').trim() || DEFAULT_TREE_PARENT_FIELD;
    if (isTree) {
      const parent = columns.find((c) => c.fieldName === treeParentField);
      if (!parent) {
        throw AppException.badRequest(`已勾选「树形表」，但表中找不到父级字段「${treeParentField}」`);
      }
      if (parent.tsType !== 'number') {
        throw AppException.badRequest(`父级字段「${treeParentField}」必须是整型`);
      }
    } else if (columns.some((c) => c.htmlType === 'treeSelect')) {
      throw AppException.badRequest('有字段被设为「树形父级」，请同时勾选「树形表」');
    }

    return {
      config: {
        tableName: config.tableName,
        moduleName,
        businessName,
        author: config.author ? String(config.author).trim() : '',
        isTree,
        treeParentField,
      },
      detail: { ...detail, columns },
    };
  }

  /**
   * 合并前端提交的字段选项（按 columnName 匹配）。
   * 未提交的字段沿用探测出的**推荐值**。
   * @param columns 探测出的字段
   * @param options 前端提交的字段选项
   */
  private applyColumnOptions(columns: GenColumn[], options: GenColumnOption[] | undefined): GenColumn[] {
    if (!Array.isArray(options) || options.length === 0) {
      return columns;
    }
    const byName = new Map<string, GenColumnOption>();
    for (const option of options) {
      const key = String(option?.columnName ?? '').trim();
      if (key) {
        byName.set(key, option);
      }
    }
    return columns.map((col) => {
      const option = byName.get(col.columnName);
      if (!option) {
        return col;
      }
      const htmlType = HTML_TYPES.includes(option.htmlType) ? option.htmlType : col.htmlType;
      return {
        ...col,
        htmlType,
        // 非下拉控件不保留字典绑定，否则会生成出无用的 useDict 调用
        dictType: htmlType === 'select' ? String(option.dictType ?? '').trim() || col.dictType : '',
      };
    });
  }

  /**
   * 校验字段选项的完整性。
   * 「字典下拉」必须给出字典类型——否则生成出来是一张空白下拉，要到运行期才会暴露。
   * @param columns 合并后的字段
   */
  private assertColumnOptions(columns: GenColumn[]): void {
    const missingDict = columns.filter((c) => !c.isPk && c.htmlType === 'select' && !c.dictType);
    if (missingDict.length > 0) {
      const names = missingDict.map((c) => c.columnComment || c.columnName).join('、');
      throw AppException.badRequest(`以下字段选择了「字典下拉」但未指定字典类型：${names}`);
    }
    if (columns.filter((c) => c.htmlType === 'treeSelect').length > 1) {
      throw AppException.badRequest('只能有一个字段作为树形父级');
    }
  }

  /** 确认表名真实存在（防止拼错或越权读取）。 */
  private async assertTableExists(tableName: string): Promise<void> {
    const name = String(tableName ?? '').trim();
    if (!name) {
      throw AppException.badRequest('表名不能为空');
    }
    const tables = await this.listTables();
    if (!tables.some((item) => item.tableName === name)) {
      throw AppException.notFound('指定的数据表不存在');
    }
  }
}

/** 供外部复用：业务名 → PascalCase 类名。 */
export { toPascal };
