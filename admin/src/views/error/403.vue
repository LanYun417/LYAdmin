<script setup lang="ts">
import ErrorPage from '@/components/ErrorPage/index.vue';

defineOptions({ name: 'Error403' });
</script>

<template>
  <ErrorPage :code="403" message="抱歉，你没有访问该页面的权限" />
</template>
