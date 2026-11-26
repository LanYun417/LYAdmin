/**
 * 操作日志字段级 Diff。
 * 模块职责：把 recordBefore/recordAfter 采集的两份快照算成「仅列变化字段」的差异对象。
 *
 * 口径：
 * - 只输出**发生变化**的字段，相同值不出现（审计关注的是「改了什么」）；
 * - 字段在 after 中消失（删除）标 `__deleted__`，在 after 中新增标 `__added__`；
 * - Date 统一转 ISO 串、BigInt 转字符串——避免 JSON.stringify 把 Date 变成 {}；
 * - 两侧都没有数据 / 完全相同时返回 null（不写无用列）。
 */

/** 新增字段标记值。 */
export const DIFF_ADDED = '__added__';
/** 删除字段标记值。 */
export const DIFF_DELETED = '__deleted__';

/** 归一化单值：Date → ISO；BigInt → 十进制串；其余原样。 */
function normalize(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/** 深相等（Date/BigInt 归一后逐项比）。 */
function deepEqual(a: unknown, b: unknown): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) {
    return true;
  }
  if (na === null || nb === null || typeof na !== 'object' || typeof nb !== 'object') {
    return false;
  }
  // 数组按序比
  if (Array.isArray(na) || Array.isArray(nb)) {
    if (!Array.isArray(na) || !Array.isArray(nb) || na.length !== nb.length) {
      return false;
    }
    return na.every((item, index) => deepEqual(item, nb[index]));
  }
  const ka = Object.keys(na as Record<string, unknown>);
  const kb = Object.keys(nb as Record<string, unknown>);
  if (ka.length !== kb.length) {
    return false;
  }
  return ka.every(
    (key) =>
      Object.hasOwn(nb as Record<string, unknown>, key) &&
      deepEqual((na as Record<string, unknown>)[key], (nb as Record<string, unknown>)[key]),
  );
}

/**
 * 计算两份快照的字段级差异。
 * @param before 变更前（null = 无采集）
 * @param after 变更后（null = 无采集）
 * @returns 差异对象；无变化返回 null
 */
export function computeOperationDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!before || !after) {
    return null;
  }
  const beforeObj = before as Record<string, unknown>;
  const afterObj = after as Record<string, unknown>;
  const diff: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]);
  for (const key of keys) {
    const inBefore = Object.hasOwn(beforeObj, key);
    const inAfter = Object.hasOwn(afterObj, key);
    if (inBefore && !inAfter) {
      diff[key] = DIFF_DELETED;
      continue;
    }
    if (!inBefore && inAfter) {
      diff[key] = DIFF_ADDED;
      continue;
    }
    const from = beforeObj[key];
    const to = afterObj[key];
    if (!deepEqual(from, to)) {
      diff[key] = { from: normalize(from), to: normalize(to) };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}
