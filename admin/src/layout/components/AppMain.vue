<script setup lang="ts">
import { computed } from 'vue';
import { useTagsViewStore } from '@/store/modules/tagsView';

defineOptions({ name: 'AppMain' });

const tagsViewStore = useTagsViewStore();

/** keep-alive 缓存的组件名列表 */
const cachedViews = computed(() => tagsViewStore.cachedViews);
</script>

<template>
  <section class="app-main">
    <router-view v-slot="{ Component, route: currentRoute }">
      <transition name="fade-transform" mode="out-in">
        <keep-alive :include="cachedViews">
          <component :is="Component" :key="currentRoute.path" />
        </keep-alive>
      </transition>
    </router-view>
  </section>
</template>

<style scoped>
.app-main {
  min-height: 100%;
  padding: 16px;
}

.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.25s;
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
