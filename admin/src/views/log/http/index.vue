<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { BIconArrowClockwise, BIconTrash } from 'bootstrap-icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { clearHttpLogsApi, getHttpLogsApi } from '@/api/log';
import { formatDateTime, formatDuration } from '@/utils/format';
import type { HttpLog } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'LogHttp' });

const loading = ref(false);
const list = ref<HttpLog[]>([]);
const total = ref(0);
const dateRange = ref<string[]>([]);

const query = reactive({
  method: '',
  statusCode: undefined as number | undefined,
  page: 1,
  pageSize: 10,
});

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
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
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
      <template #advanced>
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
        <div class="flex items-center gap-2">
          <el-button :icon="BIconArrowClockwise" @click="loadList">刷新</el-button>
          <el-button v-permission="'log:http:clear'" type="danger" plain :icon="BIconTrash" @click="handleClear"
            >清空所有日志</el-button
          >
        </div>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="http-log-detail">
              <div class="detail-block">
                <p class="detail-title">请求参数（Query + Body，敏感字段已脱敏）</p>
                <pre>{{ formatParams(row as HttpLog) }}</pre>
              </div>
              <div v-if="row.resBody" class="detail-block">
                <p class="detail-title">响应内容</p>
                <pre>{{ row.resBody }}</pre>
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
        <el-table-column prop="ip" label="IP" width="150" />
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.time) }}</template>
        </el-table-column>
      </el-table>

      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="loadList" />
    </el-card>
  </div>
</template>

<style scoped>
/* 展开行：请求参数 / 响应内容 详情 */
.http-log-detail {
  padding: 8px 16px;
}

.detail-title {
  margin: 10px 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.detail-block pre {
  max-height: 240px;
  padding: 10px 12px;
  margin: 0;
  overflow: auto;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
  background-color: var(--el-fill-color-light);
  border-radius: 4px;
}
</style>
