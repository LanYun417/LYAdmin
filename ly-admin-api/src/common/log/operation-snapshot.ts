/**
 * 操作日志的「变更前后值」采集（AsyncLocalStorage）。
 *
 * 为什么用 ALS 而不是让服务层接收 req：写操作散落在各 service，把 req 透传进业务层会污染签名；
 * 拦截器在请求进入时建立一个**快照容器**，服务层在改动前后各调用一次 `recordBefore/recordAfter`，
 * 拦截器在响应结束时统一读取并按同一口径落库（脱敏 + 截断）。
 *
 * 注意：`res.on('finish')` 回调已经脱离请求的 async 上下文，`getStore()` 在那里取不到值，
 * 因此拦截器持有的是**容器对象本身的引用**——服务层写的是对象的属性，回调里直接读该引用即可。
 *
 * 采集是**可选**的：没有调用 record 的接口，两个字段就是 null（不编造数据）。
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { maskSensitive } from './operation-log.service.js';

/** 快照容器（按请求存放，由拦截器创建）。 */
export interface OperationSnapshot {
  /** 变更前值 */
  before?: Record<string, unknown> | null;
  /** 变更后值 */
  after?: Record<string, unknown> | null;
}

/** 落库时单侧快照的最大字符数（超出截断并标注，避免把日志表撑大）。 */
export const SNAPSHOT_MAX_CHARS = 2000;

const storage = new AsyncLocalStorage<OperationSnapshot>();

/**
 * 在指定快照容器下执行（由 OperationLogInterceptor 调用）。
 * @param snapshot 容器对象（调用方需保留引用，供响应结束后读取）
 * @param callback 实际处理请求的回调
 */
export function runWithSnapshot<T>(snapshot: OperationSnapshot, callback: () => T): T {
  return storage.run(snapshot, callback);
}

/** 记录变更前值（服务层在查询到旧数据后、写入前调用）。 */
export function recordBefore(data: Record<string, unknown> | null): void {
  const snapshot = storage.getStore();
  if (snapshot) {
    snapshot.before = data;
  }
}

/** 记录变更后值（服务层在写入成功后、返回前调用）。 */
export function recordAfter(data: Record<string, unknown> | null): void {
  const snapshot = storage.getStore();
  if (snapshot) {
    snapshot.after = data;
  }
}

/** 递归脱敏：password 等字段一律替换为 `***`；其余原样保留。 */
function maskSensitiveValue(value: unknown): unknown {
  return maskSensitive(value);
}

/** 单侧快照 → 可落库的字符串（脱敏 + 截断；无数据返回 null）。 */
function serializeSide(side: Record<string, unknown> | null | undefined): string | null {
  if (side === null || side === undefined) {
    return null;
  }
  const json = JSON.stringify(maskSensitiveValue(side));
  if (json.length <= SNAPSHOT_MAX_CHARS) {
    return json;
  }
  return `${json.slice(0, SNAPSHOT_MAX_CHARS)}…(truncated)`;
}

/**
 * 容器 → 落库字段。
 * @param snapshot 容器（可能为空：接口未采集）
 * @returns beforeData / afterData（未采集时为 null，不写空对象占位）
 */
export function buildSnapshotFields(snapshot: OperationSnapshot | undefined): {
  beforeData: string | null;
  afterData: string | null;
} {
  return {
    beforeData: serializeSide(snapshot?.before),
    afterData: serializeSide(snapshot?.after),
  };
}
