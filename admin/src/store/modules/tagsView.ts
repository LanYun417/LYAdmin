import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

/** 标签页项 */
export interface TagView {
  /** 路由名（用于 keep-alive include） */
  name: string;
  /** 路由路径（唯一标识） */
  path: string;
  /** 完整路径（含 query） */
  fullPath: string;
  /** 标题 */
  title: string;
  /** 是否固定不可关闭 */
  affix?: boolean;
}

export const useTagsViewStore = defineStore('tagsView', () => {
  /** 已访问的标签 */
  const visitedViews = ref<TagView[]>([]);
  /** 需要 keep-alive 缓存的组件名 */
  const cachedViews = ref<string[]>([]);

  /** 新增已访问标签 */
  function addVisitedView(route: RouteLocationNormalizedLoaded): void {
    if (!route.name) {
      return;
    }
    const name = String(route.name);
    if (visitedViews.value.some((view) => view.path === route.path)) {
      return;
    }
    visitedViews.value.push({
      name,
      path: route.path,
      fullPath: route.fullPath,
      title: (route.meta.title as string) || name,
      affix: Boolean(route.meta.affix),
    });
  }

  /** 新增缓存标签 */
  function addCachedView(route: RouteLocationNormalizedLoaded): void {
    if (!route.meta.keepAlive || !route.name) {
      return;
    }
    const name = String(route.name);
    if (!cachedViews.value.includes(name)) {
      cachedViews.value.push(name);
    }
  }

  /** 新增标签（访问页面时调用） */
  function addView(route: RouteLocationNormalizedLoaded): void {
    addVisitedView(route);
    addCachedView(route);
  }

  /** 更新已访问标签的完整路径 */
  function updateVisitedView(route: RouteLocationNormalizedLoaded): void {
    const target = visitedViews.value.find((view) => view.path === route.path);
    if (target) {
      target.fullPath = route.fullPath;
    }
  }

  /** 关闭指定标签 */
  function delView(view: TagView): void {
    visitedViews.value = visitedViews.value.filter((item) => item.path !== view.path);
    cachedViews.value = cachedViews.value.filter((name) => name !== view.name);
  }

  /** 关闭其他标签（保留固定标签与当前标签） */
  function delOthersViews(view: TagView): void {
    visitedViews.value = visitedViews.value.filter((item) => item.affix || item.path === view.path);
    cachedViews.value = cachedViews.value.filter((name) => name === view.name);
  }

  /** 关闭全部标签（保留固定标签） */
  function delAllViews(): void {
    visitedViews.value = visitedViews.value.filter((item) => item.affix);
    cachedViews.value = [];
  }

  return {
    visitedViews,
    cachedViews,
    addView,
    addVisitedView,
    addCachedView,
    updateVisitedView,
    delView,
    delOthersViews,
    delAllViews,
  };
});
