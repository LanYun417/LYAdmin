/**
 * 表格列显隐配置（按页面持久化到 localStorage）。
 *
 * 为什么需要：宽表（用户、HTTP 日志）列太多，不同角色关心的列不一样——
 * 运维只想看 IP 与耗时，管理员想看部门与角色。让用户自己关掉不关心的列，
 * 比继续横向滚动更好用。
 *
 * 约定：
 * - `fixed: true` 的列不可隐藏（如操作列、账号列），避免用户把关键列关掉后无从恢复；
 * - 配置按 `storageKey` 分页面存储，键名统一带 `ly-admin:columns:` 前缀；
 * - 读取时做「与当前列定义求交集」：列定义删除/改名后陈旧配置不会残留、也不会因缺键而隐藏新列。
 */

export interface TableColumnOption {
  /** 列标识（与页面里的 isVisible('xxx') 对应） */
  key: string;
  /** 列名（设置面板里的文案） */
  label: string;
  /** 固定显示，不可隐藏 */
  fixed?: boolean;
  /** 默认是否显示（不传为 true） */
  defaultVisible?: boolean;
}

/** localStorage 键前缀（统一前缀便于清理与排查） */
const STORAGE_PREFIX = 'ly-admin:columns:';

export function useTableColumns(storageKey: string, columns: TableColumnOption[]) {
  /** 默认可见性（列定义即默认值） */
  function defaults(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    columns.forEach((column) => {
      result[column.key] = column.defaultVisible !== false;
    });
    return result;
  }

  /** 读取已保存配置：只接受当前列定义里存在的键，其余忽略 */
  function load(): Record<string, boolean> {
    const base = defaults();
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
      if (!raw) {
        return base;
      }
      const saved: unknown = JSON.parse(raw);
      if (saved === null || typeof saved !== 'object') {
        return base;
      }
      for (const [key, value] of Object.entries(saved as Record<string, unknown>)) {
        if (key in base && typeof value === 'boolean') {
          base[key] = value;
        }
      }
    } catch {
      // 配置损坏（手工改过 / 隐私模式禁用存储）不该影响页面渲染，退回默认
    }
    return base;
  }

  const visible = ref<Record<string, boolean>>(load());

  /** 持久化（写失败忽略：隐私模式下 localStorage 可能直接抛错） */
  function persist(): void {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(visible.value));
    } catch {
      // 忽略
    }
  }

  /** 该列当前是否显示（未声明的列默认显示，避免漏配导致列消失） */
  function isVisible(key: string): boolean {
    return visible.value[key] !== false;
  }

  /** 设置某列显隐（固定列强制为显示） */
  function setVisible(key: string, value: boolean): void {
    const option = columns.find((column) => column.key === key);
    if (option?.fixed) {
      return;
    }
    visible.value = { ...visible.value, [key]: value };
    persist();
  }

  /** 恢复默认（清掉持久化配置） */
  function reset(): void {
    visible.value = defaults();
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    } catch {
      // 忽略
    }
  }

  /**
   * 整体替换可见性（供列设置组件的 `v-model` 使用）。
   * 会再过滤一遍固定列：组件已禁用勾选，这里兜住"别处传进来的脏数据"。
   */
  function applyVisible(value: Record<string, boolean>): void {
    const next = { ...value };
    columns.forEach((column) => {
      if (column.fixed) {
        next[column.key] = true;
      }
    });
    visible.value = next;
    persist();
  }

  return { columns, visible, isVisible, setVisible, applyVisible, reset };
}
