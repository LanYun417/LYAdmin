<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BIconPlus, BIconTags } from 'bootstrap-icons-vue';
import { deleteDictTypeApi, getDictTypeListApi, setDictTypeStatusApi } from '@/api/dict';
import { clearDictCache, useStatusDict } from '@/hooks/useDict';
import { formatDateTime } from '@/utils/format';
import { hasPermission } from '@/utils/permission';
import type { DictType } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import DictTypeForm from './components/DictTypeForm.vue';
import DictItemDrawer from './components/DictItemDrawer.vue';

defineOptions({ name: 'SystemDict' });

const loading = ref(false);
const list = ref<DictType[]>([]);
const total = ref(0);

/** 状态字典（字典管理 → 通用状态 sys_common_status），驱动状态筛选与提示文案 */
const { statusOptions, statusLabel } = useStatusDict();

const query = reactive({
  dictName: '',
  dictType: '',
  status: undefined as number | undefined,
  page: 1,
  pageSize: 10,
});

/** 类型表单弹窗 */
const formVisible = ref(false);
const editingRow = ref<DictType | null>(null);

/** 字典项抽屉 */
const itemVisible = ref(false);
const itemDictType = ref('');
const itemDictName = ref('');

/** 加载字典类型列表 */
async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const res = await getDictTypeListApi({
      page: query.page,
      pageSize: query.pageSize,
      dictName: query.dictName || undefined,
      dictType: query.dictType || undefined,
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
  query.dictName = '';
  query.dictType = '';
  query.status = undefined;
  query.page = 1;
  void loadList();
}

/** 新增 */
function handleAdd(): void {
  editingRow.value = null;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: DictType): void {
  editingRow.value = row;
  formVisible.value = true;
}

/** 打开字典项抽屉 */
function handleItems(row: DictType): void {
  itemDictType.value = row.dictType;
  itemDictName.value = row.dictName;
  itemVisible.value = true;
}

/**
 * 启用 / 禁用字典类型。
 * 类型的启停会影响业务取数结果（禁用后该类型数据不再返回），故弹二次确认。
 */
async function handleToggleStatus(row: DictType): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  const action = statusLabel(next);
  try {
    await ElMessageBox.confirm(
      `确定${action}字典类型「${row.dictName}」吗？禁用后其字典数据将不再被业务接口返回。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await setDictTypeStatusApi(row.id, next);
  ElMessage.success(`已${action}`);
  clearDictCache(row.dictType);
  await loadList();
}

/** 删除（连带删除其下字典项） */
async function handleDelete(row: DictType): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除字典类型「${row.dictName}」吗？该类型下的所有字典项将一并删除，且不可恢复。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  await deleteDictTypeApi(row.id);
  ElMessage.success('删除成功');
  clearDictCache(row.dictType);
  await loadList();
}

onMounted(() => {
  void loadList();
});
</script>

<template>
  <div class="dict-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="字典名称">
        <el-input v-model="query.dictName" placeholder="请输入字典名称" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="类型编码">
        <el-input v-model="query.dictType" placeholder="请输入类型编码" clearable @keyup.enter="handleSearch" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.status" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="item in statusOptions" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">字典类型</span>
        <el-button v-permission="'system:dict:add'" type="primary" :icon="BIconPlus" @click="handleAdd">
          新增字典类型
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="dictName" label="字典名称" min-width="150" show-overflow-tooltip />
        <el-table-column prop="dictType" label="类型编码" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.status === 1"
              :disabled="!hasPermission('system:dict:edit')"
              @change="handleToggleStatus(row as DictType)"
            />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button v-permission="'system:dict:edit'" type="primary" link @click="handleEdit(row as DictType)">
                编辑
              </el-button>
              <el-button
                v-permission="'system:dict:list'"
                type="warning"
                link
                :icon="BIconTags"
                @click="handleItems(row as DictType)"
              >
                字典项
              </el-button>
              <el-button v-permission="'system:dict:remove'" type="danger" link @click="handleDelete(row as DictType)">
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

    <DictTypeForm v-model="formVisible" :row="editingRow" @success="loadList" />

    <DictItemDrawer v-model="itemVisible" :dict-type="itemDictType" :dict-name="itemDictName" />
  </div>
</template>
