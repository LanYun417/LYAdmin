<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';

defineOptions({ name: 'StatCard' });

const props = withDefaults(
  defineProps<{
    /** 标题 */
    title: string;
    /** 数值 */
    value: number | string;
    /** 图标组件 */
    icon?: Component;
    /** 主题色 */
    color?: string;
  }>(),
  {
    color: '#409eff',
  },
);

const displayValue = computed(() => (typeof props.value === 'number' ? props.value.toLocaleString() : props.value));
</script>

<template>
  <el-card shadow="hover" class="stat-card">
    <div class="flex items-center justify-between">
      <div class="stat-info">
        <p class="stat-title">{{ title }}</p>
        <p class="stat-value">{{ displayValue }}</p>
      </div>
      <div class="stat-icon flex-center" :style="{ backgroundColor: color }">
        <el-icon :size="26" color="#fff">
          <component :is="icon" />
        </el-icon>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.stat-card {
  border: none;
}

.stat-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 10px;
}
</style>
