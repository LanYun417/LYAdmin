<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Close } from '@element-plus/icons-vue';
import { useTagsViewStore, type TagView } from '@/store/modules/tagsView';

defineOptions({ name: 'TagsView' });

const route = useRoute();
const router = useRouter();
const tagsViewStore = useTagsViewStore();

const visitedViews = computed(() => tagsViewStore.visitedViews);

/** 右键上下文菜单状态 */
const contextMenu = reactive({
  visible: false,
  left: 0,
  top: 0,
  view: null as TagView | null,
});

/** 是否当前激活标签 */
function isActive(view: TagView): boolean {
  return view.path === route.path;
}

/** 跳转标签 */
function toView(view: TagView): void {
  void router.push(view.fullPath);
}

/** 关闭标签 */
function closeView(view: TagView): void {
  tagsViewStore.delView(view);
  if (isActive(view)) {
    const rest = visitedViews.value;
    const next = rest[rest.length - 1];
    void router.push(next ? next.fullPath : '/dashboard');
  }
}

/** 打开右键菜单 */
function openContextMenu(event: MouseEvent, view: TagView): void {
  event.preventDefault();
  contextMenu.visible = true;
  contextMenu.left = event.clientX;
  contextMenu.top = event.clientY;
  contextMenu.view = view;
}

/** 关闭右键菜单 */
function closeContextMenu(): void {
  contextMenu.visible = false;
  contextMenu.view = null;
}

/** 关闭其他标签 */
function handleCloseOthers(): void {
  if (contextMenu.view) {
    tagsViewStore.delOthersViews(contextMenu.view);
    if (!isActive(contextMenu.view)) {
      void router.push(contextMenu.view.fullPath);
    }
  }
  closeContextMenu();
}

/** 关闭全部标签 */
function handleCloseAll(): void {
  tagsViewStore.delAllViews();
  void router.push('/dashboard');
  closeContextMenu();
}

/** 关闭当前标签 */
function handleCloseCurrent(): void {
  if (contextMenu.view) {
    closeView(contextMenu.view);
  }
  closeContextMenu();
}

watch(
  () => route.fullPath,
  () => {
    if (route.name && route.meta.hidden !== true) {
      tagsViewStore.addView(route);
    }
  },
  { immediate: true },
);

onMounted(() => {
  document.addEventListener('click', closeContextMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
});
</script>

<template>
  <div class="tags-view flex items-center">
    <el-scrollbar class="tags-scroll">
      <div class="tags-wrap flex items-center">
        <div
          v-for="view in visitedViews"
          :key="view.path"
          class="tags-item"
          :class="{ active: isActive(view) }"
          @click="toView(view)"
          @contextmenu="openContextMenu($event, view)"
        >
          <span class="tags-title">{{ view.title }}</span>
          <el-icon v-if="!view.affix" class="tags-close" @click.stop="closeView(view)">
            <Close />
          </el-icon>
        </div>
      </div>
    </el-scrollbar>

    <div
      v-show="contextMenu.visible"
      class="tags-context-menu"
      :style="{ left: `${contextMenu.left}px`, top: `${contextMenu.top}px` }"
    >
      <div class="context-item" @click="handleCloseCurrent">关闭当前</div>
      <div class="context-item" @click="handleCloseOthers">关闭其他</div>
      <div class="context-item" @click="handleCloseAll">关闭全部</div>
    </div>
  </div>
</template>

<style scoped>
.tags-view {
  height: 40px;
  padding: 0 8px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.tags-scroll {
  width: 100%;
}

.tags-wrap {
  gap: 6px;
  padding: 6px 0;
}

.tags-item {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background-color: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 3px;
}

.tags-item.active {
  color: #fff;
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.tags-close {
  margin-left: 4px;
  font-size: 12px;
}

.tags-close:hover {
  color: var(--el-color-danger);
}

.tags-context-menu {
  position: fixed;
  z-index: 3000;
  min-width: 110px;
  padding: 4px 0;
  background-color: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
  box-shadow: var(--el-box-shadow-light);
}

.context-item {
  padding: 6px 16px;
  font-size: 13px;
  cursor: pointer;
}

.context-item:hover {
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-light);
}
</style>
