// 在 node 环境下运行，直接拿到 Node 原生 crypto.subtle，避免 jsdom 的兼容性问题。
// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { sha256Hex } from '@/utils/hash';

describe('sha256Hex', () => {
  it('computes the SHA-256 hex of a known input (hello)', async () => {
    const hex = await sha256Hex(new Blob(['hello']));
    expect(hex).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('is consistent across File and Blob with equal content', async () => {
    const fromBlob = await sha256Hex(new Blob(['abc']));
    const fromFile = await sha256Hex(new File(['abc'], 'x.txt'));
    expect(fromBlob).toBe(fromFile);
    expect(fromBlob).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('produces different digests for different content', async () => {
    const a = await sha256Hex(new Blob(['hello']));
    const b = await sha256Hex(new Blob(['world']));
    expect(a).not.toBe(b);
  });
});
