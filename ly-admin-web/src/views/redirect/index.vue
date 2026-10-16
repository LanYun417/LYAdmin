<script setup lang="ts">
/**
 * 重定向中转页。
 * 模块职责：读取 `/:path(.*)` 路由参数后立即 replace 到目标路径，
 * 供 keep-alive 页面在不整页刷新的前提下强制重建组件。
 */

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
