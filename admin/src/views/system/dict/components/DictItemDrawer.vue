<script setup lang="ts">
/** 字典项抽屉。模块职责：维护某个字典类型下的字典项（查询、增删改、启停），并同步清理字典缓存。 */
import { reactive, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { BIconPlus } from 'bootstrap-icons-vue';
import {
  createDictItemApi,
  deleteDictItemApi,
  getDictItemListApi,
  setDictItemStatusApi,
  updateDictItemApi,
} from '@/api/dict';
import { clearDictCache, useStatusDict } from '@/composables/useDict';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import { hasPermission } from '@/utils/permission';
import type { DictItem, DictItemUpsert, PageResult } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';
import Pagination from '@/components/Pagination/index.vue';
import { useResponsiveSize } from '@/composables/useResponsiveSize';

defineOptions({ name: 'DictItemDrawer' });

const props = defineProps<{
  /** 抽屉可见性 */
  modelValue: boolean;
  /** 所属字典类型编码 */
  dictType: string;
  /** 所属字典名称（展示用） */
  dictName: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

/** 状态选项：来自字典管理中的「通用状态」（sys_common_status） */
const { statusOptions } = useStatusDict();

/** 抽屉响应式尺寸：桌面 860px，窄屏自动铺满，避免移动端超出屏幕 */
const { size: drawerSize } = useResponsiveSize(860);

/* ------------------------------ 列表 ------------------------------ */

const { loading, list, total, query, getList, search, reset, changePage, changePageSize } = useTable(
  (p): Promise<PageResult<DictItem>> => {
    // 抽屉由外部 watch 打开时触发拉取，dictType 必传；此处兜底空结果，避免传入空类型查询
    if (!props.dictType) {
      return Promise.resolve({ list: [], total: 0, page: p.page, pageSize: p.pageSize });
    }
    return getDictItemListApi({
      dictType: props.dictType,
      page: p.page,
      pageSize: p.pageSize,
      dictLabel: p.dictLabel || undefined,
    });
  },
  { dictLabel: '' },
  { immediate: false },
);

/** 删除 */
async function handleDelete(row: DictItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除字典项「${row.dictLabel}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteDictItemApi(row.id);
  ElMessage.success('删除成功');
  clearDictCache(props.dictType);
  await getList();
}

/**
 * 启用 / 禁用。
 * 字典项是「细粒度、可逆」的维护操作，不额外弹二次确认（删除才弹）。
 */
async function handleToggleStatus(row: DictItem): Promise<void> {
  const next = row.status === 1 ? 0 : 1;
  await setDictItemStatusApi(row.id, next);
  ElMessage.success(next === 1 ? '已启用' : '已禁用');
  clearDictCache(props.dictType);
  await getList();
}

/* ------------------------------ 新增 / 编辑 ------------------------------ */

const itemFormVisible = ref(false);
const editingItem = ref<DictItem | null>(null);
const itemFormRef = ref<FormInstance>();
const itemSubmitting = ref(false);

const defaultItemForm = (): DictItemUpsert => ({
  dictLabel: '',
  dictValue: '',
  sort: 0,
  status: 1,
  remark: '',
});

const itemForm = reactive<DictItemUpsert>(defaultItemForm());

const itemRules: FormRules = {
  dictLabel: [{ required: true, message: '请输入字典标签', trigger: 'blur' }],
  dictValue: [{ required: true, message: '请输入字典值', trigger: 'blur' }],
};

/** 打开新增 */
function handleAddItem(): void {
  editingItem.value = null;
  Object.assign(itemForm, defaultItemForm());
  itemFormRef.value?.clearValidate();
  itemFormVisible.value = true;
}

/** 打开编辑 */
function handleEditItem(row: DictItem): void {
  editingItem.value = row;
  Object.assign(itemForm, {
    dictLabel: row.dictLabel,
    dictValue: row.dictValue,
    sort: row.sort,
    status: row.status,
    remark: row.remark ?? '',
  });
  itemFormRef.value?.clearValidate();
  itemFormVisible.value = true;
}

/** 提交字典项 */
async function handleItemSubmit(): Promise<void> {
  if (!itemFormRef.value) {
    return;
  }
  const valid = await itemFormRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  itemSubmitting.value = true;
  try {
    if (editingItem.value) {
      await updateDictItemApi(editingItem.value.id, {
        dictLabel: itemForm.dictLabel,
        dictValue: itemForm.dictValue,
        sort: itemForm.sort,
        status: itemForm.status,
        remark: itemForm.remark,
      });
      ElMessage.success('更新成功');
    } else {
      await createDictItemApi({ ...itemForm, dictType: props.dictType });
      ElMessage.success('新增成功');
    }
    clearDictCache(props.dictType);
    itemFormVisible.value = false;
    await getList();
  } finally {
    itemSubmitting.value = false;
  }
}

/** 关闭抽屉 */
function handleClose(): void {
  emit('update:modelValue', false);
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      query.dictLabel = '';
      query.page = 1;
      void getList();
    }
  },
);
</script>

<template>
  <el-drawer :model-value="modelValue" :title="`字典项 · ${dictName}`" :size="drawerSize" @close="handleClose">
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <el-input
        v-model="query.dictLabel"
        placeholder="请输入字典标签"
        clearable
        style="width: 200px"
        @keyup.enter="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
      <el-button
        v-permission="'system:dict:add'"
        type="primary"
        :icon="BIconPlus"
        class="ml-auto"
        @click="handleAddItem"
      >
        新增字典项
      </el-button>
    </div>

    <el-table v-loading="loading" :data="list" max-height="400">
      <el-table-column prop="dictLabel" label="字典标签" min-width="140" show-overflow-tooltip />
      <el-table-column prop="dictValue" label="字典值" min-width="120" show-overflow-tooltip />
      <el-table-column prop="sort" label="排序" width="80" align="center" />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-switch
            :model-value="row.status === 1"
            :disabled="!hasPermission('system:dict:edit')"
            @change="handleToggleStatus(row as DictItem)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <div class="table-action">
            <el-button v-permission="'system:dict:edit'" type="primary" link @click="handleEditItem(row as DictItem)">
              编辑
            </el-button>
            <el-button v-permission="'system:dict:remove'" type="danger" link @click="handleDelete(row as DictItem)">
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

    <BasicDialog
      v-model="itemFormVisible"
      :title="editingItem ? '编辑字典项' : '新增字典项'"
      width="520px"
      append-to-body
      :confirm-loading="itemSubmitting"
      @confirm="handleItemSubmit"
    >
      <el-form ref="itemFormRef" :model="itemForm" :rules="itemRules" label-width="110px">
        <el-form-item label="所属类型">
          <el-input :model-value="dictType" disabled />
        </el-form-item>
        <el-form-item label="字典标签" prop="dictLabel">
          <el-input v-model="itemForm.dictLabel" placeholder="展示文案，如 男" />
        </el-form-item>
        <el-form-item label="字典值" prop="dictValue">
          <el-input v-model="itemForm.dictValue" placeholder="业务存储值，如 1（同类型内唯一）" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="itemForm.sort" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="itemForm.status">
            <el-radio v-for="option in statusOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="itemForm.remark" type="textarea" :rows="2" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
    </BasicDialog>
  </el-drawer>
</template>
