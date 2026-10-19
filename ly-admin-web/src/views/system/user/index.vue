<script setup lang="ts">
/**
 * 用户管理页。
 * 模块职责：用户列表查询，以及新增 / 编辑 / 删除、启停切换、重置密码、分配角色。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import {
  batchDeleteUsersApi,
  deleteUserApi,
  getUserListApi,
  resetUserPasswordApi,
  updateUserStatusApi,
} from '@/api/user';
import { getDeptTreeApi } from '@/api/dept';
import { getAllRolesApi } from '@/api/role';
import { useDict, useStatusDict } from '@/composables/useDict';
import { useBatchDelete } from '@/composables/useBatchDelete';
import { useTableColumns } from '@/composables/useTableColumns';
import { useTable } from '@/composables/useTable';
import { hasPermission } from '@/utils/permission';
import { formatDateTime } from '@/utils/format';
import { PASSWORD_MESSAGE, PASSWORD_REGEX } from '@/utils/validate';
import type { DeptNode, RoleBrief, UserDetail } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import ColumnSettings from '@/components/ColumnSettings/index.vue';
import UserForm from './components/UserForm.vue';
import AssignRoleDialog from './components/AssignRoleDialog.vue';
import { withUploadToken } from '@/utils/uploadToken';

defineOptions({ name: 'SystemUser' });

const roleOptions = ref<RoleBrief[]>([]);
const deptTree = ref<DeptNode[]>([]);

/** 性别字典（字典管理 → 用户性别 sys_user_sex），用于列表把值渲染成标签 */
const { labelOf: genderLabel } = useDict('sys_user_sex');

/** 状态字典（字典管理 → 通用状态 sys_common_status），驱动状态筛选与提示文案 */
const { statusOptions, statusLabel } = useStatusDict();

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getUserListApi({
      page: p.page,
      pageSize: p.pageSize,
      username: p.username || undefined,
      status: p.status,
      deptId: p.deptId,
    }),
  { username: '', status: undefined as number | undefined, deptId: undefined as number | undefined },
);

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);
const assignVisible = ref(false);
const assignUserId = ref<number | undefined>(undefined);
const assignRoleIds = ref<number[]>([]);

/** 加载角色下拉（仅具备 system:role:all 的角色可拉取，避免无权限角色触发 403 整页跳转） */
async function loadRoles(): Promise<void> {
  if (!hasPermission('system:role:all')) {
    return;
  }
  roleOptions.value = await getAllRolesApi();
}

/** 加载部门树（仅具备 system:dept:list 的角色可拉取，用于筛选） */
async function loadDepts(): Promise<void> {
  if (!hasPermission('system:dept:list')) {
    return;
  }
  deptTree.value = (await getDeptTreeApi()) ?? [];
}

/** 新增 */
function handleAdd(): void {
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: UserDetail): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除 */
/**
 * 批量删除：只在勾选后可用。超管从源头不可勾选（后端也会拦，双保险），
 * 免得用户勾了、点了、然后收到一句「超级管理员不可删除」。
 */
const { selected, deleting, handleSelectionChange, removeSelected } = useBatchDelete<UserDetail>({
  batchApi: batchDeleteUsersApi,
  singleApi: deleteUserApi,
  list,
  query,
  getList,
  noun: '用户',
});

/** 可勾选判定：超级管理员行禁用勾选 */
function selectableUser(row: UserDetail): boolean {
  return !row.isSuperAdmin;
}

/**
 * 列显隐配置（按页面持久化到 localStorage）。
 * 账号列与操作列固定：前者用于辨认行，后者关掉就没有任何操作入口了。
 */
const {
  columns: columnOptions,
  visible: columnVisible,
  isVisible,
  applyVisible: applyColumns,
  reset: resetColumns,
} = useTableColumns('system-user', [
  { key: 'avatar', label: '头像' },
  { key: 'username', label: '账号', fixed: true },
  { key: 'nickname', label: '昵称' },
  { key: 'dept', label: '部门 / 岗位' },
  { key: 'roles', label: '角色' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '手机号' },
  { key: 'gender', label: '性别' },
  { key: 'status', label: '状态' },
  { key: 'lastLogin', label: '最后登录' },
  { key: 'action', label: '操作', fixed: true },
]);

async function handleDelete(row: UserDetail): Promise<void> {
  if (row.isSuperAdmin) {
    ElMessage.warning('超级管理员不可删除');
    return;
  }
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteUserApi(row.id);
  ElMessage.success('删除成功');
  await getList();
}

/**
 * 切换启用状态。
 * 该操作需 system:user:edit 权限；开关位于表格插槽内，且需处理「无权限时回滚视觉状态」，
 * 故用函数显式判定而非 v-permission 指令。操作前二次确认，取消则不变更。
 */
async function handleStatusChange(row: UserDetail): Promise<void> {
  if (row.isSuperAdmin) {
    ElMessage.warning('超级管理员不可禁用');
    return;
  }
  if (!hasPermission('system:user:edit')) {
    ElMessage.warning('无操作权限，无法修改用户状态');
    return;
  }
  const next = row.status === 1 ? 0 : 1;
  try {
    await ElMessageBox.confirm(`确定要${statusLabel(next)}用户「${row.username}」吗？`, '提示', {
      type: 'warning',
    });
  } catch {
    // 取消：开关随 :model-value 保持原状，无需额外回滚
    return;
  }
  try {
    await updateUserStatusApi(row.id, next);
    row.status = next;
    ElMessage.success(`已${statusLabel(next)}`);
  } catch {
    // 失败保持原状
  }
}

/** 重置密码 */
async function handleResetPwd(row: UserDetail): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(`请输入「${row.username}」的新密码`, '重置密码', {
      inputPattern: PASSWORD_REGEX,
      inputErrorMessage: PASSWORD_MESSAGE,
      confirmButtonText: '确定',
      cancelButtonText: '取消',
    });
    await resetUserPasswordApi(row.id, value);
    ElMessage.success('密码重置成功');
  } catch {
    // 取消或失败
  }
}

/** 分配角色 */
function handleAssignRole(row: UserDetail): void {
  assignUserId.value = row.id;
  assignRoleIds.value = row.roles?.map((role) => role.id) ?? [];
  assignVisible.value = true;
}

/** 表单提交成功 */
function handleFormSuccess(): void {
  void getList();
}

onMounted(() => {
  void loadRoles();
  void loadDepts();
});
</script>

<template>
  <div class="user-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="用户名">
        <el-input v-model="query.username" placeholder="请输入用户名" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="部门">
        <el-tree-select
          v-model="query.deptId"
          :data="deptTree"
          :props="{ label: 'deptName', children: 'children' }"
          node-key="id"
          check-strictly
          :render-after-expand="false"
          placeholder="全部"
          clearable
          style="width: 180px"
        />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[15px] font-semibold text-ink">用户列表</span>
        <div class="flex items-center gap-2">
          <el-button
            v-permission="'system:user:remove'"
            type="danger"
            plain
            :disabled="selected.length === 0"
            :loading="deleting"
            @click="removeSelected"
          >
            批量删除{{ selected.length > 0 ? `（${selected.length}）` : '' }}
          </el-button>
          <el-button v-permission="'system:user:add'" type="primary" @click="handleAdd">
            <template #icon><i class="bi bi-plus" /></template>
            新增用户
          </el-button>
          <ColumnSettings
            :columns="columnOptions"
            :model-value="columnVisible"
            @update:model-value="applyColumns"
            @reset="resetColumns"
          />
        </div>
      </div>

      <el-table v-loading="loading" :data="list" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" :selectable="selectableUser" />
        <el-table-column v-if="isVisible('avatar')" label="头像" width="80" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="withUploadToken(row.avatar)">
              <el-icon aria-hidden="true"><i class="bi bi-person-fill" /></el-icon>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column v-if="isVisible('nickname')" prop="nickname" label="昵称" min-width="120" />
        <el-table-column v-if="isVisible('dept')" label="部门 / 岗位" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptName || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isVisible('roles')" label="角色" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="role in row.roles || []" :key="role.id" size="small" class="mr-1">
              {{ role.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('email')" prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column v-if="isVisible('phone')" prop="phone" label="手机号" width="130" />
        <el-table-column v-if="isVisible('gender')" label="性别" width="80" align="center">
          <template #default="{ row }">
            <span>{{ genderLabel(row.gender) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('status')" label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :disabled="row.isSuperAdmin"
              :title="row.isSuperAdmin ? '超级管理员不可禁用' : ''"
              @change="handleStatusChange(row as UserDetail)"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="isVisible('lastLogin')" label="最后登录" width="180">
          <template #default="{ row }">{{ formatDateTime(row.lastLoginAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button v-permission="'system:user:edit'" type="primary" link @click="handleEdit(row as UserDetail)">
                编辑
              </el-button>
              <el-button
                v-permission="'system:user:assignRole'"
                type="warning"
                link
                @click="handleAssignRole(row as UserDetail)"
              >
                角色
              </el-button>
              <el-button
                v-permission="'system:user:resetPwd'"
                type="info"
                link
                @click="handleResetPwd(row as UserDetail)"
              >
                重置
              </el-button>
              <el-button
                v-permission="'system:user:remove'"
                type="danger"
                link
                :disabled="row.isSuperAdmin"
                :title="row.isSuperAdmin ? '超级管理员不可删除' : ''"
                @click="handleDelete(row as UserDetail)"
              >
                删除
              </el-button>
            </div>
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

    <UserForm v-model="formVisible" :user-id="editId" :role-options="roleOptions" @success="handleFormSuccess" />

    <AssignRoleDialog
      v-model="assignVisible"
      :user-id="assignUserId"
      :role-ids="assignRoleIds"
      :role-options="roleOptions"
      @success="handleFormSuccess"
    />
  </div>
</template>
