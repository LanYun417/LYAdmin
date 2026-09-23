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

/** 图标底色：主题色 12% 透明度柔和色块（color 需为 6 位 hex） */
const iconBg = computed(() => (/^#[0-9a-f]{6}$/i.test(props.color) ? `${props.color}1f` : props.color));
</script>

<template>
  <div class="stat-card">
    <div class="flex items-center justify-between">
      <div class="stat-info">
        <p class="stat-title">{{ title }}</p>
        <p class="stat-value">{{ displayValue }}</p>
      </div>
      <div class="stat-icon flex-center" :style="{ backgroundColor: iconBg, color: color }">
        <el-icon :size="24"><component :is="icon" /></el-icon>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  padding: 20px;
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  transition:
    box-shadow 0.25s ease,
    transform 0.25s ease,
    border-color 0.25s ease;
}

.stat-card:hover {
  border-color: transparent;
  box-shadow: var(--el-box-shadow-light);
  transform: translateY(-2px);
}

.stat-title {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.stat-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-primary);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
}
</style>
