<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
    void router.push(next ? next.fullPath : '/home');
  }
}

/**
 * 离场标签脱离文档流（position: absolute）后，flex 容器会把它按
 * 「唯一 flex 项」的规则重置到起点，导致原地淡出失效。
 * 在脱离文档流前把当前坐标钉死为内联 left/top，让被关标签
 * 原地淡出，右侧标签才能获得正确的 FLIP 左移递进。
 */
function pinLeavingTag(el: Element): void {
  const elm = el as HTMLElement;
  const { offsetLeft, offsetTop } = elm;
  elm.style.left = `${offsetLeft}px`;
  elm.style.top = `${offsetTop}px`;
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
  void router.push('/home');
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
  // 刷新后从已注册路由补齐固定标签（如首页），保证其常驻并显示在第一个位置
  tagsViewStore.ensureAffixViews(router.getRoutes());
  document.addEventListener('click', closeContextMenu);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeContextMenu);
});
</script>

<template>
  <div class="tags-view flex items-center">
    <el-scrollbar class="tags-scroll">
      <TransitionGroup tag="div" name="tag" class="tags-wrap flex items-center" @before-leave="pinLeavingTag">
        <el-tag
          v-for="view in visitedViews"
          :key="view.path"
          class="tags-item"
          :class="{ active: isActive(view) }"
          :type="isActive(view) ? 'primary' : 'info'"
          :effect="isActive(view) ? 'dark' : 'light'"
          :closable="!view.affix"
          :disable-transitions="true"
          @click="toView(view)"
          @close="closeView(view)"
          @contextmenu="openContextMenu($event, view)"
        >
          {{ view.title }}
        </el-tag>
      </TransitionGroup>
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
  padding: 0 5px;
  border-bottom: 1px solid var(--el-border-color-light);
}

.tags-scroll {
  width: 100%;
}

.tags-wrap {
  position: relative;
  gap: 6px;
  padding: 5px 0;
}

.tags-item {
  height: 26px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 3px;
  box-shadow: var(--el-box-shadow-lighter);
}

/* ============================================================
 * 标签页关闭 → 右侧标签左移递进（FLIP move 动画）
 * - 触发：visitedViews 数组移除元素（点 × / 右键关闭当前 /
 *   关闭其他 / 关闭全部），TransitionGroup 在 DOM 移除时挂类；
 * - 位移：右侧每个标签沿 X 轴左移「原位置 − 新位置」的距离
 *   （= 被关标签宽 + 6px gap），由 FLIP 实测，不硬编码；
 * - 缓动/时长：递进 0.25s cubic-bezier(0.4,0,0.2,1)（快出缓收）；
 *   被关标签原地 0.15s ease-out 淡出并缩小，先于递进结束，
 *   避免残影与滑动中的标签互相遮挡。
 * ========================================================== */
.tag-move {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag-leave-active {
  position: absolute;
  transition:
    opacity 0.15s ease-out,
    transform 0.15s ease-out;
}

.tag-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

/* 新开标签：从右侧轻微滑入淡现（刷新恢复走初始挂载，不触发） */
.tag-enter-active {
  transition:
    opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.tag-enter-from {
  opacity: 0;
  transform: translateX(10px);
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
