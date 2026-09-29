<script setup lang="ts">
/** 指标统计卡片。模块职责：展示单个指标的名称、数值与主题色图标。 */
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
  <div
    class="p-5 bg-surface border border-line-lighter rounded-[10px] transition duration-[250ms] hover:-translate-y-0.5 hover:border-transparent hover:shadow-el-light"
  >
    <div class="flex items-center justify-between">
      <div>
        <p class="text-[13px] text-muted">{{ title }}</p>
        <p class="mt-2 text-[26px] font-bold tabular-nums text-ink">{{ displayValue }}</p>
      </div>
      <div class="w-12 h-12 rounded-xl flex-center" :style="{ backgroundColor: iconBg, color: color }">
        <el-icon :size="24" aria-hidden="true"><component :is="icon" /></el-icon>
      </div>
    </div>
  </div>
</template>
