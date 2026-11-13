<script setup lang="ts">
/**
 * 标签栏最右侧「搜索菜单」入口：一个搜索图标按钮 + 搜索弹窗。
 * 数据取已注册路由中「有标题且未隐藏」的页面菜单（排除带参动态路由），
 * 支持按中文名 / 英文名（menuNameEn）模糊搜索，展示跟随当前语言，点击即跳转。
 */
import { useRouter } from 'vue-router';
import type { InputInstance } from 'element-plus';
import type { AppRouteMeta } from '@/types/router';
import { pickLocaleText } from '@/utils/i18nText';
import BasicDialog from '@/components/BasicDialog/index.vue';

defineOptions({ name: 'MenuSearch' });

const router = useRouter();

interface MenuSearchItem {
  path: string;
  title: string;
  titleEn?: string;
  icon?: string;
}

const visible = ref(false);
const keyword = ref('');
const inputRef = ref<InputInstance>();

/** 全部可搜索的页面菜单（有标题、未隐藏、非带参路由）。 */
const allMenus = computed<MenuSearchItem[]>(() =>
  router
    .getRoutes()
    .filter((route) => {
      const meta = route.meta as AppRouteMeta | undefined;
      return Boolean(meta?.title) && meta!.hidden !== true && !route.path.includes(':');
    })
    .map((route) => {
      const meta = route.meta as AppRouteMeta;
      return {
        path: route.path,
        title: meta.title as string,
        titleEn: meta.titleEn,
        icon: meta.icon,
      };
    }),
);

/** 按关键字过滤（中 / 英文名，不区分大小写）；无关键字时列出全部（限 50 条）。 */
const results = computed<MenuSearchItem[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) {
    return allMenus.value.slice(0, 50);
  }
  return allMenus.value.filter(
    (item) => item.title.toLowerCase().includes(kw) || (item.titleEn ?? '').toLowerCase().includes(kw),
  );
});

/** 打开弹窗并聚焦输入框 */
function open(): void {
  visible.value = true;
  keyword.value = '';
  nextTick(() => inputRef.value?.focus());
}

/** 跳转到目标菜单 */
function go(item: MenuSearchItem): void {
  visible.value = false;
  void router.push(item.path);
}

/** 回车进入第一条结果 */
function onEnter(): void {
  const first = results.value[0];
  if (first) {
    go(first);
  }
}
</script>

<template>
  <el-tooltip content="搜索页面" placement="bottom" :show-after="300">
    <button type="button" class="menu-search-btn" aria-label="搜索页面" @click="open">
      <i class="bi bi-search" aria-hidden="true" />
    </button>
  </el-tooltip>

  <BasicDialog v-model="visible" title="搜索页面" width="560px" :show-footer="false">
    <el-input
      ref="inputRef"
      v-model="keyword"
      placeholder="输入菜单名称搜索（支持中 / 英文）"
      clearable
      @keyup.enter="onEnter"
    >
      <template #prefix><i class="bi bi-search" aria-hidden="true" /></template>
    </el-input>
    <div class="menu-search-results">
      <div v-for="item in results" :key="item.path" class="menu-search-item" @click="go(item)">
        <i v-if="item.icon" class="bi" :class="`bi-${item.icon}`" aria-hidden="true" />
        <span class="menu-search-name">{{ pickLocaleText(item.title, item.titleEn) }}</span>
        <span class="menu-search-path">{{ item.path }}</span>
      </div>
      <el-empty v-if="results.length === 0" description="无匹配菜单" :image-size="60" />
    </div>
  </BasicDialog>
</template>

<style scoped>
.menu-search-btn {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  margin-left: 6px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 4px;
}

.menu-search-btn:hover {
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-light);
}

.menu-search-results {
  max-height: 320px;
  margin-top: 10px;
  overflow-y: auto;
}

.menu-search-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
}

.menu-search-item:hover {
  color: var(--el-color-primary);
  background-color: var(--el-fill-color-light);
}

.menu-search-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.menu-search-path {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
