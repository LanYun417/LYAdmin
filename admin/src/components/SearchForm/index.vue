<script setup lang="ts">
import { BIconArrowClockwise, BIconSearch } from 'bootstrap-icons-vue';

defineOptions({ name: 'SearchForm' });

const emit = defineEmits<{
  (e: 'search'): void;
  (e: 'reset'): void;
}>();

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
        <!-- 高级筛选（如时间范围）：直接常显，不提供折叠 -->
        <slot name="advanced" />
        <el-form-item class="search-buttons">
          <el-button type="primary" :icon="BIconSearch" @click="handleSearch">查询</el-button>
          <el-button :icon="BIconArrowClockwise" @click="handleReset">重置</el-button>
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>
