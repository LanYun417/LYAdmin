<script setup lang="ts">
/**
 * IP 访问控制页。
 * 模块职责：维护 IP 黑名单 / 白名单规则（增删改查、启停、命中计数清零）。
 *
 * 判定优先级在后端：白名单 > 黑名单；页面给出提示，避免运维误以为封禁一定生效。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { deleteIpRuleApi, getIpRuleListApi, resetIpRuleHitApi, toggleIpRuleApi } from '@/api/ipRule';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { IpRuleItem } from '@/types/api';
import TablePage from '@/components/TablePage/index.vue';
import IpRuleForm from './components/IpRuleForm.vue';

defineOptions({ name: 'MonitorIpRule' });

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getIpRuleListApi({
      page: p.page,
      pageSize: p.pageSize,
      ip: p.ip.trim() || undefined,
      ruleType: p.ruleType || undefined,
      status: p.status,
    }),
  { ip: '', ruleType: undefined as number | undefined, status: undefined as number | undefined },
);

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);

/** 新增 */
function handleAdd(): void {
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: IpRuleItem): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 启停 */
async function handleToggle(row: IpRuleItem): Promise<void> {
  const action = row.status === 1 ? '停用' : '启用';
  await toggleIpRuleApi(row.id);
  ElMessage.success(`已${action}规则`);
  await getList();
}

/** 清空命中计数 */
async function handleResetHit(row: IpRuleItem): Promise<void> {
  await resetIpRuleHitApi(row.id);
  ElMessage.success('命中计数已清零');
  await getList();
}

/** 删除 */
async function handleDelete(row: IpRuleItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除规则「${row.ip}」吗？删除后立即失效。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteIpRuleApi(row.id);
  ElMessage.success('删除成功');
  await getList();
}

/** 表单提交成功 */
function handleFormSuccess(): void {
  void getList();
}

/** 规则当前是否真正生效：状态启用 + 未过期 */
function isActive(row: IpRuleItem): boolean {
  if (row.status !== 1) {
    return false;
  }
  if (!row.expiresAt) {
    return true;
  }
  return new Date(row.expiresAt).getTime() > Date.now();
}
</script>

<template>
  <!-- 保持单根：AppMain 的 <transition> 要求页面只有一个根元素 -->
  <div class="ip-rule-page">
    <TablePage
      v-model:current-page="query.page"
      v-model:page-size="query.pageSize"
      title="IP 访问控制"
      :loading="loading"
      :data="list"
      :total="total"
      @search="search"
      @reset="reset"
      @size-change="changePageSize"
      @current-change="changePage"
    >
      <template #filter>
        <el-form-item label="IP / CIDR">
          <el-input
            v-model="query.ip"
            placeholder="支持模糊匹配"
            clearable
            style="width: 180px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="规则类型">
          <el-select v-model="query.ruleType" placeholder="全部" clearable style="width: 130px">
            <el-option label="黑名单" :value="1" />
            <el-option label="白名单" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="query.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="启用" :value="1" />
            <el-option label="停用" :value="0" />
          </el-select>
        </el-form-item>
      </template>

      <template #title>
        <span class="text-[15px] font-semibold text-ink">IP 访问控制（{{ total }}）</span>
        <el-tooltip
          content="白名单优先于黑名单：命中白名单的 IP 直接放行并绕过限流。仅支持 IPv4 / CIDR；运维出口 IP 可在环境变量 IP_ACCESS_EXEMPT_IPS 中豁免。"
          placement="right"
        >
          <i class="bi bi-info-circle cursor-help text-muted" />
        </el-tooltip>
      </template>

      <template #toolbar>
        <el-button v-permission="'monitor:ipRule:add'" type="primary" @click="handleAdd">
          <template #icon><i class="bi bi-plus" /></template>
          新增规则
        </el-button>
      </template>

      <el-table-column prop="ip" label="IP / CIDR" min-width="160" show-overflow-tooltip />
      <el-table-column label="类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.ruleType === 1 ? 'danger' : 'success'" size="small">
            {{ row.ruleType === 1 ? '黑名单' : '白名单' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="isActive(row as IpRuleItem) ? 'success' : 'info'" size="small">
            {{ isActive(row as IpRuleItem) ? '生效中' : row.status === 0 ? '已停用' : '已过期' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.remark || '-' }}</template>
      </el-table-column>
      <el-table-column label="命中次数" width="110" align="center">
        <template #default="{ row }">{{ row.hitCount.toLocaleString() }}</template>
      </el-table-column>
      <el-table-column label="过期时间" width="180">
        <template #default="{ row }">{{ row.expiresAt ? formatDateTime(row.expiresAt) : '永久' }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="220" fixed="right">
        <template #default="{ row }">
          <div class="table-action">
            <el-button
              v-permission="'monitor:ipRule:edit'"
              type="primary"
              link
              @click="handleToggle(row as IpRuleItem)"
            >
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button
              v-permission="'monitor:ipRule:edit'"
              type="warning"
              link
              @click="handleResetHit(row as IpRuleItem)"
            >
              清命中
            </el-button>
            <el-button v-permission="'monitor:ipRule:edit'" type="primary" link @click="handleEdit(row as IpRuleItem)">
              编辑
            </el-button>
            <el-button
              v-permission="'monitor:ipRule:remove'"
              type="danger"
              link
              @click="handleDelete(row as IpRuleItem)"
            >
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </TablePage>

    <IpRuleForm v-model="formVisible" :rule-id="editId" @success="handleFormSuccess" />
  </div>
</template>
