<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import { BIconPlus } from 'bootstrap-icons-vue';
import { deleteRoleApi, getRoleListApi } from '@/api/role';
import { useStatusDict } from '@/hooks/useDict';
import { formatDateTime } from '@/utils/format';
import { DATA_SCOPE_OPTIONS, type Role } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import RoleForm from './components/RoleForm.vue';
import PermissionDrawer from './components/PermissionDrawer.vue';

defineOptions({ name: 'SystemRole' });

const loading = ref(false);
const list = ref<Role[]>([]);
const total = ref(0);

/** 状态字典（字典管理 → 通用状态 sys_common_status），驱动状态筛选与标签文案 */
const { statusOptions, statusLabel } = useStatusDict();

/** 数据范围标签 */
function dataScopeLabel(value?: number): string {
  return DATA_SCOPE_OPTIONS.find((item) => item.value === value)?.label ?? '全部数据';
}

const query = reactive({
  roleName: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 20,
});

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);
const permissionVisible = ref(false);
const permissionRoleId = ref<number | undefined>(undefined);
const permissionRoleName = ref('');

/** 加载角色列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getRoleListApi({
      page: query.page,
      pageSize: query.pageSize,
      roleName: query.roleName || undefined,
      status: query.status,
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
  query.roleName = '';
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
function handleEdit(row: Role): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除 */
async function handleDelete(row: Role): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除角色「${row.roleName}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteRoleApi(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

/** 分配权限 */
function handlePermission(row: Role): void {
  permissionRoleId.value = row.id;
  permissionRoleName.value = row.roleName;
  permissionVisible.value = true;
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="role-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="角色名称">
        <el-input v-model="query.roleName" placeholder="请输入角色名称" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[15px] font-semibold text-ink">角色列表</span>
        <el-button v-permission="'system:role:add'" type="primary" :icon="BIconPlus" @click="handleAdd">
          新增角色
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="roleName" label="角色名称" min-width="140" />
        <el-table-column prop="roleCode" label="角色编码" min-width="140" />
        <el-table-column prop="sort" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="数据范围" width="130" align="center">
          <template #default="{ row }">{{ dataScopeLabel((row as Role).dataScope) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button v-permission="'system:role:edit'" type="primary" link @click="handleEdit(row as Role)">
                编辑
              </el-button>
              <el-button
                v-permission="'system:role:assignMenu'"
                type="warning"
                link
                @click="handlePermission(row as Role)"
              >
                权限
              </el-button>
              <el-button v-permission="'system:role:remove'" type="danger" link @click="handleDelete(row as Role)">
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
        @size-change="loadList"
        @current-change="loadList"
      />
    </el-card>

    <RoleForm v-model="formVisible" :role-id="editId" @success="loadList" />

    <PermissionDrawer v-model="permissionVisible" :role-id="permissionRoleId" :role-name="permissionRoleName" />
  </div>
</template>
