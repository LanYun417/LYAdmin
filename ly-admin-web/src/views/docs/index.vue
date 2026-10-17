<script setup lang="ts">
/**
 * 接口文档页。
 * 模块职责：拉取后端构建期生成的接口清单（`GET /api/docs`），渲染为「左侧接口导航 +
 * 右侧接口详情」的可检索文档页；纯只读展示，不涉及任何写操作。
 *
 * 数据来源：后端 `scripts/gen-api-docs.mjs` 扫描控制器生成的 JSON，因此本页展示的
 * 路由、权限码、说明始终与代码一致，无需手工维护。
 */

import { ElMessage } from '@/utils/element';
import { getApiDocsApi } from '@/api/docs';
import type { ApiDocEndpoint, ApiDocGroup } from '@/types/docs';

defineOptions({ name: 'Docs' });

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
/** 当前选中的接口（含所属模块名） */
const selected = ref<{ group: string; endpoint: ApiDocEndpoint } | null>(null);

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

/** HTTP 方法 → 徽标样式类 */
function methodClass(method: string): string {
  return `method-${method.toLowerCase()}`;
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
          <span class="title-text">接口文档</span>
          <el-tag size="small" type="info" effect="plain">{{ total }} 个接口</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ groups.length }} 个模块</el-tag>
          <span v-if="generatedText" class="docs-generated">生成于 {{ generatedText }}</span>
        </div>
        <el-input v-model="keyword" class="docs-search" clearable placeholder="搜索路径 / 说明 / 权限码" />
      </div>
    </template>

    <div class="docs-body">
      <!-- 左侧：接口导航 -->
      <aside class="docs-nav">
        <template v-if="filteredGroups.length">
          <div v-for="group in filteredGroups" :key="group.group" class="nav-group">
            <div class="nav-group-title">{{ group.group }}</div>
            <button
              v-for="ep in group.endpoints"
              :key="`${ep.method} ${ep.path}`"
              type="button"
              class="nav-item"
              :class="{
                'is-active': selected?.endpoint.path === ep.path && selected?.endpoint.method === ep.method,
              }"
              @click="select(group.group, ep)"
            >
              <span class="method-badge" :class="methodClass(ep.method)">{{ ep.method }}</span>
              <span class="nav-path">{{ ep.path }}</span>
              <span v-if="ep.isPublic" class="nav-flag">公开</span>
            </button>
          </div>
        </template>
        <el-empty v-else :description="keyword ? '没有匹配的接口' : '暂无接口数据'" />
      </aside>

      <!-- 右侧：接口详情 -->
      <main class="docs-detail">
        <template v-if="selected">
          <div class="detail-path">
            <span class="method-badge lg" :class="methodClass(selected.endpoint.method)">
              {{ selected.endpoint.method }}
            </span>
            <code class="detail-url">{{ selected.endpoint.path }}</code>
            <el-button size="small" text @click="copyPath(selected.endpoint.path)">复制</el-button>
          </div>

          <p class="detail-summary">{{ selected.endpoint.summary || '（该接口暂无说明）' }}</p>

          <el-descriptions :column="2" border class="detail-meta">
            <el-descriptions-item label="所属模块">{{ selected.group }}</el-descriptions-item>
            <el-descriptions-item label="访问要求">
              <el-tag v-if="selected.endpoint.isPublic" size="small" type="success" effect="plain">
                公开（无需登录）
              </el-tag>
              <el-tag v-else-if="!selected.endpoint.permission.length" size="small" type="warning" effect="plain">
                登录即可访问
              </el-tag>
              <el-tag v-else size="small" type="danger" effect="plain">需权限码</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="权限码" :span="2">
              <template v-if="selected.endpoint.permission.length">
                <el-tag v-for="code in selected.endpoint.permission" :key="code" size="small" class="perm-tag">
                  {{ code }}
                </el-tag>
              </template>
              <span v-else class="text-muted">—</span>
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
        </template>
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

.title-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.docs-generated {
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  flex: 0 0 320px;
  padding-right: 8px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-lighter);
}

.nav-group + .nav-group {
  margin-top: 12px;
}

.nav-group-title {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
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

.nav-path {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 12px;
  white-space: nowrap;
}

.nav-flag {
  flex: none;
  padding: 0 4px;
  font-size: 11px;
  line-height: 16px;
  color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  border-radius: 3px;
}

/* 右侧详情 */
.docs-detail {
  flex: 1;
  min-width: 0;
  padding-right: 4px;
  overflow-y: auto;
}

.detail-path {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.detail-url {
  flex: 1;
  padding: 6px 10px;
  overflow-x: auto;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 13px;
  white-space: nowrap;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.detail-summary {
  margin: 0 0 16px;
  line-height: 1.7;
  color: var(--el-text-color-regular);
}

.detail-meta {
  margin-bottom: 16px;
}

.perm-tag {
  margin: 2px 6px 2px 0;
}

.detail-tip {
  margin-top: 4px;
}

/* 方法徽标配色 */
.method-badge {
  display: inline-block;
  flex: none;
  width: 52px;
  padding: 1px 0;
  font-family: var(--el-font-family-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  letter-spacing: 0.02em;
  border-radius: 4px;
}

.method-badge.lg {
  width: 64px;
  font-size: 13px;
}

.method-get {
  background: #409eff;
}

.method-post {
  background: #67c23a;
}

.method-put,
.method-patch {
  background: #e6a23c;
}

.method-delete {
  background: #f56c6c;
}

.text-muted {
  color: var(--el-text-color-secondary);
}
</style>
