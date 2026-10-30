<script setup lang="ts">
/**
 * 表格列设置（下拉面板 + 复选框）。
 *
 * 用法：
 * ```vue
 * const { columnOptions, isVisible, visible, setVisible, reset } = useTableColumns('system-user', [...]);
 * <ColumnSettings :columns="columnOptions" :model-value="visible" @update:model-value="setVisible" @reset="reset" />
 * ```
 *
 * 设计要点：
 * - `fixed` 列（如操作列）禁用勾选而不是隐藏后消失，用户能看到"它一直都在"；
 * - 面板内带「重置」入口：关掉太多列以后得有一条回到默认的路；
 * - 不直接操作 localStorage：持久化由 `useTableColumns` 负责，组件只做展示与事件上抛。
 */
import type { TableColumnOption } from '@/composables/useTableColumns';

const props = defineProps<{
  /** 列定义 */
  columns: TableColumnOption[];
  /** 各列显隐状态（v-model） */
  modelValue: Record<string, boolean>;
}>();

const emit = defineEmits<{
  /** 某列显隐变化 */
  (event: 'update:modelValue', value: Record<string, boolean>): void;
  /** 恢复默认 */
  (event: 'reset'): void;
}>();

/** 切换某列可见性（固定列忽略） */
function toggle(option: TableColumnOption, value: boolean): void {
  if (option.fixed) {
    return;
  }
  emit('update:modelValue', { ...props.modelValue, [option.key]: value });
}

/** 是否勾选（未声明的列默认显示） */
function isChecked(option: TableColumnOption): boolean {
  return props.modelValue[option.key] !== false;
}
</script>

<template>
  <el-popover placement="bottom-end" trigger="click" :width="220">
    <template #reference>
      <el-button title="列设置">
        <template #icon><i class="bi bi-sliders" /></template>
        列设置
      </el-button>
    </template>

    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-medium text-ink">显示列</span>
      <el-button type="primary" link size="small" @click="emit('reset')">重置</el-button>
    </div>
    <!-- 列表超长时用 el-scrollbar 接管滚动（与全局内容区一致），避免面板里出现原生滚动条 -->
    <el-scrollbar max-height="256px">
      <el-checkbox
        v-for="option in columns"
        :key="option.key"
        class="flex w-full"
        :model-value="isChecked(option)"
        :disabled="option.fixed"
        :title="option.fixed ? '该列固定显示，不可隐藏' : ''"
        @update:model-value="(value: boolean | string | number) => toggle(option, Boolean(value))"
      >
        {{ option.label }}
      </el-checkbox>
    </el-scrollbar>
  </el-popover>
</template>
