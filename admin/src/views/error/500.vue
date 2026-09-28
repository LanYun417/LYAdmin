<script setup lang="ts">
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error500' });
</script>

<template>
  <ErrorPage :code="500" type="danger" message="抱歉，服务器开小差了，请稍后重试" />
</template>
