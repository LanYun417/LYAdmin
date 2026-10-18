/**
 * CSV 流式写出单测。
 * 覆盖转义规则（含引号/逗号/换行必须加引号、内部引号翻倍）、分批写出与返回行数、
 * BOM 必须在最前面（否则 Excel 打开中文列名乱码，属历史踩过的问题）、以及背压等待 drain。
 */
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import { csvHeaderRow, csvRow, writeCsvStream } from '../src/common/utils/csv-stream.js';

/**
 * 假响应。
 * 不 extends Response：Express 的 write/end 返回 `this` 类型，继承会让每个方法的签名都要求
 * 返回假响应自身，写起来全是类型体操；这里只实现被测代码真正用到的方法，调用处一次性断言为 Response。
 */
interface FakeResponse {
  chunks: string[];
  headers: Record<string, string>;
  ended: boolean;
  setHeader: (name: string, value: string) => void;
  write: (chunk: string) => boolean;
  end: () => void;
  once: (event: string, cb: () => void) => void;
  emit: (event: string) => void;
  /** 由 emit 触发的监听器 */
  listeners: Map<string, Array<() => void>>;
}

/** 造一个记录所有写入片段与响应头的假响应。 */
function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    chunks: [],
    headers: {},
    ended: false,
    listeners: new Map(),
    setHeader: (name, value) => {
      res.headers[name] = value;
    },
    write: (chunk) => {
      res.chunks.push(chunk);
      return true; // 默认恒返回 true：模拟缓冲未满，不走 drain 分支
    },
    end: () => {
      res.ended = true;
    },
    once: (event, cb) => {
      res.listeners.set(event, [...(res.listeners.get(event) ?? []), cb]);
    },
    emit: (event) => {
      (res.listeners.get(event) ?? []).forEach((cb) => cb());
    },
  };
  return res;
}

/** 调用被测函数（假响应 → Response）。 */
function run(res: FakeResponse, filename: string, header: unknown[], batches: AsyncGenerator<unknown[][]>) {
  return writeCsvStream(res as unknown as Response, filename, header, batches);
}

describe('csvRow', () => {
  it('普通值直接拼接，null/undefined 归一为空串', () => {
    expect(csvRow([1, 'abc', null, undefined, true])).toBe('1,abc,,,true');
  });

  it('含逗号/引号/换行的值加双引号，内部引号翻倍', () => {
    expect(csvRow(['a,b'])).toBe('"a,b"');
    expect(csvRow(['说"引号"'])).toBe('"说""引号"""');
    expect(csvRow(['第一行\n第二行'])).toBe('"第一行\n第二行"');
  });

  it('对象走 JSON 而不是 [object Object]', () => {
    expect(csvRow([{ a: 1 }])).toBe('"{""a"":1}"');
  });
});

describe('csvHeaderRow', () => {
  it('首字符是 UTF-8 BOM（Excel 识别中文列名的前提）', () => {
    const line = csvHeaderRow(['ID', '名称']);
    expect(line.startsWith('\uFEFF')).toBe(true);
    expect(line.endsWith('\r\n')).toBe(true);
  });
});

describe('writeCsvStream', () => {
  it('写表头 + 全部分批，并返回实际行数', async () => {
    const res = fakeResponse();
    async function* batches(): AsyncGenerator<unknown[][]> {
      yield [
        [1, 'a'],
        [2, 'b'],
      ];
      yield [[3, 'c']];
    }

    const written = await run(res, 'demo.csv', ['ID', '名称'], batches());

    expect(written).toBe(3);
    expect(res.headers['Content-Type']).toBe('text/csv; charset=utf-8');
    expect(res.headers['Content-Disposition']).toContain('demo.csv');
    expect(res.headers['Cache-Control']).toBe('no-store');
    const body = res.chunks.join('');
    expect(body.startsWith('\uFEFFID,名称\r\n')).toBe(true);
    expect(body).toContain('1,a\r\n2,b\r\n3,c\r\n');
    expect(res.ended).toBe(true);
  });

  it('空批被跳过，不写多余换行', async () => {
    const res = fakeResponse();
    async function* batches(): AsyncGenerator<unknown[][]> {
      yield [];
      yield [[1, 'a']];
    }
    const written = await run(res, 'demo.csv', ['ID', '名称'], batches());
    expect(written).toBe(1);
    expect(res.chunks.join('')).toBe('\uFEFFID,名称\r\n1,a\r\n');
  });

  it('write 返回 false 时等待 drain（背压）后继续写', async () => {
    const res = fakeResponse();
    let first = true;
    res.write = (chunk: string): boolean => {
      res.chunks.push(chunk);
      if (first) {
        first = false;
        // 第一批返回 false：写出工具应等 drain 事件后再继续
        setImmediate(() => res.emit('drain'));
        return false;
      }
      return true;
    };

    async function* batches(): AsyncGenerator<unknown[][]> {
      yield [[1, 'a']];
      yield [[2, 'b']];
    }

    const written = await run(res, 'demo.csv', ['ID'], batches());
    expect(written).toBe(2);
    expect(res.chunks.join('')).toContain('2,b');
  });
});
