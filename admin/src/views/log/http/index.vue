<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { BIconArrowClockwise, BIconDownload, BIconTrash } from 'bootstrap-icons-vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import { clearHttpLogsApi, exportHttpLogsApi, getHttpLogsApi } from '@/api/log';
import { getDeptTreeApi } from '@/api/dept';
import { downloadBlob } from '@/utils/download';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import type { DeptNode, HttpLog } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogHttp' });

const loading = ref(false);
const exporting = ref(false);
const list = ref<HttpLog[]>([]);
const total = ref(0);
const dateRange = ref<string[]>([]);
const deptTree = ref<DeptNode[]>([]);

const query = reactive({
  method: '',
  statusCode: undefined as number | undefined,
  username: '',
  deptId: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

/** 兜底文案：空值统一展示为短横线 */
function displayOrDash(value?: string | null): string {
  return value || '-';
}

/** 加载 HTTP 日志 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getHttpLogsApi({
      page: query.page,
      pageSize: query.pageSize,
      method: query.method || undefined,
      statusCode: query.statusCode,
      startTime: dateRange.value[0] || undefined,
      endTime: dateRange.value[1] || undefined,
      username: query.username.trim() || undefined,
      deptId: query.deptId,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
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

/** 查询 */
function handleSearch(): void {
  query.page = 1;
  void loadList();
}

/** 重置 */
function handleReset(): void {
  query.method = '';
  query.statusCode = undefined;
  query.username = '';
  query.deptId = undefined;
  dateRange.value = [];
  query.page = 1;
  void loadList();
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

/** 合并完整请求参数：Query + 请求体 */
function formatParams(row: HttpLog): string {
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

/** 清空所有 HTTP 日志 */
async function handleClear(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定清空所有 HTTP 日志吗？此操作不可恢复。', '清空确认', {
      type: 'warning',
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await clearHttpLogsApi();
  ElMessage.success('已清空所有 HTTP 日志');
  query.page = 1;
  await loadList();
}

onMounted(() => {
  void loadList();
  // 部门树仅用于筛选；无权限时静默跳过（与用户管理页处理一致）
  void loadDeptTree().catch(() => {
    deptTree.value = [];
  });
});
</script>

<template>
  <div class="log-http-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
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
          placeholder="请输入账号"
          clearable
          style="width: 160px"
          @keyup.enter="handleSearch"
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
      <div class="flex items-center justify-between mb-3">
        <span class="text-[15px] font-semibold text-ink">HTTP 访问日志</span>
        <div class="flex flex-wrap items-center gap-2">
          <el-button
            v-permission="'log:http:export'"
            type="primary"
            :icon="BIconDownload"
            :loading="exporting"
            @click="handleExport"
          >
            导出
          </el-button>
          <el-button :icon="BIconArrowClockwise" @click="loadList">刷新</el-button>
          <el-button v-permission="'log:http:clear'" type="danger" plain :icon="BIconTrash" @click="handleClear"
            >清空所有日志</el-button
          >
        </div>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="py-2 px-4">
              <div>
                <p class="mt-2.5 mb-1 text-xs font-semibold text-muted">请求参数（Query + Body，敏感字段已脱敏）</p>
                <pre
                  class="max-h-60 m-0 overflow-auto whitespace-pre-wrap break-all rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]"
                  >{{ formatParams(row as HttpLog) }}</pre>
              </div>
              <div v-if="row.resBody">
                <p class="mt-2.5 mb-1 text-xs font-semibold text-muted">响应内容</p>
                <pre
                  class="max-h-60 m-0 overflow-auto whitespace-pre-wrap break-all rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]"
                  >{{ row.resBody }}</pre>
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
          <!-- 未识别时展示「未知」，原始 UA 通过 tooltip 全量可见 -->
          <template #default="{ row }">
            <el-tooltip
              :content="row.userAgent || '无 User-Agent'"
              placement="top"
              :show-after="300"
              :disabled="!row.userAgent"
            >
              <span>{{ row.browser || '未知' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="操作系统" width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tooltip
              :content="row.userAgent || '无 User-Agent'"
              placement="top"
              :show-after="300"
              :disabled="!row.userAgent"
            >
              <span>{{ row.os || '未知' }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column prop="ip" label="IP" width="150" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
        </el-table-column>
      </el-table>

      <Pagination
        v-model:current-page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @size-change="loadList"
        @current-change="loadList"
      />
    </el-card>
  </div>
</template>
