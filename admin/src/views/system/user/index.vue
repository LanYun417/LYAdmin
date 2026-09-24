<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BIconPersonFill, BIconPlus } from 'bootstrap-icons-vue';
import { deleteUserApi, getUserListApi, resetUserPasswordApi, updateUserStatusApi } from '@/api/user';
import { getAllRolesApi } from '@/api/role';
import { hasPermission } from '@/utils/permission';
import { formatDateTime } from '@/utils/format';
import { PASSWORD_REGEX } from '@/utils/validate';
import type { RoleBrief, UserDetail } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import UserForm from './components/UserForm.vue';
import AssignRoleDialog from './components/AssignRoleDialog.vue';

defineOptions({ name: 'SystemUser' });

const loading = ref(false);
const list = ref<UserDetail[]>([]);
const total = ref(0);
const roleOptions = ref<RoleBrief[]>([]);

const query = reactive({
  username: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 10,
});

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);
const assignVisible = ref(false);
const assignUserId = ref<number | undefined>(undefined);
const assignRoleIds = ref<number[]>([]);

/** 加载用户列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getUserListApi({
      page: query.page,
      pageSize: query.pageSize,
      username: query.username || undefined,
      status: query.status,
    });
    list.value = res.list ?? [];
    total.value = res.total ?? 0;
  } finally {
    loading.value = false;
  }
}

/** 加载角色下拉（仅具备 system:role:all 的角色可拉取，避免无权限角色触发 403 整页跳转） */
async function loadRoles(): Promise<void> {
  if (!hasPermission('system:role:all')) {
    return;
  }
  roleOptions.value = await getAllRolesApi();
}

/** 查询 */
function handleSearch(): void {
  query.page = 1;
  void loadList();
}

/** 重置 */
function handleReset(): void {
  query.username = '';
  query.status = undefined;
  query.page = 1;
  void loadList();
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
async function handleDelete(row: UserDetail): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除用户「${row.username}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteUserApi(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

/**
 * 切换启用状态。
 * 该操作需 system:user:edit 权限；开关位于表格插槽内，且需处理「无权限时回滚视觉状态」，
 * 故用函数显式判定而非 v-permission 指令。操作前二次确认，取消则不变更。
 */
async function handleStatusChange(row: UserDetail): Promise<void> {
  if (!hasPermission('system:user:edit')) {
    ElMessage.warning('无操作权限，无法修改用户状态');
    return;
  }
  const next = row.status === 1 ? 0 : 1;
  try {
    await ElMessageBox.confirm(`确定要${next === 1 ? '启用' : '禁用'}用户「${row.username}」吗？`, '提示', {
      type: 'warning',
    });
  } catch {
    // 取消：开关随 :model-value 保持原状，无需额外回滚
    return;
  }
  try {
    await updateUserStatusApi(row.id, next);
    row.status = next;
    ElMessage.success(next === 1 ? '已启用' : '已禁用');
  } catch {
    // 失败保持原状
  }
}

/** 重置密码 */
async function handleResetPwd(row: UserDetail): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt(`请输入「${row.username}」的新密码`, '重置密码', {
      inputPattern: PASSWORD_REGEX,
      inputErrorMessage: '密码为 6-20 位字符',
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
  assignRoleIds.value = row.roleIds ?? (row.roles ?? []).map((role) => role.id);
  assignVisible.value = true;
}

/** 表单提交成功 */
function handleFormSuccess(): void {
  void loadList();
}

onMounted(() => {
  void loadList();
  void loadRoles();
});
</script>

<template>
  <div class="user-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="用户名">
        <el-input v-model="query.username" placeholder="请输入用户名" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option label="启用" :value="1" />
          <el-option label="禁用" :value="0" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3">
        <span class="table-title">用户列表</span>
        <el-button v-permission="'system:user:add'" type="primary" :icon="BIconPlus" @click="handleAdd">
          新增用户
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column label="头像" width="80" align="center">
          <template #default="{ row }">
            <el-avatar :size="36" :src="row.avatar">
              <el-icon><BIconPersonFill /></el-icon>
            </el-avatar>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column label="角色" min-width="180">
          <template #default="{ row }">
            <el-tag v-for="role in row.roles || []" :key="role.id" size="small" class="mr-1">
              {{ role.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-switch :model-value="row.status === 1" @change="handleStatusChange(row as UserDetail)" />
          </template>
        </el-table-column>
        <el-table-column label="最后登录" width="180">
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
                @click="handleDelete(row as UserDetail)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <Pagination v-model:page="query.page" v-model:page-size="query.pageSize" :total="total" @change="loadList" />
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

<style scoped>
.table-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
