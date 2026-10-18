<script setup lang="ts">
/** 部门 / 岗位管理页。模块职责：以树表展示部门与岗位并支持新增、编辑、删除；新增时可指定类型为部门或岗位。 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { deleteDeptApi, getDeptListApi } from '@/api/dept';
import { useStatusDict } from '@/composables/useDict';
import type { DeptNode } from '@/types/api';
import DeptForm from './components/DeptForm.vue';

defineOptions({ name: 'SystemDept' });

const loading = ref(false);
const deptTree = ref<DeptNode[]>([]);
const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);

/** 状态字典（字典管理 → 通用状态 sys_common_status），用于列表状态列文案 */
const { statusLabel } = useStatusDict();

/** 部门 / 岗位数量：展平树按 deptType 计数（1 部门 / 2 岗位） */
const typeCounts = computed(() => {
  let dept = 0;
  let post = 0;
  const walk = (nodes: DeptNode[]): void => {
    for (const node of nodes) {
      if (node.deptType === 2) {
        post += 1;
      } else {
        dept += 1;
      }
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };
  walk(deptTree.value);
  return { dept, post };
});

/** 加载部门树 */
async function loadTree(): Promise<void> {
  loading.value = true;
  try {
    const res = await getDeptListApi({ tree: 1 });
    deptTree.value = res ?? [];
  } finally {
    loading.value = false;
  }
}

/** 新增 */
function handleAdd(parentId?: number): void {
  // 若从某行「新增下级」进入，可在表单内默认上级；此处不预设，由用户在表单中选择
  // （首次新增时还没有任何部门，表单不展示「上级部门」，保存后即为顶级部门）
  void parentId;
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: DeptNode): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除 */
async function handleDelete(row: DeptNode): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${row.deptName}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteDeptApi(row.id);
  ElMessage.success('删除成功');
  await loadTree();
}

onMounted(() => {
  void loadTree();
});
</script>

<template>
  <div class="dept-page">
    <el-card shadow="never">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[15px] font-semibold text-ink">部门 / 岗位列表</span>
          <el-tag type="primary" effect="plain" size="small">部门 {{ typeCounts.dept }}</el-tag>
          <el-tag type="warning" effect="plain" size="small">岗位 {{ typeCounts.post }}</el-tag>
        </div>
        <div class="flex items-center gap-2">
          <el-button @click="loadTree">
            <template #icon><i class="bi bi-arrow-clockwise" /></template>刷新</el-button
          >
          <el-button v-permission="'system:dept:add'" type="primary" @click="handleAdd()">
            <template #icon><i class="bi bi-plus" /></template>
            新增
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="deptTree"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        border
      >
        <el-table-column prop="deptName" label="名称" min-width="180" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.deptType === 2 ? 'warning' : 'primary'" size="small">
              {{ row.deptType === 2 ? '岗位' : '部门' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="leader" label="负责人" min-width="120" show-overflow-tooltip />
        <el-table-column prop="phone" label="联系电话" min-width="140" show-overflow-tooltip />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="80" align="center" />
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button v-permission="'system:dept:edit'" type="primary" link @click="handleEdit(row as DeptNode)">
                编辑
              </el-button>
              <el-button v-permission="'system:dept:remove'" type="danger" link @click="handleDelete(row as DeptNode)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <DeptForm v-model="formVisible" :dept-id="editId" @success="loadTree" />
  </div>
</template>
