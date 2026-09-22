<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

defineOptions({ name: 'Redirect' });

const route = useRoute();
const router = useRouter();

const { params, query } = route;
const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path ?? '');

// 中转重定向：用于 keep-alive 页面的强制刷新
void router.replace({ path: `/${path}`, query });
</script>

<template>
  <div />
</template>
