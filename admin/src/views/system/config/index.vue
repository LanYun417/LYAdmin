<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BIconPlus } from 'bootstrap-icons-vue';
import { deleteConfigApi, getConfigListApi } from '@/api/config';
import type { SysConfigItem } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import ConfigForm from './components/ConfigForm.vue';

defineOptions({ name: 'SystemConfig' });

const loading = ref(false);
const list = ref<SysConfigItem[]>([]);
const total = ref(0);

const query = reactive({
  configName: '',
  configKey: '',
  page: 1,
  pageSize: 20,
});

const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);

/** 加载参数列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getConfigListApi({
      page: query.page,
      pageSize: query.pageSize,
      configName: query.configName || undefined,
      configKey: query.configKey || undefined,
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
  query.configName = '';
  query.configKey = '';
  query.page = 1;
  void loadList();
}

/** 新增 */
function handleAdd(): void {
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: SysConfigItem): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除 */
async function handleDelete(row: SysConfigItem): Promise<void> {
  if (row.systemFlag === 1) {
    ElMessage.warning('内置参数不可删除');
    return;
  }
  try {
    await ElMessageBox.confirm(`确定删除参数「${row.configName}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteConfigApi(row.id);
  ElMessage.success('删除成功');
  await loadList();
}

/** 表单提交成功 */
function handleFormSuccess(): void {
  void loadList();
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="config-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="参数名称">
        <el-input v-model="query.configName" placeholder="请输入参数名称" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="参数键名">
        <el-input v-model="query.configKey" placeholder="请输入参数键名" clearable @keyup.enter="handleSearch" />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">参数列表</span>
        <el-button v-permission="'system:config:add'" type="primary" :icon="BIconPlus" @click="handleAdd">
          新增参数
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="configName" label="参数名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="configKey" label="参数键名" min-width="220" show-overflow-tooltip />
        <el-table-column prop="configValue" label="参数值" min-width="140" show-overflow-tooltip />
        <el-table-column label="内置" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.systemFlag === 1 ? 'warning' : 'info'" size="small">
              {{ row.systemFlag === 1 ? '内置' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button
                v-permission="'system:config:edit'"
                type="primary"
                link
                @click="handleEdit(row as SysConfigItem)"
              >
                编辑
              </el-button>
              <el-button
                v-if="row.systemFlag !== 1"
                v-permission="'system:config:remove'"
                type="danger"
                link
                @click="handleDelete(row as SysConfigItem)"
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
        @size-change="loadList"
        @current-change="loadList"
      />
    </el-card>

    <ConfigForm v-model="formVisible" :config-id="editId" @success="handleFormSuccess" />
  </div>
</template>
