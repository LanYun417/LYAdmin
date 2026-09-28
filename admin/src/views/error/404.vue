<script setup lang="ts">
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error404' });
</script>

<template>
  <ErrorPage :code="404" message="抱歉，你访问的页面不存在" />
</template>
