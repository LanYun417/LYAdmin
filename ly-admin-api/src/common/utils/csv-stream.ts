/**
 * CSV 流式写出工具。
 *
 * 为什么需要：原先导出是「查 1 万行 → 拼字符串 → 一次性 send」，日志表长大后
 * 内存与响应时间会随行数线性上涨（1 万行 × 十几列 ≈ 数十 MB 常驻内存）。
 * 改为「分批查 → 逐批 write」后，内存占用只与批大小有关，且首个字节能立刻发给浏览器。
 *
 * 用到的两个关键点：
 * - **背压**：`res.write()` 返回 false 表示内核缓冲已满，必须等 `drain` 再写，
 *   否则慢客户端会把数据堆在 Node 内存里（流式的意义就没了）；
 * - **BOM**：UTF-8 BOM 必须写在最前面，否则 Excel 打开中文列名是乱码。
 *
 * 行数上限不在这里判断：服务层会先 count，超限直接 400（此时尚未写响应头，
 * 前端能收到正常 JSON 错误）。本模块只负责「把已经确定能导的数据写出去」。
 */
import { once } from 'node:events';
import type { Response } from 'express';

/** 单元格转义：含分隔符 / 引号 / 换行时用双引号包裹，内部引号翻倍。 */
function escapeCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  // 显式分流而不是直接 String(value)：表格里有对象/数组时 String() 会得到 "[object Object]",
  // 既丢信息又容易让调用方误以为「导出成功」。非原始值统一走 JSON。
  const text =
    typeof value === 'string'
      ? value
      : typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint'
        ? String(value)
        : (JSON.stringify(value) ?? '');
  if (!/[",\r\n]/.test(text)) {
    return text;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

/** 拼一行 CSV（不含换行符）。 */
export function csvRow(values: unknown[]): string {
  return values.map((value) => escapeCell(value)).join(',');
}

/** 表头行（含 UTF-8 BOM，供 Excel 正确识别中文）。 */
export function csvHeaderRow(headers: unknown[]): string {
  return `\uFEFF${csvRow(headers)}\r\n`;
}

/**
 * 把分批数据流式写为 CSV 响应。
 *
 * @param res Express 响应对象
 * @param filename 下载文件名（如 `http-logs-1730000000000.csv`）
 * @param headers 表头
 * @param batches 分批行数据（每批是二维数组；由服务层的游标分页生成器提供）
 * @returns 实际写出的数据行数
 */
export async function writeCsvStream(
  res: Response,
  filename: string,
  headers: unknown[],
  batches: AsyncGenerator<unknown[][]>,
): Promise<number> {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // 导出是即时生成的，禁止任何中间层缓存
  res.setHeader('Cache-Control', 'no-store');
  res.write(csvHeaderRow(headers));

  let written = 0;
  for await (const batch of batches) {
    if (batch.length === 0) {
      continue;
    }
    const chunk = batch.map((row) => `${csvRow(row)}\r\n`).join('');
    if (!res.write(chunk)) {
      // 客户端/内核缓冲已满：等排空再继续，避免内存堆积
      await once(res, 'drain');
    }
    written += batch.length;
  }

  res.end();
  return written;
}
