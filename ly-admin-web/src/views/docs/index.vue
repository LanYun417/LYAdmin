<script setup lang="ts">
/**
 * 接口文档页。
 * 模块职责：拉取后端构建期生成的接口清单（`GET /api/docs`），渲染为「左侧接口导航 +
 * 右侧接口详情」的可检索文档页；纯只读展示，不涉及任何写操作。
 *
 * 数据来源：后端 `scripts/gen-api-docs.mjs` 扫描控制器生成的 JSON，因此本页展示的
 * 路由、权限码、说明始终与代码一致，无需手工维护。
 * 组件化：整页以 Element Plus 组件搭建（el-card / el-scrollbar / el-collapse / el-tag /
 * el-input / el-descriptions / el-alert / el-empty …），方法等标记一律用 el-tag。
 */

import { ElMessage } from '@/utils/element';
import { getApiDocsApi } from '@/api/docs';
import type { ApiDocEndpoint, ApiDocGroup } from '@/types/docs';

defineOptions({ name: 'Docs' });

/** 单个接口条目 + 所属模块（选中态用） */
interface SelectedEndpoint {
  group: string;
  endpoint: ApiDocEndpoint;
}

/** HTTP 方法 → Element Plus Tag 类型 */
const METHOD_TAG_TYPE: Record<string, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  GET: 'primary',
  POST: 'success',
  PUT: 'warning',
  PATCH: 'warning',
  DELETE: 'danger',
};

/** 全部接口分组 */
const groups = ref<ApiDocGroup[]>([]);
/** 接口总数 */
const total = ref(0);
/** 文档生成时间（ISO 8601） */
const generatedAt = ref('');
/** 加载态 */
const loading = ref(false);
/** 搜索关键字（匹配路径 / 说明 / 权限码） */
const keyword = ref('');
/** 左侧折叠面板展开的模块名 */
const activeGroups = ref<string[]>([]);
/** 当前选中的接口 */
const selected = ref<SelectedEndpoint | null>(null);

/** 按搜索词过滤后的分组（组内全部不命中则隐藏该组） */
const filteredGroups = computed<ApiDocGroup[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) {
    return groups.value;
  }
  return groups.value
    .map((group) => ({
      group: group.group,
      endpoints: group.endpoints.filter(
        (ep) =>
          ep.path.toLowerCase().includes(kw) ||
          ep.summary.toLowerCase().includes(kw) ||
          ep.permission.some((code) => code.toLowerCase().includes(kw)),
      ),
    }))
    .filter((group) => group.endpoints.length > 0);
});

/** 文档生成时间的展示文案 */
const generatedText = computed(() => {
  if (!generatedAt.value) {
    return '';
  }
  const date = new Date(generatedAt.value);
  return Number.isNaN(date.getTime()) ? generatedAt.value : date.toLocaleString();
});

/** 默认展开全部模块（搜索时同样展开命中的模块），保证一眼能看到全部接口 */
watch(
  filteredGroups,
  (list) => {
    activeGroups.value = list.map((group) => group.group);
  },
  { immediate: true },
);

/** HTTP 方法 → Element Plus Tag 类型 */
function methodTagType(method: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  return METHOD_TAG_TYPE[method] ?? 'info';
}

/** 是否当前选中项 */
function isSelected(group: string, endpoint: ApiDocEndpoint): boolean {
  const current = selected.value;
  return (
    current?.group === group && current.endpoint.path === endpoint.path && current.endpoint.method === endpoint.method
  );
}

/** 选中某分组下的接口 */
function select(group: string, endpoint: ApiDocEndpoint): void {
  selected.value = { group, endpoint };
}

/** 复制路径到剪贴板 */
async function copyPath(path: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(path);
    ElMessage.success('已复制路径');
  } catch {
    ElMessage.error('复制失败，请手动复制');
  }
}

/** 加载接口清单 */
async function loadDocs(): Promise<void> {
  loading.value = true;
  try {
    const data = await getApiDocsApi();
    groups.value = data.groups ?? [];
    total.value = data.total ?? 0;
    generatedAt.value = data.generatedAt ?? '';
    // 默认选中第一个接口，避免右侧空白
    const first = groups.value[0]?.endpoints[0];
    selected.value = first ? { group: groups.value[0].group, endpoint: first } : null;
  } finally {
    loading.value = false;
  }
}

onMounted(loadDocs);
</script>

<template>
  <el-card v-loading="loading" shadow="never" class="docs-card">
    <template #header>
      <div class="docs-header">
        <div class="docs-title">
          <el-text tag="b" size="large">接口文档</el-text>
          <el-tag type="info" effect="plain">{{ total }} 个接口</el-tag>
          <el-tag type="info" effect="plain">{{ groups.length }} 个模块</el-tag>
          <el-text v-if="generatedText" type="info" size="small">生成于 {{ generatedText }}</el-text>
        </div>
        <el-input v-model="keyword" class="docs-search" clearable placeholder="搜索路径 / 说明 / 权限码" />
      </div>
    </template>

    <div class="docs-body">
      <!-- 左侧：按模块折叠的接口导航 -->
      <aside class="docs-nav">
        <el-scrollbar v-if="filteredGroups.length" class="nav-scroll">
          <el-collapse v-model="activeGroups" class="docs-collapse">
            <el-collapse-item v-for="group in filteredGroups" :key="group.group" :name="group.group">
              <template #title>
                <span class="group-title">{{ group.group }}</span>
                <el-tag size="small" type="info" effect="plain" round>{{ group.endpoints.length }}</el-tag>
              </template>
              <button
                v-for="ep in group.endpoints"
                :key="`${ep.method} ${ep.path}`"
                type="button"
                class="nav-item"
                :class="{ 'is-active': isSelected(group.group, ep) }"
                @click="select(group.group, ep)"
              >
                <el-tag :type="methodTagType(ep.method)" size="small" effect="dark" class="method-tag">
                  {{ ep.method }}
                </el-tag>
                <span class="nav-path">{{ ep.path }}</span>
                <el-tag v-if="ep.isPublic" type="success" size="small" effect="plain">公开</el-tag>
              </button>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
        <el-empty v-else :description="keyword ? '没有匹配的接口' : '暂无接口数据'" />
      </aside>

      <!-- 右侧：接口详情 -->
      <main class="docs-detail">
        <el-scrollbar v-if="selected" class="detail-scroll">
          <div class="detail-inner">
            <div class="detail-head">
              <el-tag :type="methodTagType(selected.endpoint.method)" effect="dark" size="large" class="method-tag-lg">
                {{ selected.endpoint.method }}
              </el-tag>
              <el-input :model-value="selected.endpoint.path" readonly class="detail-url">
                <template #append>
                  <el-button @click="copyPath(selected.endpoint.path)">复制</el-button>
                </template>
              </el-input>
            </div>

            <el-text class="detail-summary">{{ selected.endpoint.summary || '（该接口暂无说明）' }}</el-text>

            <el-descriptions :column="2" border>
              <el-descriptions-item label="所属模块">{{ selected.group }}</el-descriptions-item>
              <el-descriptions-item label="访问要求">
                <el-tag v-if="selected.endpoint.isPublic" type="success" effect="plain">公开（无需登录）</el-tag>
                <el-tag v-else-if="!selected.endpoint.permission.length" type="warning" effect="plain">
                  登录即可访问
                </el-tag>
                <el-tag v-else type="danger" effect="plain">需权限码</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="权限码" :span="2">
                <template v-if="selected.endpoint.permission.length">
                  <el-tag
                    v-for="code in selected.endpoint.permission"
                    :key="code"
                    type="info"
                    effect="plain"
                    class="perm-tag"
                  >
                    {{ code }}
                  </el-tag>
                </template>
                <el-text v-else type="info">—</el-text>
              </el-descriptions-item>
              <el-descriptions-item v-if="selected.endpoint.action" label="操作日志" :span="2">
                {{ selected.endpoint.action }}
              </el-descriptions-item>
            </el-descriptions>

            <el-alert
              class="detail-tip"
              type="info"
              :closable="false"
              show-icon
              title="所有成功响应恒为 HTTP 200，响应体统一为 { code, message, data }。"
            />
          </div>
        </el-scrollbar>
        <el-empty v-else description="请从左侧选择一个接口" />
      </main>
    </div>
  </el-card>
</template>

<style scoped>
.docs-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.docs-title {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.docs-search {
  width: 260px;
}

/* 主体固定为视口高度，左右两栏各自滚动，避免整页被上百个接口拉得很长 */
.docs-body {
  display: flex;
  gap: 16px;
  height: calc(100vh - 220px);
  min-height: 420px;
}

/* 左侧导航 */
.docs-nav {
  flex: 0 0 340px;
  padding-right: 8px;
  border-right: 1px solid var(--el-border-color-lighter);
}

.nav-scroll,
.detail-scroll {
  height: 100%;
}

/* 折叠面板去边框、透明底，贴合导航观感（借助 EP CSS 变量，无需穿透内部样式） */
.docs-collapse {
  --el-collapse-border-color: transparent;
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
}

.group-title {
  margin-right: 8px;
  font-weight: 600;
}

.nav-item {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
  padding: 6px 8px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  border-radius: 6px;
  transition: background-color 0.15s;
}

.nav-item:hover {
  background: var(--el-fill-color-light);
}

.nav-item.is-active {
  background: var(--el-color-primary-light-9);
}

/* 方法标签统一宽度，视觉对齐 */
.method-tag,
.method-tag-lg {
  justify-content: center;
  width: 58px;
  font-family: var(--el-font-family-mono, monospace);
}

.method-tag-lg {
  width: 68px;
  font-size: 13px;
}

.nav-path {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
  white-space: nowrap;
}

/* 右侧详情 */
.docs-detail {
  flex: 1;
  min-width: 0;
}

.detail-inner {
  padding-right: 8px;
}

.detail-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.detail-url {
  flex: 1;
}

.detail-summary {
  display: block;
  margin-bottom: 16px;
  line-height: 1.7;
}

.perm-tag {
  margin: 2px 6px 2px 0;
}

.detail-tip {
  margin-top: 16px;
}
</style>
