/**
 * CSV 解析（零依赖手写）。
 *
 * 为什么不用现成库：导入是一次性动作，而"零第三方运行时依赖"是本项目的身份约束
 * （见 `scripts/deps-guard.mjs`）；CSV 的难点只有引号/换行两种转义，几十行能覆盖。
 *
 * 支持的形态（这些都是 Excel / WPS 导出真实会出现的）：
 * - UTF-8 BOM 开头（Excel 保存 CSV 默认带）；
 * - CRLF / LF / 行尾混用；
 * - 字段用双引号包裹，内部 `""` 表示一个字面引号；
 * - 引号内包含逗号 / 换行（Excel 多行单元格）；
 * - 行尾多余空行（忽略）。
 *
 * 不做的事：类型推断。所有值都以字符串返回，类型转换与业务校验交给上层（DTO）。
 */

/** 解析出的数据行。 */
export interface CsvRow {
  /** 该行在文件中的**起始物理行号**（1 起，含表头；用于给用户报"第几行有问题"） */
  line: number;
  /** 按表头顺序切好的字段值（缺失补空串） */
  values: string[];
}

/** 解析结果。 */
export interface ParsedCsv {
  /** 表头（已去除 BOM 与首尾空白） */
  header: string[];
  /** 数据行（不含表头；已跳过完全空白的行） */
  rows: CsvRow[];
}

/** 解析上限：单次导入的物理行数上限，防止一个超大文件把内存与 DB 打满。 */
export const CSV_MAX_ROWS = 5000;

/**
 * 解析 CSV 文本。
 * @param text 文件内容（UTF-8 解码后的字符串）
 * @param maxRows 数据行上限（超出抛错，避免静默截断）
 * @throws Error 超过行数上限
 */
export function parseCsv(text: string, maxRows: number = CSV_MAX_ROWS): ParsedCsv {
  // 去 BOM：Excel 存的 CSV 带 BOM，不去掉会让第一个表头变成 "\uFEFF账号" 而匹配不上
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const records: Array<{ line: number; values: string[] }> = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let line = 1;
  /** 当前记录起始行号（引号内换行时，报告行号应指向记录开头而不是续行） */
  let recordLine = 1;

  const pushField = (): void => {
    row.push(field);
    field = '';
  };
  const pushRow = (): void => {
    pushField();
    // 整行都是空串 → 视为空行跳过（文件末尾常有）
    if (row.some((value) => value !== '')) {
      records.push({ line: recordLine, values: row });
    }
    row = [];
    // `line` 在遇到换行时已指向"下一行"，故下一条记录即从当前 line 开始（不再 +1，否则整体偏一行）
    recordLine = line;
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!;

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          // 转义的双引号：`""` → `"`
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        if (char === '\n') {
          line += 1;
        }
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      pushField();
      continue;
    }
    if (char === '\r') {
      // CRLF 与裸 CR 都按换行处理（裸 CR 是旧 Mac 导出）
      if (source[index + 1] === '\n') {
        index += 1;
      }
      line += 1;
      pushRow();
      continue;
    }
    if (char === '\n') {
      line += 1;
      pushRow();
      continue;
    }
    field += char;
  }

  // 收尾：最后一行没有换行符时补一次
  if (field !== '' || row.length > 0) {
    pushRow();
  }

  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) {
    return { header: [], rows: [] };
  }
  if (dataRecords.length > maxRows) {
    throw new Error(`导入行数超过上限（最多 ${maxRows} 行，当前 ${dataRecords.length} 行）`);
  }

  const header = headerRecord.values.map((value) => normalizeHeader(value));
  const rows = dataRecords.map((record) => {
    // 字段数不足补空串、多余则丢弃：宁可让后续校验报"缺列"，也不要因为错位把数据写错字段
    const values = header.map((_name, index) => record.values[index] ?? '');
    return { line: record.line, values };
  });

  return { header, rows };
}

/**
 * 表头归一化：去 BOM / 空白，并去掉括号内的取值说明。
 * 这样模板里可以写 `状态(启用/禁用)`、`性别(男/女未知)` 这种自带说明的表头，
 * 用户改了大小写或加了空格也能识别。
 */
export function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .replace(/[（(].*?[)）]/g, '')
    .trim();
}

/**
 * 按表头把一行映射成对象（值为去除首尾空白的字符串）。
 * @param header 表头
 * @param values 行值
 */
export function rowToObject(header: string[], values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  header.forEach((name, index) => {
    if (!name) {
      return;
    }
    result[name] = (values[index] ?? '').trim();
  });
  return result;
}
