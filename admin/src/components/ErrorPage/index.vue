<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';

defineOptions({ name: 'ErrorPage' });

const props = withDefaults(
  defineProps<{
    /** 状态码（展示在页面中央） */
    code: number | string;
    /** 提示文案 */
    message: string;
    /** 状态码配色（对应 Element Plus 语义色） */
    type?: 'primary' | 'warning' | 'danger';
  }>(),
  {
    type: 'primary',
  },
);

/** 状态码配色类名：显式列出完整类名，避免动态拼接导致 Tailwind 扫描遗漏。 */
const CODE_COLOR_CLASS = {
  primary: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

const codeColorClass = computed(() => CODE_COLOR_CLASS[props.type]);

const router = useRouter();

/** 返回首页 */
function goHome(): void {
  void router.push('/home');
}
</script>

<template>
  <div class="w-full h-full flex-center">
    <div class="text-center">
      <h1 class="text-[96px] font-bold" :class="codeColorClass">{{ code }}</h1>
      <p class="mt-3 mb-6 text-base text-muted">{{ message }}</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>
