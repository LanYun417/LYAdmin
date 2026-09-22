<script setup lang="ts">
import { useRouter } from 'vue-router';

defineOptions({ name: 'Error500' });

const router = useRouter();

/** 返回首页 */
function goHome(): void {
  void router.push('/dashboard');
}
</script>

<template>
  <div class="error-page flex-center">
    <div class="error-content">
      <h1 class="error-code">500</h1>
      <p class="error-message">抱歉，服务器开小差了，请稍后重试</p>
      <el-button type="primary" @click="goHome">返回首页</el-button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  width: 100%;
  height: 100%;
}

.error-content {
  text-align: center;
}

.error-code {
  font-size: 96px;
  font-weight: 700;
  color: var(--el-color-danger);
}

.error-message {
  margin: 12px 0 24px;
  font-size: 16px;
  color: var(--el-text-color-secondary);
}
</style>
