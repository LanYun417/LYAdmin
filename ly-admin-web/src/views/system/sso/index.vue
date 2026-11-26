<script setup lang="ts">
/**
 * 单点登录（SSO）配置页。
 * 模块职责：OIDC 提供方列表与增删改；clientSecret 只写不读（编辑时留空表示不修改）。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { useTable } from '@/composables/useTable';
import { deleteSsoProviderApi, listSsoAdminProvidersApi } from '@/api/sso';
import type { SsoProvider } from '@/types/api';
import TablePage from '@/components/TablePage/index.vue';
import SsoForm from './components/SsoForm.vue';

defineOptions({ name: 'SystemSso' });

const { loading, list, total, getList } = useTable(
  (p) =>
    listSsoAdminProvidersApi().then((res) => ({
      list: res.list ?? [],
      total: res.total ?? 0,
      page: p.page,
      pageSize: p.pageSize,
    })),
  {},
);

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);

/** 新增 */
function handleAdd(): void {
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: SsoProvider): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除（绑定关系一并清理，二次确认） */
async function handleDelete(row: SsoProvider): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除提供方「${row.name}」吗？已通过它登录的用户绑定关系将一并清理，这些用户需改用其他方式登录。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await deleteSsoProviderApi(row.id);
  ElMessage.success('删除成功');
  await getList();
}

/** 表单提交成功 */
function handleFormSuccess(): void {
  formVisible.value = false;
  void getList();
}
</script>

<template>
  <div class="sso-page">
    <TablePage title="单点登录提供方" :loading="loading" :data="list" :total="total" :show-pagination="false">
      <template #toolbar>
        <el-button v-permission="'system:sso:add'" type="primary" @click="handleAdd">
          <template #icon><i class="bi bi-plus" /></template>
          新增提供方
        </el-button>
      </template>

      <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
            {{ row.status === 1 ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issuer" label="Issuer" min-width="200" show-overflow-tooltip />
      <el-table-column prop="clientId" label="Client ID" min-width="160" show-overflow-tooltip />
      <el-table-column label="邮箱绑定" width="100" align="center">
        <template #default="{ row }">
          {{ row.linkByEmail ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column prop="defaultRoleCodes" label="默认角色" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.defaultRoleCodes?.join('、') || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <div class="table-action">
            <el-button v-permission="'system:sso:edit'" type="primary" link @click="handleEdit(row as SsoProvider)">
              编辑
            </el-button>
            <el-button v-permission="'system:sso:remove'" type="danger" link @click="handleDelete(row as SsoProvider)">
              删除
            </el-button>
          </div>
        </template>
      </el-table-column>
    </TablePage>

    <SsoForm v-model="formVisible" :edit-id="editId" @success="handleFormSuccess" />
  </div>
</template>
