/**
 * 字典数据组合式封装 —— **业务页面接入字典的标准入口**。
 *
 * 用「类型编码」取启用中的字典项，并在模块级缓存 + 并发去重，避免同一类型被重复请求。
 *
 * 用法示例（下拉）：
 * ```ts
 * const { options } = useDict('sys_user_sex');
 * // <el-select v-model="form.sex"><el-option v-for="d in options" :key="d.value" :label="d.label" :value="d.value" /></el-select>
 * ```
 *
 * 用法示例（表格里把值渲染成标签）：
 * ```ts
 * const { labelOf } = useDict('sys_user_sex');
 * // <span>{{ labelOf(row.sex) }}</span>
 * ```
 *
 * 注意：字典在「字典管理」页被修改后，请调用 `clearDictCache(dictType)` 使缓存失效。
 */
import { ref, type Ref } from 'vue';
import { getDictDataApi } from '@/api/dict';
import type { DictDataItem } from '@/types/api';

/** 模块级缓存：dictType → 字典数据（同一会话内跨页面/组件复用） */
const cache = new Map<string, DictDataItem[]>();

/** 进行中的请求：同一类型的并发请求合并为一次 */
const inflight = new Map<string, Promise<DictDataItem[]>>();

/** 拉取字典（命中缓存直接返回；并发合并；异常时回退空数组，不阻断页面） */
async function loadDict(dictType: string): Promise<DictDataItem[]> {
  const cached = cache.get(dictType);
  if (cached) {
    return cached;
  }
  const pending = inflight.get(dictType);
  if (pending) {
    return pending;
  }
  const task = getDictDataApi(dictType)
    .then((data) => {
      const list = data ?? [];
      cache.set(dictType, list);
      return list;
    })
    .catch(() => [] as DictDataItem[])
    .finally(() => {
      inflight.delete(dictType);
    });
  inflight.set(dictType, task);
  return task;
}

/**
 * 清空字典缓存。
 * @param dictType 指定类型则只清该类型；不传则清空全部
 */
export function clearDictCache(dictType?: string): void {
  if (dictType) {
    cache.delete(dictType);
  } else {
    cache.clear();
  }
}

/** useDict 返回值。 */
export interface UseDictResult {
  /** 字典项（标签 + 值），可直接用于 el-select */
  options: Ref<DictDataItem[]>;
  /** 加载态 */
  loading: Ref<boolean>;
  /** 值 → 标签；未命中时原样返回该值（便于排查未维护的字典） */
  labelOf: (value: unknown) => string;
  /** 强制重新拉取（绕过缓存） */
  reload: () => Promise<void>;
}

/**
 * 使用字典。
 * @param dictType 字典类型编码
 */
export function useDict(dictType: string): UseDictResult {
  const options = ref<DictDataItem[]>(cache.get(dictType) ?? []);
  const loading = ref(false);

  async function reload(): Promise<void> {
    loading.value = true;
    try {
      clearDictCache(dictType);
      options.value = await loadDict(dictType);
    } finally {
      loading.value = false;
    }
  }

  /** 值 → 标签 */
  function labelOf(value: unknown): string {
    const key = String(value ?? '');
    const hit = options.value.find((item) => item.value === key);
    return hit ? hit.label : key;
  }

  // 首次使用即异步拉取（命中缓存时同步返回，不产生请求）
  void loadDict(dictType).then((list) => {
    options.value = list;
  });

  return { options, loading, labelOf, reload };
}
