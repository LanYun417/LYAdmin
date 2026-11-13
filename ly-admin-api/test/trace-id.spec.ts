import { describe, expect, it } from 'vitest';
import { generateTraceId, getTraceId, resolveTraceId, runWithTrace, TRACE_HEADER } from '../src/common/log/trace-id.js';
import type { Request } from 'express';

/** 构造带指定请求头的假请求。 */
function fakeRequest(headers: Record<string, string>): Request {
  return { headers } as unknown as Request;
}

describe('traceId', () => {
  describe('generateTraceId', () => {
    it('生成 16 位十六进制且不重复', () => {
      const id = generateTraceId();
      expect(id).toMatch(/^[0-9a-f]{16}$/);
      const seen = new Set(Array.from({ length: 1000 }, () => generateTraceId()));
      expect(seen.size).toBe(1000);
    });
  });

  describe('resolveTraceId', () => {
    it('沿用客户端带的合规 X-Request-Id（网关侧串联）', () => {
      expect(resolveTraceId(fakeRequest({ [TRACE_HEADER]: 'abc-123-DEF' }))).toBe('abc-123-DEF');
    });

    it('没带请求头时新生成', () => {
      const id = resolveTraceId(fakeRequest({}));
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('非法入站一律丢弃重生成：超长 / 数组 / 空串 / 异字符', () => {
      expect(resolveTraceId(fakeRequest({ [TRACE_HEADER]: 'x'.repeat(65) }))).toMatch(/^[0-9a-f]{16}$/);
      expect(resolveTraceId(fakeRequest({ [TRACE_HEADER]: 'a b c' }))).toMatch(/^[0-9a-f]{16}$/);
      expect(resolveTraceId(fakeRequest({ [TRACE_HEADER]: '' }))).toMatch(/^[0-9a-f]{16}$/);
      expect(resolveTraceId(fakeRequest({ [TRACE_HEADER]: '../../etc/passwd' }))).toMatch(/^[0-9a-f]{16}$/);
      // 数组形式（ express 对重复头的归一化）取第一个
      const asArray = fakeRequest({});
      (asArray.headers as Record<string, string[]>)[TRACE_HEADER] = ['ok-value-1', 'ok-value-2'];
      expect(resolveTraceId(asArray)).toBe('ok-value-1');
    });
  });

  describe('AsyncLocalStorage 上下文', () => {
    it('runWithTrace 内在同步与异步回调都能取到同一值', async () => {
      let syncValue: string | undefined;
      let asyncValue: string | undefined;
      await runWithTrace('trace-in-ctx', async () => {
        syncValue = getTraceId();
        await Promise.resolve();
        asyncValue = getTraceId();
      });
      expect(syncValue).toBe('trace-in-ctx');
      expect(asyncValue).toBe('trace-in-ctx');
    });

    it('上下文之外取不到值（脱离后返回 undefined，调用方须按 null 落库）', () => {
      expect(getTraceId()).toBeUndefined();
    });
  });
});
