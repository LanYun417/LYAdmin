<script setup lang="ts">
/**
 * 告警中心页。
 * 模块职责：通知渠道配置、告警规则、投递记录三个分签的编排与联动。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  deleteAlertChannelApi,
  deleteAlertRuleApi,
  listAlertChannelsApi,
  listAlertRecordsApi,
  listAlertRulesApi,
  retryAlertRecordApi,
  testAlertChannelApi,
} from '@/api/alert';
import type { AlertChannel, AlertRecord, AlertRule } from '@/types/api';
import ChannelForm from './components/ChannelForm.vue';
import RuleForm from './components/RuleForm.vue';

import { hasPermission } from '@/utils/permission';

defineOptions({ name: 'SystemAlert' });

/* ------------------------------- 渠道分签 ------------------------------- */

const channelLoading = ref(false);
const channels = ref<AlertChannel[]>([]);
const channelFormVisible = ref(false);
const channelEditId = ref<number | undefined>(undefined);

async function loadChannels(): Promise<void> {
  channelLoading.value = true;
  try {
    channels.value = await listAlertChannelsApi();
  } finally {
    channelLoading.value = false;
  }
}

/** 渠道类型中文名。 */
const CHANNEL_TYPE_LABELS: Record<string, string> = {
  email: '邮件',
  webhook: 'Webhook',
  dingtalk: '钉钉',
  wecom: '企业微信',
  feishu: '飞书',
};

/** 新增渠道 */
function handleChannelAdd(): void {
  channelEditId.value = undefined;
  channelFormVisible.value = true;
}

/** 编辑渠道 */
function handleChannelEdit(row: AlertChannel): void {
  channelEditId.value = row.id;
  channelFormVisible.value = true;
}

/** 删除渠道（规则里的引用会在投递时被过滤，这里仅确认） */
async function handleChannelDelete(row: AlertChannel): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除渠道「${row.name}」吗？引用它的规则在投递时会跳过该渠道。`, '提示', {
      type: 'warning',
    });
  } catch {
    return;
  }
  await deleteAlertChannelApi(row.id);
  ElMessage.success('删除成功');
  await loadChannels();
}

/** 测试发送 */
async function handleChannelTest(row: AlertChannel): Promise<void> {
  try {
    await testAlertChannelApi(row.id);
    ElMessage.success('测试告警已投递，请在记录分签查看结果');
  } catch {
    // 错误提示由拦截器统一处理
  }
}

/** 渠道表单保存成功 */
function handleChannelSaved(): void {
  channelFormVisible.value = false;
  void loadChannels();
}

/* ------------------------------- 规则分签 ------------------------------- */

const ruleLoading = ref(false);
const rules = ref<AlertRule[]>([]);
const ruleFormVisible = ref(false);
const ruleEditId = ref<number | undefined>(undefined);

async function loadRules(): Promise<void> {
  ruleLoading.value = true;
  try {
    rules.value = await listAlertRulesApi();
  } finally {
    ruleLoading.value = false;
  }
}

/** 告警级别中文名。 */
const LEVEL_LABELS: Record<string, string> = {
  info: '提示',
  warning: '警告',
  critical: '严重',
};

/** 渠道名（规则表格展示用）。 */
const channelName = (id: number): string => channels.value.find((item) => item.id === id)?.name ?? `#${id}`;

/** 新增规则 */
function handleRuleAdd(): void {
  ruleEditId.value = undefined;
  ruleFormVisible.value = true;
}

/** 编辑规则 */
function handleRuleEdit(row: AlertRule): void {
  ruleEditId.value = row.id;
  ruleFormVisible.value = true;
}

/** 删除规则 */
async function handleRuleDelete(row: AlertRule): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除规则「${row.name}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteAlertRuleApi(row.id);
  ElMessage.success('删除成功');
  await loadRules();
}

/** 规则表单保存成功 */
function handleRuleSaved(): void {
  ruleFormVisible.value = false;
  void loadRules();
}

/* ------------------------------- 记录分签 ------------------------------- */

const RECORD_STATUS_LABELS: Record<string, string> = {
  pending: '待投递',
  sent: '已投递',
  failed: '失败',
};

const recordLoading = ref(false);
const records = ref<AlertRecord[]>([]);
const recordTotal = ref(0);
const recordQuery = reactive({ page: 1, pageSize: 20, status: '', eventType: '' });

async function loadRecords(): Promise<void> {
  recordLoading.value = true;
  try {
    const res = await listAlertRecordsApi({
      page: recordQuery.page,
      pageSize: recordQuery.pageSize,
      status: recordQuery.status || undefined,
      eventType: recordQuery.eventType || undefined,
    });
    records.value = res.list ?? [];
    recordTotal.value = res.total ?? 0;
  } finally {
    recordLoading.value = false;
  }
}

/** 重投一条失败记录 */
async function handleRecordRetry(row: AlertRecord): Promise<void> {
  try {
    await retryAlertRecordApi(row.id);
    ElMessage.success('已重新投递');
    await loadRecords();
  } catch {
    // 错误提示由拦截器统一处理
  }
}

/** 切换分签时按需加载（渠道是规则表格的数据依赖，总是先加载）。 */
function handleTabChange(tabName: string | number): void {
  if (tabName === 'channels') {
    void loadChannels();
  } else if (tabName === 'rules') {
    void loadRules();
  } else if (tabName === 'records') {
    void loadRecords();
  }
}

/** 当前激活的分签（默认「渠道」：与 onMounted 的加载目标一致，避免页面打开时内容区空白）。 */
const activeTab = ref('channels');

onMounted(() => {
  void loadChannels();
});
</script>

<template>
  <div class="alert-page">
    <!-- 默认激活第一个分签：不绑定 v-model 时 el-tabs 无选中面板，内容区一片空白 -->
    <el-tabs v-model="activeTab" @tab-change="handleTabChange">
      <!-- 渠道 -->
      <el-tab-pane label="通知渠道" name="channels">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>通知渠道（{{ channels.length }}）</span>
              <el-button v-permission="'system:alert:add'" type="primary" @click="handleChannelAdd">
                <template #icon><i class="bi bi-plus" /></template>
                新增渠道
              </el-button>
            </div>
          </template>
          <el-table v-loading="channelLoading" :data="channels" row-key="id">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column label="类型" width="110" align="center">
              <template #default="{ row }">{{ CHANNEL_TYPE_LABELS[row.type] ?? row.type }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
            <el-table-column
              v-if="hasPermission(['system:alert:add', 'system:alert:edit', 'system:alert:remove'])"
              label="操作"
              width="200"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="table-action">
                  <el-button
                    v-permission="'system:alert:add'"
                    type="primary"
                    link
                    @click="handleChannelTest(row as AlertChannel)"
                  >
                    测试
                  </el-button>
                  <el-button
                    v-permission="'system:alert:edit'"
                    type="primary"
                    link
                    @click="handleChannelEdit(row as AlertChannel)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-permission="'system:alert:remove'"
                    type="danger"
                    link
                    @click="handleChannelDelete(row as AlertChannel)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 规则 -->
      <el-tab-pane label="告警规则" name="rules">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>告警规则（{{ rules.length }}）</span>
              <el-button v-permission="'system:alert:add'" type="primary" @click="handleRuleAdd">
                <template #icon><i class="bi bi-plus" /></template>
                新增规则
              </el-button>
            </div>
          </template>
          <el-table v-loading="ruleLoading" :data="rules" row-key="id">
            <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="eventType" label="事件类型" min-width="180" show-overflow-tooltip />
            <el-table-column label="级别" width="90" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.level === 'critical' ? 'danger' : row.level === 'warning' ? 'warning' : 'info'"
                  size="small"
                >
                  {{ LEVEL_LABELS[row.level] ?? row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="通知渠道" min-width="180">
              <template #default="{ row }">
                {{ (row.channelIds ?? []).map((id: number) => channelName(id)).join('、') || '-' }}
              </template>
            </el-table-column>
            <el-table-column label="冷却" width="100" align="center">
              <template #default="{ row }">{{ row.cooldownSeconds }}s</template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
                  {{ row.status === 1 ? '启用' : '停用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column
              v-if="hasPermission(['system:alert:edit', 'system:alert:remove'])"
              label="操作"
              width="130"
              fixed="right"
            >
              <template #default="{ row }">
                <div class="table-action">
                  <el-button
                    v-permission="'system:alert:edit'"
                    type="primary"
                    link
                    @click="handleRuleEdit(row as AlertRule)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    v-permission="'system:alert:remove'"
                    type="danger"
                    link
                    @click="handleRuleDelete(row as AlertRule)"
                  >
                    删除
                  </el-button>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <!-- 记录 -->
      <el-tab-pane label="投递记录" name="records">
        <el-card shadow="never">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>投递记录</span>
              <el-button @click="loadRecords">
                <template #icon><i class="bi bi-arrow-clockwise" /></template>
                刷新
              </el-button>
            </div>
          </template>
          <div class="mb-3 flex flex-wrap gap-3">
            <el-input
              v-model="recordQuery.eventType"
              placeholder="事件类型"
              clearable
              style="width: 200px"
              @keyup.enter="
                recordQuery.page = 1;
                loadRecords();
              "
              @clear="
                recordQuery.page = 1;
                loadRecords();
              "
            />
            <el-select
              v-model="recordQuery.status"
              placeholder="投递状态"
              clearable
              style="width: 160px"
              @change="
                recordQuery.page = 1;
                loadRecords();
              "
            >
              <el-option label="待投递" value="pending" />
              <el-option label="已投递" value="sent" />
              <el-option label="失败" value="failed" />
            </el-select>
          </div>
          <el-table v-loading="recordLoading" :data="records" row-key="id">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="ruleName" label="规则" min-width="140" show-overflow-tooltip />
            <el-table-column prop="eventType" label="事件" min-width="160" show-overflow-tooltip />
            <el-table-column label="级别" width="90" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.level === 'critical' ? 'danger' : row.level === 'warning' ? 'warning' : 'info'"
                  size="small"
                >
                  {{ LEVEL_LABELS[row.level] ?? row.level }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'sent' ? 'success' : row.status === 'failed' ? 'danger' : 'info'"
                  size="small"
                >
                  {{ RECORD_STATUS_LABELS[row.status] ?? row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="投递时间" width="180">
              <template #default="{ row }">
                {{ row.sentAt ? new Date(row.sentAt).toLocaleString() : '-' }}
              </template>
            </el-table-column>
            <el-table-column v-if="hasPermission('system:alert:edit')" label="操作" width="90" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status !== 'sent'"
                  v-permission="'system:alert:edit'"
                  type="primary"
                  link
                  @click="handleRecordRetry(row as AlertRecord)"
                >
                  重投
                </el-button>
                <span v-else class="text-muted">-</span>
              </template>
            </el-table-column>
            <template #empty>
              <span v-if="!recordLoading">暂无投递记录</span>
            </template>
          </el-table>
          <div v-if="recordTotal > 0" class="mt-3 flex justify-end">
            <el-pagination
              v-model:current-page="recordQuery.page"
              v-model:page-size="recordQuery.pageSize"
              :total="recordTotal"
              layout="total, sizes, prev, pager, next"
              @current-change="loadRecords"
              @size-change="
                recordQuery.page = 1;
                loadRecords();
              "
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <ChannelForm v-model="channelFormVisible" :edit-id="channelEditId" @saved="handleChannelSaved" />
    <RuleForm v-model="ruleFormVisible" :edit-id="ruleEditId" :channels="channels" @saved="handleRuleSaved" />
  </div>
</template>
