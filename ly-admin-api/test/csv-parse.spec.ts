/**
 * CSV 解析单测。
 * 覆盖 Excel / WPS 真实会导出的形态：BOM、CRLF、引号包裹、引号内换行与逗号、`""` 转义、
 * 末尾空行，以及"报错行号要指向记录起始行"这类影响用户体验的细节。
 */
import { describe, expect, it } from 'vitest';
import { normalizeHeader, parseCsv, rowToObject } from '../src/common/utils/csv-parse.js';

describe('parseCsv', () => {
  it('解析最简单的表头 + 两行', () => {
    const { header, rows } = parseCsv('账号,昵称\r\nzhangsan,张三\r\nlisi,李四\r\n');
    expect(header).toEqual(['账号', '昵称']);
    expect(rows.map((row) => row.values)).toEqual([
      ['zhangsan', '张三'],
      ['lisi', '李四'],
    ]);
  });

  it('去掉 UTF-8 BOM（否则第一个表头匹配不上）', () => {
    const { header } = parseCsv('\uFEFF账号,昵称\nadmin,管理员\n');
    expect(header[0]).toBe('账号');
  });

  it('引号内的逗号与换行不切分（Excel 多行单元格）', () => {
    const csv = '账号,备注\nadmin,"第一行,\n第二行"\n';
    const { rows } = parseCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.values[1]).toBe('第一行,\n第二行');
  });

  it('`""` 转义为一个字面引号', () => {
    const { rows } = parseCsv('账号,备注\nadmin,"他说""你好"""\n');
    expect(rows[0]!.values[1]).toBe('他说"你好"');
  });

  it('LF / CRLF 混用都能解析，且忽略末尾空行', () => {
    const { rows } = parseCsv('账号\nadmin\nlisi\r\n\r\n');
    expect(rows.map((row) => row.values[0])).toEqual(['admin', 'lisi']);
  });

  it('行号指向记录起始行（多行记录的后续行不另算一条）', () => {
    const csv = '账号,备注\nadmin,"跨\n行内容"\nlisi,普通\n';
    const { rows } = parseCsv(csv);
    expect(rows.map((row) => row.line)).toEqual([2, 4]);
  });

  it('字段少于表头时补空串，多余字段被丢弃（避免错位写错列）', () => {
    const { rows } = parseCsv('a,b,c\n1,2\n');
    expect(rows[0]!.values).toEqual(['1', '2', '']);
  });

  it('超过行数上限抛错（不静默截断）', () => {
    const csv = `账号\n${Array.from({ length: 5 }, (_, index) => `u${index}`).join('\n')}`;
    expect(() => parseCsv(csv, 3)).toThrowError(/超过上限/);
  });

  it('空内容返回空表头与空行集', () => {
    expect(parseCsv('')).toEqual({ header: [], rows: [] });
  });
});

describe('normalizeHeader', () => {
  it('去掉括号内的取值说明与多余空白', () => {
    expect(normalizeHeader('状态(启用/禁用)')).toBe('状态');
    expect(normalizeHeader(' 性别（男/女） ')).toBe('性别');
    expect(normalizeHeader('\uFEFF账号')).toBe('账号');
  });
});

describe('rowToObject', () => {
  it('按表头映射为对象并去除首尾空白', () => {
    const record = rowToObject(['账号', '昵称', ''], [' admin ', ' 管理员 ', 'x']);
    expect(record).toEqual({ 账号: 'admin', 昵称: '管理员' });
  });
});
