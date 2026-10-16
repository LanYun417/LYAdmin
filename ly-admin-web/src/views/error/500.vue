<script setup lang="ts">
/** 500 服务异常页。模块职责：接口异常（HTTP 500）跳转时的统一落点。 */
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error500' });
</script>

<template>
  <ErrorPage :code="500" type="danger" message="抱歉，服务器开小差了，请稍后重试" />
</template>
