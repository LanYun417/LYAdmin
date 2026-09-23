import { ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router';

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

export const useTagsViewStore = defineStore(
  'tagsView',
  () => {
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

    /**
     * 依据已注册路由补齐固定标签，并保证其始终排在最前。
     *
     * 背景：visitedViews 不做持久化，刷新后为空；而普通标签只在路由被真实访问时才添加。
     * 因此在非首页刷新时，首页标签因「本次会话未访问过」而缺失。
     * 这里改为从路由表反查所有 affix 路由，主动补齐并置顶，使首页标签刷新后依然常驻且在第一位。
     *
     * @param routes 已注册的路由表（router.getRoutes()）
     */
    function ensureAffixViews(routes: RouteRecordNormalized[]): void {
      const affixRoutes = routes.filter((route) => route.meta?.affix && route.name);
      if (affixRoutes.length === 0) {
        return;
      }

      // 补齐缺失的固定标签
      affixRoutes.forEach((route) => {
        const name = String(route.name);
        const path = route.path;
        const existing = visitedViews.value.find((view) => view.path === path);
        if (existing) {
          existing.affix = true;
          return;
        }
        visitedViews.value.push({
          name,
          path,
          fullPath: path,
          title: (route.meta.title as string) || name,
          affix: true,
        });
      });

      // 固定标签置顶（保持其在路由表中的相对次序），其余标签维持原有顺序
      const affixPaths = new Set(affixRoutes.map((route) => route.path));
      const affixViews: TagView[] = [];
      const restViews: TagView[] = [];
      visitedViews.value.forEach((view) => {
        if (view.affix || affixPaths.has(view.path)) {
          affixViews.push(view);
        } else {
          restViews.push(view);
        }
      });
      const orderOf = (view: TagView): number => {
        const index = affixRoutes.findIndex((route) => route.path === view.path);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
      };
      affixViews.sort((a, b) => orderOf(a) - orderOf(b));
      visitedViews.value = [...affixViews, ...restViews];
    }

    /** 关闭指定标签 */
    function delView(view: TagView): void {
      // 固定标签（如首页）不可关闭
      if (view.affix) {
        return;
      }
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
      ensureAffixViews,
      updateVisitedView,
      delView,
      delOthersViews,
      delAllViews,
    };
  },
  {
    // 将标签页与 keep-alive 缓存持久化到 localStorage，刷新后恢复
    persist: {
      key: 'ly_admin_tags',
      pick: ['visitedViews', 'cachedViews'],
    },
  },
);
