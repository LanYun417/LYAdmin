<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { ArrowDown, ArrowUp, Refresh, Search } from '@element-plus/icons-vue';

defineOptions({ name: 'SearchForm' });

const props = withDefaults(
  defineProps<{
    /** 是否启用折叠（需配合 advanced 插槽） */
    collapsible?: boolean;
    /** 默认是否折叠 */
    defaultCollapsed?: boolean;
  }>(),
  {
    collapsible: true,
    defaultCollapsed: false,
  },
);

const emit = defineEmits<{
  (e: 'search'): void;
  (e: 'reset'): void;
}>();

const slots = useSlots();
const collapsed = ref(props.defaultCollapsed);

/** 是否存在高级筛选插槽 */
const hasAdvanced = computed(() => Boolean(slots.advanced));

/** 切换折叠 */
function toggle(): void {
  collapsed.value = !collapsed.value;
}

/** 触发查询 */
function handleSearch(): void {
  emit('search');
}

/** 触发重置 */
function handleReset(): void {
  emit('reset');
}
</script>

<template>
  <div class="search-form">
    <el-form :inline="true" @submit.prevent>
      <div class="search-fields flex flex-wrap items-center gap-x-2">
        <slot />
        <template v-if="hasAdvanced">
          <div v-show="!collapsed" class="flex flex-wrap items-center gap-x-2">
            <slot name="advanced" />
          </div>
        </template>
        <el-form-item class="search-buttons">
          <el-button type="primary" :icon="Search" @click="handleSearch">查询</el-button>
          <el-button :icon="Refresh" @click="handleReset">重置</el-button>
          <el-button v-if="collapsible && hasAdvanced" link type="primary" @click="toggle">
            {{ collapsed ? '展开' : '收起' }}
            <el-icon>
              <ArrowDown v-if="collapsed" />
              <ArrowUp v-else />
            </el-icon>
          </el-button>
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>
