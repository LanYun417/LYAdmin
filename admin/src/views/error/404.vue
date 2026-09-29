<script setup lang="ts">
/** 404 页面不存在页。模块职责：未匹配到任何路由时的兜底页。 */
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error404' });
</script>

<template>
  <ErrorPage :code="404" message="抱歉，你访问的页面不存在" />
</template>
