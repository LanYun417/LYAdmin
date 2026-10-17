import { describe, expect, it } from 'vitest';
import { PAGINATION } from '../src/common/constants.js';
import {
  buildPageResult,
  buildTree,
  collectIds,
  comparePassword,
  emptyToNull,
  findNode,
  flattenTree,
  formatDateTimeInZone,
  hashPassword,
  parsePagination,
  readNumber,
  readString,
  sha256,
  toCsv,
} from '../src/common/utils.js';

describe('parsePagination', () => {
  it('缺省时回退默认值', () => {
    expect(parsePagination({})).toEqual({
      page: PAGINATION.DEFAULT_PAGE,
      pageSize: PAGINATION.DEFAULT_PAGE_SIZE,
      offset: 0,
      limit: PAGINATION.DEFAULT_PAGE_SIZE,
    });
  });

  it('pageSize 超上限时静默截断到 MAX_PAGE_SIZE，offset 按截断后的值计算', () => {
    const result = parsePagination({ page: '2', pageSize: '9999' });
    expect(result.pageSize).toBe(PAGINATION.MAX_PAGE_SIZE);
    expect(result.limit).toBe(PAGINATION.MAX_PAGE_SIZE);
    expect(result.offset).toBe(PAGINATION.MAX_PAGE_SIZE);
  });

  it('非法值（0 / 负数 / 非数字 / 空串 / null）一律回退默认', () => {
    for (const value of ['0', '-3', 'abc', '', null, undefined]) {
      const result = parsePagination({ page: value, pageSize: value });
      expect(result.page).toBe(PAGINATION.DEFAULT_PAGE);
      expect(result.pageSize).toBe(PAGINATION.DEFAULT_PAGE_SIZE);
    }
  });

  it('小数向下取整', () => {
    expect(parsePagination({ page: '2.9', pageSize: '12.7' })).toMatchObject({ page: 2, pageSize: 12 });
  });
});

describe('buildPageResult', () => {
  it('输出 { list, total, page, pageSize }', () => {
    expect(buildPageResult([1, 2], 42, 2, 10)).toEqual({ list: [1, 2], total: 42, page: 2, pageSize: 10 });
  });
});

describe('buildTree', () => {
  const flat = [
    { id: 3, parentId: 1, sort: 2, name: 'c' },
    { id: 1, parentId: 0, sort: 1, name: 'a' },
    { id: 2, parentId: 1, sort: 1, name: 'b' },
    { id: 4, parentId: 999, sort: 3, name: 'orphan' },
  ];

  it('按 parentId 组树；根与各层按 sort 升序、再按 id 升序', () => {
    const tree = buildTree(flat);
    expect(tree.map((node) => Number(node.id))).toEqual([1, 4]);
    expect(tree[0].children.map((node) => Number(node.id))).toEqual([2, 3]);
  });

  it('父节点缺失时按根处理（防数据丢失兜底）', () => {
    expect(buildTree(flat).some((node) => Number(node.id) === 4)).toBe(true);
  });

  it('每个节点固定带 children 数组（空数组也保留）', () => {
    const tree = buildTree(flat);
    expect(Array.isArray(tree[0].children)).toBe(true);
    expect(tree[0].children[0].children).toEqual([]);
  });

  it('递归排序：子层同样按 sort 排序', () => {
    const tree = buildTree([
      { id: 1, parentId: 0, sort: 0 },
      { id: 3, parentId: 1, sort: 1 },
      { id: 2, parentId: 1, sort: 9 },
    ]);
    expect(tree[0].children.map((node) => Number(node.id))).toEqual([3, 2]);
  });

  it('flattenTree / collectIds / findNode 与树结构一致', () => {
    const tree = buildTree(flat);
    expect(
      flattenTree(tree)
        .map((node) => Number(node.id))
        .sort((a, b) => a - b),
    ).toEqual([1, 2, 3, 4]);
    expect(collectIds(tree).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(Number(findNode(tree, 3)?.id)).toBe(3);
    expect(findNode(tree, 12345)).toBeNull();
  });
});

describe('toCsv', () => {
  it('以 UTF-8 BOM 开头、CRLF 换行（Excel 打开中文不乱码）', () => {
    const csv = toCsv(['a', 'b'], [[1, 2]]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFFa,b\r\n1,2');
  });

  it('含逗号 / 引号 / 换行的单元格加引号，内部引号双写', () => {
    const csv = toCsv(['name'], [['a,b'], ['say "hi"'], ['line1\nline2']]);
    expect(csv).toBe('\uFEFFname\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"');
  });

  it('null / undefined 输出空串，0 正常输出', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe('\uFEFFa,b,c\r\n,,0');
  });
});

describe('formatDateTimeInZone', () => {
  it('空值与无效日期返回空串', () => {
    expect(formatDateTimeInZone(null)).toBe('');
    expect(formatDateTimeInZone(undefined)).toBe('');
    expect(formatDateTimeInZone('not-a-date')).toBe('');
  });

  it('传 offset 时按客户端时区格式化（东八区 -480）', () => {
    expect(formatDateTimeInZone(new Date('2026-10-16T12:00:00Z'), -480)).toBe('2026-10-16 20:00:00');
  });

  it('不传 offset 时按服务器本地时间格式化', () => {
    expect(formatDateTimeInZone(new Date('2026-10-16T12:00:00Z'))).toMatch(/^2026-10-1[56] \d{2}:00:00$/);
  });
});

describe('口令与哈希', () => {
  it('哈希可校验，且同明文两次哈希不同（含随机盐）', async () => {
    const first = await hashPassword('123456');
    const second = await hashPassword('123456');
    expect(first).not.toBe(second);
    expect(await comparePassword('123456', first)).toBe(true);
    expect(await comparePassword('wrong-password', first)).toBe(false);
  });

  it('sha256 输出稳定的 64 位 hex（秒传/去重依据）', () => {
    expect(sha256(Buffer.from('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('查询参数读取', () => {
  it('readString：trim 后返回，空串与非字符串返回 undefined', () => {
    expect(readString('  a  ')).toBe('a');
    expect(readString('   ')).toBeUndefined();
    expect(readString(undefined)).toBeUndefined();
    expect(readString(123)).toBeUndefined();
  });

  it('readNumber：合法数字通过，非法返回 undefined', () => {
    expect(readNumber('12')).toBe(12);
    expect(readNumber('1.5')).toBe(1.5);
    expect(readNumber('abc')).toBeUndefined();
    expect(readNumber('')).toBeUndefined();
    expect(readNumber(null)).toBeUndefined();
  });

  it('emptyToNull：非空字符串 trim 后返回，空串与非字符串返回 null', () => {
    expect(emptyToNull(' x ')).toBe('x');
    expect(emptyToNull('')).toBeNull();
    expect(emptyToNull(null)).toBeNull();
  });
});
