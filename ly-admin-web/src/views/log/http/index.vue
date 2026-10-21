<script setup lang="ts">
/**
 * HTTP 访问日志页。
 * 模块职责：按方法 / 状态码 / 操作账号 / 部门 / 时间范围查询访问日志，支持导出与清空，
 * 展开行展示请求参数、User-Agent 与响应内容。
 */

import { ElMessage } from '@/utils/element';
import {
  clearHttpLogsApi,
  deleteHttpLogApi,
  deleteHttpLogsApi,
  exportHttpLogsApi,
  getHttpLogDetailApi,
  getHttpLogsApi,
} from '@/api/log';
import { getDeptTreeApi } from '@/api/dept';
import { useTable } from '@/composables/useTable';
import { useBatchDelete } from '@/composables/useBatchDelete';
import { downloadBlob } from '@/utils/download';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import type { DeptNode, HttpLog } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogHttp' });

const exporting = ref(false);
const dateRange = ref<string[]>([]);
const deptTree = ref<DeptNode[]>([]);
/** 展开行详情（请求/响应体按需加载，列表不携带） */
const detailMap = ref<Record<number, HttpLog>>({});
const detailLoading = ref<Record<number, boolean>>({});

const { loading, list, total, query, getList, search, reset, changePage, changePageSize } = useTable(
  (p) =>
    getHttpLogsApi({
      page: p.page,
      pageSize: p.pageSize,
      method: p.method || undefined,
      statusCode: p.statusCode,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
      username: p.username.trim() || undefined,
      deptId: p.deptId,
    }),
  { method: '', statusCode: undefined as number | undefined, username: '', deptId: undefined as number | undefined },
);

/** 单条 / 多选删除（删除后一并清掉展开行详情缓存） */
const { selected, deleting, handleSelectionChange, removeOne, removeSelected } = useBatchDelete<HttpLog>({
  batchApi: deleteHttpLogsApi,
  singleApi: deleteHttpLogApi,
  // 批量删除的确认与跳过大小时按业务名词提示
  noun: '日志',
  list,
  query,
  getList,
  onDeleted: (ids) => {
    for (const id of ids) {
      delete detailMap.value[id];
      delete detailLoading.value[id];
    }
  },
});

/** 兜底文案：空值统一展示为短横线 */
function displayOrDash(value?: string | null): string {
  return value || '-';
}

/** 导出 HTTP 日志：按当前筛选条件导出，不带分页参数 */
async function handleExport(): Promise<void> {
  if (exporting.value) {
    return;
  }
  exporting.value = true;
  try {
    const blob = await exportHttpLogsApi({
      method: query.method || undefined,
      statusCode: query.statusCode,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
      username: query.username.trim() || undefined,
      deptId: query.deptId,
    });
    downloadBlob(blob, `HTTP访问日志_${formatDate(new Date(), 'YYYYMMDD_HHmmss')}.csv`);
    ElMessage.success('导出成功');
  } catch {
    ElMessage.error('导出失败');
  } finally {
    exporting.value = false;
  }
}

/** 加载部门树（用于部门筛选） */
async function loadDeptTree(): Promise<void> {
  deptTree.value = (await getDeptTreeApi()) ?? [];
}

/** 状态码颜色：2xx 成功绿 / 3xx 重定向灰 / 4xx 客户端错误黄 / 5xx 服务端错误红 */
function statusType(code: number): 'success' | 'info' | 'warning' | 'danger' {
  if (code >= 200 && code < 300) {
    return 'success';
  }
  if (code >= 300 && code < 400) {
    return 'info';
  }
  if (code >= 400 && code < 500) {
    return 'warning';
  }
  return 'danger';
}

/** 展开行时按需拉取详情（已加载或加载中则跳过） */
async function handleExpand(row: HttpLog, expandedRows: HttpLog[] | boolean): Promise<void> {
  const expanded = typeof expandedRows === 'boolean' ? expandedRows : expandedRows.includes(row);
  const id = row.id;
  if (!expanded || detailMap.value[id] || detailLoading.value[id]) {
    return;
  }
  detailLoading.value[id] = true;
  try {
    detailMap.value[id] = await getHttpLogDetailApi(id);
  } catch {
    ElMessage.error('加载日志详情失败');
  } finally {
    detailLoading.value[id] = false;
  }
}

/** 格式化请求查询参数（JSON 缩进展示），无参数返回空串 */
function formatQuery(query: Record<string, unknown> | null | undefined): string {
  if (!query || Object.keys(query).length === 0) {
    return '';
  }
  return JSON.stringify(query, null, 2);
}

/** 请求体美化：能解析的压缩 JSON 展开为缩进格式 */
function formatBody(body: string | null | undefined): string {
  if (!body) {
    return '';
  }
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

/** 合并完整请求参数：Query + 请求体（详情未加载时返回空串） */
function formatParams(row: HttpLog | undefined): string {
  if (!row) {
    return '';
  }
  const parts: string[] = [];
  const queryText = formatQuery(row.query);
  if (queryText) {
    parts.push(`【Query】\n${queryText}`);
  }
  const bodyText = formatBody(row.reqBody);
  if (bodyText) {
    parts.push(`【Body】\n${bodyText}`);
  }
  return parts.length > 0 ? parts.join('\n\n') : '（无请求参数）';
}

/** 清空确认文案：必须逐字手动输入（粘贴被禁用），防止手滑清空全表。 */
const CLEAR_CONFIRM_TEXT = '清空所有日志';
const clearVisible = ref(false);
const clearInput = ref('');
const clearSubmitting = ref(false);

/** 输入内容是否逐字匹配确认文案（不匹配时确定按钮不可用） */
const canClear = computed(() => clearInput.value.trim() === CLEAR_CONFIRM_TEXT);

/** 打开清空确认弹窗（每次重置输入） */
function openClearDialog(): void {
  clearInput.value = '';
  clearVisible.value = true;
}

/** 拦截粘贴 / 拖放：要求手动逐字输入，避免复制粘贴一路点到底 */
function blockPaste(event: Event): void {
  event.preventDefault();
  ElMessage.warning('请手动输入确认文字');
}

/** 确认清空（canClear 为假时双保险直接返回） */
async function handleClear(): Promise<void> {
  if (!canClear.value || clearSubmitting.value) {
    return;
  }
  clearSubmitting.value = true;
  try {
    await clearHttpLogsApi();
    detailMap.value = {};
    detailLoading.value = {};
    ElMessage.success('已清空所有 HTTP 日志');
    clearVisible.value = false;
    query.page = 1;
    await getList();
  } catch {
    // 失败提示由请求层统一弹出，保持弹窗不关闭便于重试
  } finally {
    clearSubmitting.value = false;
  }
}

onMounted(() => {
  // 部门树仅用于筛选；无权限时静默跳过（与用户管理页处理一致）
  void loadDeptTree().catch(() => {
    deptTree.value = [];
  });
});
</script>

<template>
  <div class="log-http-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="请求方法">
        <el-select v-model="query.method" placeholder="全部" clearable style="width: 140px">
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态码">
        <el-input-number v-model="query.statusCode" :min="100" :max="599" placeholder="全部" />
      </el-form-item>
      <el-form-item label="操作账号">
        <el-input
          v-model="query.username"
          placeholder="请输入账号前缀"
          clearable
          style="width: 160px"
          @keyup.enter="search"
        />
      </el-form-item>
      <template #advanced>
        <el-form-item label="所属部门">
          <el-tree-select
            v-model="query.deptId"
            :data="deptTree"
            :props="{ label: 'deptName', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            :render-after-expand="false"
            placeholder="全部"
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="时间范围">
          <el-date-picker
            v-model="dateRange"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            range-separator="至"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
          />
        </el-form-item>
      </template>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">HTTP 访问日志</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button @click="getList">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>刷新</el-button
          >
          <el-button v-permission="'log:http:export'" type="primary" :loading="exporting" @click="handleExport">
            <template #icon><i class="bi bi-download" /></template>
            导出
          </el-button>
          <el-button
            v-permission="'log:http:remove'"
            type="danger"
            plain
            :loading="deleting"
            :disabled="selected.length === 0"
            @click="removeSelected"
          >
            <template #icon><i class="bi bi-trash" /></template>
            删除{{ selected.length > 0 ? `（${selected.length}）` : '' }}
          </el-button>
          <el-button v-permission="'log:http:clear'" type="danger" plain @click="openClearDialog">
            <template #icon><i class="bi bi-trash" /></template>清空所有日志</el-button
          >
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="list"
        @expand-change="handleExpand"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column type="expand">
          <template #default="{ row }">
            <div v-loading="detailLoading[row.id]" class="py-2 px-4">
              <div>
                <p class="mt-2.5 mb-1 text-xs font-semibold text-muted">请求参数（Query + Body，敏感字段已脱敏）</p>
                <pre
                  class="max-h-60 m-0 overflow-auto whitespace-pre-wrap break-all rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]"
                  >{{ formatParams(detailMap[row.id]) }}</pre>
              </div>
              <div>
                <p class="mt-2.5 mb-1 text-xs font-semibold text-muted">User-Agent</p>
                <pre
                  class="max-h-60 m-0 overflow-auto whitespace-pre-wrap break-all rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]"
                  >{{ row.userAgent || '无 User-Agent' }}</pre>
              </div>
              <div v-if="detailMap[row.id]?.resBody">
                <p class="mt-2.5 mb-1 text-xs font-semibold text-muted">响应内容</p>
                <pre
                  class="max-h-60 m-0 overflow-auto whitespace-pre-wrap break-all rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]"
                  >{{ detailMap[row.id]?.resBody }}</pre>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="method" label="方法" width="100" align="center" />
        <el-table-column prop="url" label="URL" min-width="260" show-overflow-tooltip />
        <el-table-column label="状态码" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.statusCode)" size="small">{{ row.statusCode }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="110" align="center">
          <template #default="{ row }">{{ formatDuration(row.duration) }}</template>
        </el-table-column>
        <el-table-column label="操作人" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ displayOrDash(row.username) }}</template>
        </el-table-column>
        <el-table-column label="所属部门" width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ displayOrDash(row.deptName) }}</template>
        </el-table-column>
        <el-table-column label="浏览器" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.browser || '未知' }}</template>
        </el-table-column>
        <el-table-column label="操作系统" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.os || '未知' }}</template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="150" />
        <el-table-column label="归属地" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.location || '-' }}</template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right" align="center">
          <template #default="{ row }">
            <el-button v-permission="'log:http:remove'" type="danger" link @click="removeOne(row as HttpLog)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>

    <!-- 清空确认：必须逐字手动输入确认文案，确定按钮才可用；输入框禁用粘贴 -->
    <BasicDialog
      v-model="clearVisible"
      title="清空确认"
      width="440px"
      confirm-text="确认清空"
      :confirm-disabled="!canClear"
      :confirm-loading="clearSubmitting"
      @confirm="handleClear"
    >
      <el-alert type="error" :closable="false" show-icon title="将删除全部 HTTP 访问日志，删除后无法恢复。" />
      <p class="mt-4 mb-2 text-sm text-ink-regular">
        请手动输入
        <span class="font-semibold text-danger">{{ CLEAR_CONFIRM_TEXT }}</span>
        以确认（不支持粘贴）：
      </p>
      <el-input
        v-model="clearInput"
        :placeholder="CLEAR_CONFIRM_TEXT"
        clearable
        autocomplete="off"
        @paste="blockPaste"
        @drop="blockPaste"
      />
    </BasicDialog>
  </div>
</template>
