<script setup lang="ts">
/** 字典类型管理页。模块职责：字典类型查询与增删改、启停，并进入字典项抽屉。 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { batchDeleteDictTypesApi, deleteDictTypeApi, getDictTypeListApi, setDictTypeStatusApi } from '@/api/dict';
import { useTable } from '@/composables/useTable';
import { useBatchDelete } from '@/composables/useBatchDelete';
import { clearDictCache, useStatusDict } from '@/composables/useDict';
import { formatDateTime } from '@/utils/format';
import { hasPermission } from '@/utils/permission';
import type { DictType } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import DictTypeForm from './components/DictTypeForm.vue';
import DictItemDrawer from './components/DictItemDrawer.vue';

defineOptions({ name: 'SystemDict' });

/** 状态字典（字典管理 → 通用状态 sys_common_status），驱动状态筛选与提示文案 */
const { statusOptions, statusLabel } = useStatusDict();

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getDictTypeListApi({
      page: p.page,
      pageSize: p.pageSize,
      dictName: p.dictName || undefined,
      dictType: p.dictType || undefined,
      status: p.status,
    }),
  { dictName: '', dictType: '', status: undefined as number | undefined },
);

/** 类型表单弹窗 */
const formVisible = ref(false);
const editingRow = ref<DictType | null>(null);

/** 字典项抽屉 */
const itemVisible = ref(false);
const itemDictType = ref('');
const itemDictName = ref('');

/**
 * 批量删除字典类型。
 * 批量删成功后需要清字典缓存：被删类型的下拉数据可能还挂在缓存里。
 */
const { selected, deleting, handleSelectionChange, removeSelected } = useBatchDelete<DictType>({
  batchApi: async (ids) => {
    const result = await batchDeleteDictTypesApi(ids);
    if (result.deleted > 0) {
      clearDictCache();
    }
    return result;
  },
  singleApi: deleteDictTypeApi,
  list,
  query,
  getList,
  noun: '字典类型',
});

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
  await getList();
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
  await getList();
}
</script>

<template>
  <div class="dict-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="字典名称">
        <el-input v-model="query.dictName" placeholder="请输入字典名称" clearable @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="类型编码">
        <el-input v-model="query.dictType" placeholder="请输入类型编码" clearable @keyup.enter="search" />
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
        <div class="flex items-center gap-2">
          <el-button
            v-permission="'system:dict:remove'"
            type="danger"
            plain
            :disabled="selected.length === 0"
            :loading="deleting"
            @click="removeSelected"
          >
            批量删除{{ selected.length > 0 ? `（${selected.length}）` : '' }}
          </el-button>
          <el-button v-permission="'system:dict:add'" type="primary" @click="handleAdd">
            <template #icon><i class="bi bi-plus" /></template>
            新增字典类型
          </el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="48" align="center" />
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
              <el-button v-permission="'system:dict:list'" type="warning" link @click="handleItems(row as DictType)">
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
        @size-change="changePageSize"
        @current-change="changePage"
      />
    </el-card>

    <DictTypeForm v-model="formVisible" :row="editingRow" @success="getList" />

    <DictItemDrawer v-model="itemVisible" :dict-type="itemDictType" :dict-name="itemDictName" />
  </div>
</template>
