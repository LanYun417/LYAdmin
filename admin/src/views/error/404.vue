<script setup lang="ts">
import { useRouter } from 'vue-router';

defineOptions({ name: 'Error404' });

const router = useRouter();

/** 返回首页 */
function goHome(): void {
  void router.push('/home');
}
</script>

<template>
  <div class="w-full h-full flex-center">
    <div class="text-center">
      <h1 class="text-[96px] font-bold text-primary">404</h1>
      <p class="mt-3 mb-6 text-base text-muted">抱歉，你访问的页面不存在</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>
