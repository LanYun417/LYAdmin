<script setup lang="ts">
/**
 * 接口文档页。
 * 模块职责：拉取后端构建期生成的接口清单（`GET /api/docs`），渲染为「左侧接口导航 +
 * 右侧接口详情」的可检索文档页；纯只读展示，不涉及任何写操作。
 *
 * 数据来源：后端 `scripts/gen-api-docs.mjs` 扫描控制器生成的 JSON，因此本页展示的
 * 路由、权限码、说明始终与代码一致，无需手工维护。
 *
 * 样式：布局与排版一律用 Tailwind 工具类（含 @theme 语义色令牌 text-ink-regular /
 * bg-fill-light / border-line-lighter）；结构组件用 Element Plus（el-card / el-scrollbar /
 * el-collapse / el-tag / el-input / el-descriptions / el-alert / el-empty）。
 * ⚠️ 少数「覆盖 EP 自身声明」的属性（如 el-input 宽度、el-collapse 边框色）不能用工具类：
 * EP 样式无层级、工具类在 @layer 内会整体压不过它，故改用 EP 暴露的 CSS 变量（内联）。
 */

import { ElMessage } from '@/utils/element';
import { getApiDocsApi } from '@/api/docs';
import type { ApiDocEndpoint, ApiDocGroup, ApiDocParam } from '@/types/docs';

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

/**
 * 折叠面板去边框。
 * el-collapse 把 `--el-collapse-border-color` 声明在自身元素上、且 EP 样式无层级——
 * Tailwind 工具类在 @layer 内会整体压不过它，故只能用内联 CSS 变量覆盖。
 */
const collapseStyle: Record<string, string> = { '--el-collapse-border-color': 'transparent' };

/** 窄屏（< 768px）：与布局层同一断点（见 layout/index.vue），用于单列展示等降级 */
const isMobileScreen = useMediaQuery('(max-width: 767px)');

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
/** 左侧折叠面板当前展开的模块名（手风琴模式：同一时间仅展开一个，空串表示全部折叠） */
const activeGroups = ref<string>('');
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

/**
 * 按位置拆分的参数分组：用分组标题代替单独的「位置」列，
 * 标题形如 路径参数 / 请求参数（Query）/ 请求体（Body），无该位置的接口不出现对应分组。
 */
const paramSections = computed(() => {
  const all = selected.value?.endpoint.params ?? [];
  return (['path', 'query', 'body'] as const)
    .map((inType) => {
      const items = all.filter((p) => p.in === inType);
      if (items.length === 0) {
        return null;
      }
      const title = inType === 'path' ? '路径参数' : inType === 'query' ? '请求参数（Query）' : '请求体（Body）';
      return { title, items };
    })
    .filter((s): s is { title: string; items: ApiDocParam[] } => s !== null);
});

/** 左侧菜单默认折叠（activeGroups 初始为空），由用户点击模块名展开 */

/** HTTP 方法 → Element Plus Tag 类型 */
function methodTagType(method: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  return METHOD_TAG_TYPE[method] ?? 'info';
}

/**
 * 导航展示名：取接口说明（summary）的**首句**作为中文名。
 * 说明较长时（首句里带「（补充）」「：补充」），再去掉括号补充与冒号后的内容，得到更简洁的名称；
 * 始终有可读文本——无说明时回退为路由路径。
 */
function endpointLabel(ep: ApiDocEndpoint): string {
  const firstSentence = (ep.summary.split('。')[0] ?? '')
    .trim()
    .replace(/（[^）]*）$/, '')
    .trim();
  const beforeColon = firstSentence.split(/[：:]/)[0]?.trim() ?? '';
  return (beforeColon.length >= 2 ? beforeColon : firstSentence) || ep.path;
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

/** 代码块样式：Tailwind 工具类，避免为三处示例块写 scoped CSS（长行换行，窄屏不横向溢出） */
const CODE_BLOCK =
  'overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-fill-light p-3 font-mono text-xs leading-[1.6]';

/**
 * 请求参数示例文本：仅展示**请求体（Body）**。
 * 路径参数 / 查询参数已体现在 curl 示例的 URL 中，无需在此重复；
 * 早期曾把三者包成 `{ path, query, body }` 的嵌套对象，既与真实请求结构不符、又和 curl 重复，属误导，已废弃。
 * 无请求体（GET / DELETE 等）则为空串，对应区块不渲染。
 */
const requestParamsText = computed<string>(() => {
  const requestBody = selected.value?.endpoint.examples?.requestBody;
  if (requestBody === undefined || requestBody === null) {
    return '';
  }
  return typeof requestBody === 'object' ? JSON.stringify(requestBody, null, 2) : String(requestBody);
});

/** 响应示例文本：对象按 JSON 格式化；字符串（文件流说明）原样展示 */
const responseText = computed<string>(() => {
  const response = selected.value?.endpoint.examples?.response;
  if (response === undefined || response === null) {
    return '';
  }
  return typeof response === 'string' ? response : JSON.stringify(response, null, 2);
});

/** 复制任意文本到剪贴板 */
async function copyText(text: string, okMessage = '已复制'): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(okMessage);
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

/** 下载 OpenAPI 3.0 文档（后端 GET /api/docs/openapi.json）。 */
async function downloadOpenApi(): Promise<void> {
  try {
    const res = await fetch('/api/docs/openapi.json');
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const text = await res.text();
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openapi.json';
    a.click();
    URL.revokeObjectURL(url);
    ElMessage.success('已下载 openapi.json');
  } catch {
    ElMessage.error('下载失败，请确认后端已启动');
  }
}

/** 示例值格式化：对象序列化为 JSON，其余转字符串；空值显示占位符 */
function formatExample(val: unknown): string {
  if (val === undefined || val === null) {
    return '—';
  }
  return typeof val === 'object' ? JSON.stringify(val) : String(val);
}

onMounted(loadDocs);
</script>

<template>
  <el-card v-loading="loading" shadow="never">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[15px] font-semibold">接口文档</span>
          <el-tag type="info" effect="plain">{{ total }} 个接口</el-tag>
          <el-tag type="info" effect="plain">{{ groups.length }} 个模块</el-tag>
          <span v-if="generatedText" class="text-xs text-muted">生成于 {{ generatedText }}</span>
        </div>
        <!-- 外层定宽：el-input 自身 width:100%，由这层 Tailwind 盒子控制实际宽度（窄屏铺满） -->
        <div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <el-button size="small" @click="downloadOpenApi">下载 OpenAPI</el-button>
          <div class="w-full sm:w-[260px]">
            <el-input v-model="keyword" clearable placeholder="搜索路径 / 说明 / 权限码" />
          </div>
        </div>
      </div>
    </template>

    <!-- 桌面（≥ lg）左右两栏、各自滚动；窄屏纵向堆叠（导航在上、限高独立滚动，详情在下） -->
    <div class="flex flex-col gap-4 lg:h-[calc(100vh-220px)] lg:min-h-[420px] lg:flex-row">
      <!-- 左侧：按模块折叠的接口导航 -->
      <aside
        class="h-[40vh] shrink-0 border-b border-line-lighter pb-2 lg:h-auto lg:w-[340px] lg:border-b-0 lg:border-r lg:pr-2 lg:pb-0"
      >
        <el-scrollbar v-if="filteredGroups.length">
          <!-- 折叠面板去边框（见 collapseStyle 说明）；accordion：展开一个时其余自动收起 -->
          <el-collapse v-model="activeGroups" accordion :style="collapseStyle">
            <el-collapse-item v-for="group in filteredGroups" :key="group.group" :name="group.group">
              <template #title>
                <span class="mr-2 font-semibold">{{ group.group }}</span>
                <el-tag size="small" type="info" effect="plain" round>{{ group.endpoints.length }}</el-tag>
              </template>
              <button
                v-for="ep in group.endpoints"
                :key="`${ep.method} ${ep.path}`"
                type="button"
                class="my-1 flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-ink-regular transition-colors [font:inherit] hover:bg-fill-light"
                :class="{ 'bg-primary/10': isSelected(group.group, ep) }"
                :title="`${ep.method} ${ep.path}`"
                @click="select(group.group, ep)"
              >
                <el-tag :type="methodTagType(ep.method)" effect="dark" class="w-[58px]">{{ ep.method }}</el-tag>
                <span class="min-w-0 flex-1 truncate text-[13px]">{{ endpointLabel(ep) }}</span>
                <el-tag v-if="ep.isPublic" type="success" size="small" effect="plain">公开</el-tag>
              </button>
            </el-collapse-item>
          </el-collapse>
        </el-scrollbar>
        <el-empty v-else :description="keyword ? '没有匹配的接口' : '暂无接口数据'" />
      </aside>

      <!-- 右侧：接口详情（纵向 flex + gap 控制间距，避免给 EP 组件加外边距被其 margin:0 覆盖） -->
      <main class="min-w-0 lg:flex-1">
        <el-scrollbar v-if="selected">
          <div class="flex flex-col gap-4 pr-2">
            <div class="flex items-center gap-2">
              <el-tag :type="methodTagType(selected.endpoint.method)" effect="dark" size="large" class="w-[68px]">
                {{ selected.endpoint.method }}
              </el-tag>
              <el-input :model-value="selected.endpoint.path" readonly class="flex-1">
                <template #append>
                  <el-button @click="copyText(selected.endpoint.path, '已复制路径')">复制</el-button>
                </template>
              </el-input>
            </div>

            <p class="leading-[1.7] text-ink-regular">{{ selected.endpoint.summary || '（该接口暂无说明）' }}</p>

            <el-descriptions :column="isMobileScreen ? 1 : 2" border>
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
                    class="my-0.5 mr-1.5"
                  >
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
              type="info"
              :closable="false"
              show-icon
              title="所有成功响应恒为 HTTP 200，响应体统一为 { code, message, data }。"
            />

            <!-- 请求参数明细：按位置分组（路径参数 / 请求参数（Query）/ 请求体（Body）），去掉单独的「位置」列 -->
            <template v-for="section in paramSections" :key="section.title">
              <div v-if="section.items.length" class="flex flex-col gap-2">
                <span class="text-sm font-semibold">{{ section.title }}</span>
                <el-table :data="section.items" size="small" border>
                  <el-table-column prop="name" label="参数名" min-width="120" />
                  <el-table-column prop="type" label="类型" min-width="130" />
                  <el-table-column label="必填" width="64" align="center">
                    <template #default="{ row }">
                      <el-tag :type="row.required ? 'danger' : 'info'" size="small" effect="plain">
                        {{ row.required ? '是' : '否' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="说明" min-width="160">
                    <template #default="{ row }">{{ row.description || '—' }}</template>
                  </el-table-column>
                  <el-table-column label="示例" min-width="130">
                    <template #default="{ row }">{{ formatExample(row.example) }}</template>
                  </el-table-column>
                </el-table>
              </div>
            </template>

            <!-- 请求示例：curl（可直接执行，含路径 / 查询参数）+ 请求体示例（仅 Body） -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold">请求示例（curl）</span>
                <el-button size="small" text @click="copyText(selected.endpoint.examples.curl)">复制</el-button>
              </div>
              <pre :class="CODE_BLOCK">{{ selected.endpoint.examples.curl }}</pre>

              <template v-if="requestParamsText">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold">请求参数示例</span>
                  <el-button size="small" text @click="copyText(requestParamsText)">复制</el-button>
                </div>
                <pre :class="CODE_BLOCK">{{ requestParamsText }}</pre>
              </template>
            </div>

            <!-- 响应示例：对象按 JSON 格式化；文件流类接口给出文字说明 -->
            <div v-if="responseText" class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold">响应示例</span>
                <el-button size="small" text @click="copyText(responseText)">复制</el-button>
              </div>
              <pre :class="CODE_BLOCK">{{ responseText }}</pre>
            </div>
          </div>
        </el-scrollbar>
        <el-empty v-else description="请从左侧选择一个接口" />
      </main>
    </div>
  </el-card>
</template>
