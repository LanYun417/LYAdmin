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

interface TagsViewState {
  /** 已访问的标签 */
  visitedViews: TagView[];
  /** 需要 keep-alive 缓存的组件名 */
  cachedViews: string[];
}

export const useTagsViewStore = defineStore('tagsView', {
  state: (): TagsViewState => ({
    visitedViews: [],
    cachedViews: [],
  }),

  actions: {
    /** 新增标签（访问页面时调用） */
    addView(route: RouteLocationNormalizedLoaded): void {
      this.addVisitedView(route);
      this.addCachedView(route);
    },

    /** 新增已访问标签 */
    addVisitedView(route: RouteLocationNormalizedLoaded): void {
      if (!route.name) {
        return;
      }
      const name = String(route.name);
      if (this.visitedViews.some((view) => view.path === route.path)) {
        return;
      }
      this.visitedViews.push({
        name,
        path: route.path,
        fullPath: route.fullPath,
        title: (route.meta.title as string) || name,
        affix: Boolean(route.meta.affix),
      });
    },

    /** 新增缓存标签 */
    addCachedView(route: RouteLocationNormalizedLoaded): void {
      if (!route.meta.keepAlive || !route.name) {
        return;
      }
      const name = String(route.name);
      if (!this.cachedViews.includes(name)) {
        this.cachedViews.push(name);
      }
    },

    /** 更新已访问标签的完整路径 */
    updateVisitedView(route: RouteLocationNormalizedLoaded): void {
      const target = this.visitedViews.find((view) => view.path === route.path);
      if (target) {
        target.fullPath = route.fullPath;
      }
    },

    /** 关闭指定标签 */
    delView(view: TagView): void {
      this.visitedViews = this.visitedViews.filter((item) => item.path !== view.path);
      this.cachedViews = this.cachedViews.filter((name) => name !== view.name);
    },

    /** 关闭其他标签（保留固定标签与当前标签） */
    delOthersViews(view: TagView): void {
      this.visitedViews = this.visitedViews.filter((item) => item.affix || item.path === view.path);
      this.cachedViews = this.cachedViews.filter((name) => name === view.name);
    },

    /** 关闭全部标签（保留固定标签） */
    delAllViews(): void {
      this.visitedViews = this.visitedViews.filter((item) => item.affix);
      this.cachedViews = [];
    },
  },
});
