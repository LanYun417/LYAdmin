<script setup lang="ts">
/** 403 无权限页。模块职责：路由权限校验失败（含接口 403 跳转）后的统一落点。 */
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error403' });
</script>

<template>
  <ErrorPage :code="403" message="抱歉，你没有访问该页面的权限" />
</template>
