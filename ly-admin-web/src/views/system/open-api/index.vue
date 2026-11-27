<script setup lang="ts">
/**
 * 开放 API 页。
 * 模块职责：服务账号密钥（API Key）与 Webhook 订阅两个分签的编排与联动。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  deleteApiKeyApi,
  listApiKeysApi,
  listWebhookDeliveriesApi,
  listWebhooksApi,
  toggleApiKeyApi,
  deleteWebhookApi,
  testWebhookApi,
} from '@/api/open';
import type { ApiKey, WebhookDelivery, WebhookItem } from '@/types/api';
import ApiKeyForm from './components/ApiKeyForm.vue';
import WebhookForm from './components/WebhookForm.vue';

defineOptions({ name: 'SystemOpenApi' });

/* ------------------------------- API Key 分签 ------------------------------- */

/** 当前激活的分签（默认「密钥」：与 onMounted 的加载目标一致，避免页面打开时内容区空白）。 */
const activeTab = ref('keys');

const keyLoading = ref(false);
const keys = ref<ApiKey[]>([]);
const keyTotal = ref(0);
const keyQuery = reactive({ page: 1, pageSize: 20, name: '' });
const keyFormVisible = ref(false);
const keyEditId = ref<number | undefined>(undefined);
/** 新建成功后一次性展示的明文密钥 */
const createdKey = ref('');

async function loadKeys(): Promise<void> {
  keyLoading.value = true;
  try {
    const res = await listApiKeysApi({
      page: keyQuery.page,
      pageSize: keyQuery.pageSize,
      name: keyQuery.name || undefined,
    });
    keys.value = res.list ?? [];
    keyTotal.value = res.total ?? 0;
  } finally {
    keyLoading.value = false;
  }
}

/** 新增密钥 */
function handleKeyAdd(): void {
  keyEditId.value = undefined;
  keyFormVisible.value = true;
}

/** 编辑密钥 */
function handleKeyEdit(row: ApiKey): void {
  keyEditId.value = row.id;
  keyFormVisible.value = true;
}

/** 启停 */
async function handleKeyToggle(row: ApiKey): Promise<void> {
  await toggleApiKeyApi(row.id);
  ElMessage.success(row.status === 1 ? '已停用' : '已启用');
  await loadKeys();
}

/** 删除 */
async function handleKeyDelete(row: ApiKey): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除密钥「${row.name}」吗？删除后使用该密钥的调用将立即失效。`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteApiKeyApi(row.id);
  ElMessage.success('删除成功');
  await loadKeys();
}

/** 表单保存成功（新建时展示一次性明文） */
async function handleKeySaved(key?: string): Promise<void> {
  keyFormVisible.value = false;
  if (key) {
    createdKey.value = key;
  }
  await loadKeys();
}

/** 复制明文密钥 */
async function copyCreatedKey(): Promise<void> {
  try {
    await navigator.clipboard.writeText(createdKey.value);
    ElMessage.success('已复制');
  } catch {
    ElMessage.warning('复制失败，请手动选择复制');
  }
}

/* ------------------------------- Webhook 分签 ------------------------------- */

const hookLoading = ref(false);
const hooks = ref<WebhookItem[]>([]);
const hookFormVisible = ref(false);
const hookEditId = ref<number | undefined>(undefined);

async function loadHooks(): Promise<void> {
  hookLoading.value = true;
  try {
    hooks.value = await listWebhooksApi();
  } finally {
    hookLoading.value = false;
  }
}

/** 新增订阅 */
function handleHookAdd(): void {
  hookEditId.value = undefined;
  hookFormVisible.value = true;
}

/** 编辑订阅 */
function handleHookEdit(row: WebhookItem): void {
  hookEditId.value = row.id;
  hookFormVisible.value = true;
}

/** 删除 */
async function handleHookDelete(row: WebhookItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除订阅「${row.name}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteWebhookApi(row.id);
  ElMessage.success('删除成功');
  await loadHooks();
}

/** 测试推送 */
async function handleHookTest(row: WebhookItem): Promise<void> {
  try {
    const record = await testWebhookApi(row.id);
    ElMessage.success(`已推送，结果：${record.status === 'ok' ? '成功' : '失败'}`);
  } catch {
    // 拦截器统一处理
  }
}

/** 保存成功 */
function handleHookSaved(): void {
  hookFormVisible.value = false;
  void loadHooks();
}

/* ------------------------------- 投递记录 ------------------------------- */

const deliveryLoading = ref(false);
const deliveries = ref<WebhookDelivery[]>([]);
const deliveryTotal = ref(0);
const deliveryQuery = reactive({ page: 1, pageSize: 20, status: '', event: '' });

async function loadDeliveries(): Promise<void> {
  deliveryLoading.value = true;
  try {
    const res = await listWebhookDeliveriesApi({
      page: deliveryQuery.page,
      pageSize: deliveryQuery.pageSize,
      status: deliveryQuery.status || undefined,
      event: deliveryQuery.event || undefined,
    });
    deliveries.value = res.list ?? [];
    deliveryTotal.value = res.total ?? 0;
  } finally {
    deliveryLoading.value = false;
  }
}

function handleTabChange(tabName: string | number): void {
  if (tabName === 'keys') {
    void loadKeys();
  } else if (tabName === 'webhooks') {
    void loadHooks();
  } else if (tabName === 'deliveries') {
    void loadDeliveries();
  }
}

onMounted(() => {
  void loadKeys();
});
</script>

<template>
  <div class="open-api-page">
    <!-- 默认激活第一个分签：不绑定 v-model 时 el-tabs 无选中面板，内容区一片空白 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 密钥 -->
      <el-tab-pane label="服务账号密钥" name="keys">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>API Key（{{ keyTotal }}）</span>
              <div class="flex gap-2">
                <el-input
                  v-model="keyQuery.name"
                  placeholder="密钥名称"
                  clearable
                  style="width: 180px"
                  @keyup.enter="
                    keyQuery.page = 1;
                    loadKeys();
                  "
                  @clear="
                    keyQuery.page = 1;
                    loadKeys();
                  "
                />
                <el-button v-permission="'system:apiKey:add'" type="primary" @click="handleKeyAdd">
                  <template #icon><i class="bi bi-plus" /></template>
                  签发密钥
                </el-button>
              </div>
            </div>
          </template>
          <el-alert
            v-if="createdKey"
            type="warning"
            :closable="false"
            class="mb-3"
            title="密钥仅此一次展示，刷新或离开后无法再次查看，请立即复制保存。"
          >
            <div class="mt-2 flex items-center gap-2">
              <code class="created-key">{{ createdKey }}</code>
              <el-button size="small" type="primary" @click="copyCreatedKey">复制</el-button>
              <el-button size="small" @click="createdKey = ''">关闭</el-button>
            </div>
          </el-alert>
          <el-table v-loading="keyLoading" :data="keys" row-key="id">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="prefix" label="前缀" min-width="140" show-overflow-tooltip />
            <el-table-column prop="username" label="所属用户" min-width="120" show-overflow-tooltip />
            <el-table-column label="权限范围" min-width="120">
              <template #default="{ row }">{{ row.scopes?.length ? row.scopes.join('、') : '同用户' }}</template>
            </el-table-column>
            <el-table-column label="过期时间" width="170">
              <template #default="{ row }">{{
                row.expiresAt ? new Date(row.expiresAt).toLocaleString() : '永久'
              }}</template>
            </el-table-column>
            <el-table-column label="最近使用" width="170">
              <template #default="{ row }">
                {{ row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '未使用' }}
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <div class="table-action">
                  <el-button
                    v-permission="'system:apiKey:edit'"
                    type="primary"
                    link
                    @click="handleKeyEdit(row as ApiKey)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-permission="'system:apiKey:edit'"
                    type="primary"
                    link
                    @click="handleKeyToggle(row as ApiKey)"
                  >
                    {{ row.status === 1 ? '停用' : '启用' }}
                  </el-button>
                  <el-button
                    v-permission="'system:apiKey:remove'"
                    type="danger"
                    link
                    @click="handleKeyDelete(row as ApiKey)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="keyTotal > 0" class="mt-3 flex justify-end">
            <el-pagination
              v-model:current-page="keyQuery.page"
              v-model:page-size="keyQuery.pageSize"
              :total="keyTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadKeys"
              @size-change="
                keyQuery.page = 1;
                loadKeys();
              "
            />
          </div>
        </el-card>
      </el-tab-pane>

      <!-- Webhook -->
      <el-tab-pane label="Webhook 订阅" name="webhooks">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>Webhook 订阅（{{ hooks.length }}）</span>
              <el-button v-permission="'system:webhook:add'" type="primary" @click="handleHookAdd">
                <template #icon><i class="bi bi-plus" /></template>
                新增订阅
              </el-button>
            </div>
          </template>
          <el-table v-loading="hookLoading" :data="hooks" row-key="id">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="url" label="目标 URL" min-width="220" show-overflow-tooltip />
            <el-table-column label="事件" min-width="160">
              <template #default="{ row }">{{ row.events?.length ? row.events.join('、') : '全部' }}</template>
            </el-table-column>
            <el-table-column label="最近投递" width="110" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.lastStatus" :type="row.lastStatus === 'ok' ? 'success' : 'danger'" size="small">
                  {{ row.lastStatus === 'ok' ? '成功' : '失败' }}
                </el-tag>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <div class="table-action">
                  <el-button
                    v-permission="'system:webhook:edit'"
                    type="primary"
                    link
                    @click="handleHookTest(row as WebhookItem)"
                  >
                    测试
                  </el-button>
                  <el-button
                    v-permission="'system:webhook:edit'"
                    type="primary"
                    link
                    @click="handleHookEdit(row as WebhookItem)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-permission="'system:webhook:remove'"
                    type="danger"
                    link
                    @click="handleHookDelete(row as WebhookItem)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 投递记录 -->
      <el-tab-pane label="投递记录" name="deliveries">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>投递记录</span>
              <el-button @click="loadDeliveries">
                <template #icon><i class="bi bi-arrow-clockwise" /></template>
                刷新
              </el-button>
            </div>
          </template>
          <div class="mb-3 flex flex-wrap gap-3">
            <el-input
              v-model="deliveryQuery.event"
              placeholder="事件名"
              clearable
              style="width: 200px"
              @keyup.enter="
                deliveryQuery.page = 1;
                loadDeliveries();
              "
              @clear="
                deliveryQuery.page = 1;
                loadDeliveries();
              "
            />
            <el-select
              v-model="deliveryQuery.status"
              placeholder="投递结果"
              clearable
              style="width: 160px"
              @change="
                deliveryQuery.page = 1;
                loadDeliveries();
              "
            >
              <el-option label="成功" value="ok" />
              <el-option label="失败" value="failed" />
            </el-select>
          </div>
          <el-table v-loading="deliveryLoading" :data="deliveries" row-key="id">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="event" label="事件" min-width="160" show-overflow-tooltip />
            <el-table-column label="结果" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 'ok' ? 'success' : 'danger'" size="small">
                  {{ row.status === 'ok' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="statusCode" label="状态码" width="90" align="center" />
            <el-table-column prop="duration" label="耗时" width="90" align="center">
              <template #default="{ row }">{{ row.duration }}ms</template>
            </el-table-column>
            <el-table-column prop="error" label="错误" min-width="180" show-overflow-tooltip />
            <el-table-column label="时间" width="180">
              <template #default="{ row }">{{ new Date(row.createdAt).toLocaleString() }}</template>
            </el-table-column>
          </el-table>
          <div v-if="deliveryTotal > 0" class="mt-3 flex justify-end">
            <el-pagination
              v-model:current-page="deliveryQuery.page"
              v-model:page-size="deliveryQuery.pageSize"
              :total="deliveryTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadDeliveries"
              @size-change="
                deliveryQuery.page = 1;
                loadDeliveries();
              "
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <ApiKeyForm v-model="keyFormVisible" :edit-id="keyEditId" @saved="handleKeySaved" />
    <WebhookForm v-model="hookFormVisible" :edit-id="hookEditId" @saved="handleHookSaved" />
  </div>
</template>

<style scoped>
.created-key {
  padding: 6px 10px;
  font-size: 12px;
  word-break: break-all;
  user-select: all;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
