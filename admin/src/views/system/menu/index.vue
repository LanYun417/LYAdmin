<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BIconArrowClockwise, BIconPlus } from 'bootstrap-icons-vue';
import { deleteMenuApi, getMenuListApi } from '@/api/menu';
import type { MenuNode } from '@/types/api';
import MenuForm from './components/MenuForm.vue';

defineOptions({ name: 'SystemMenu' });

const loading = ref(false);
const menuTree = ref<MenuNode[]>([]);
const formVisible = ref(false);
const editId = ref<number | undefined>(undefined);

/** 加载菜单树 */
async function loadTree(): Promise<void> {
  loading.value = true;
  try {
    const res = await getMenuListApi({ tree: 1 });
    menuTree.value = res ?? [];
  } finally {
    loading.value = false;
  }
}

/** 新增 */
function handleAdd(): void {
  editId.value = undefined;
  formVisible.value = true;
}

/** 编辑 */
function handleEdit(row: MenuNode): void {
  editId.value = row.id;
  formVisible.value = true;
}

/** 删除 */
async function handleDelete(row: MenuNode): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除菜单「${row.menuName}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteMenuApi(row.id);
  ElMessage.success('删除成功');
  await loadTree();
}

/** 类型标签 */
function typeLabel(type: string): string {
  if (type === 'M') {
    return '目录';
  }
  if (type === 'C') {
    return '菜单';
  }
  return '按钮';
}

/** 类型标签颜色 */
function typeTagType(type: string): 'primary' | 'success' | 'warning' {
  if (type === 'M') {
    return 'primary';
  }
  if (type === 'C') {
    return 'success';
  }
  return 'warning';
}

onMounted(() => {
  void loadTree();
});
</script>

<template>
  <div class="menu-page">
    <el-card shadow="never">
      <div class="flex items-center justify-between mb-3">
        <span class="table-title">菜单列表</span>
        <div class="flex items-center gap-2">
          <el-button :icon="BIconArrowClockwise" @click="loadTree">刷新</el-button>
          <el-button v-permission="'system:menu:add'" type="primary" :icon="BIconPlus" @click="handleAdd">
            新增菜单
          </el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="menuTree"
        row-key="id"
        :tree-props="{ children: 'children' }"
        default-expand-all
        border
      >
        <el-table-column prop="menuName" label="菜单名称" min-width="180" />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.menuType)" size="small">
              {{ typeLabel(row.menuType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="图标" width="80" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.icon"><component :is="row.icon" /></el-icon>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路由路径" min-width="150" show-overflow-tooltip />
        <el-table-column prop="component" label="组件路径" min-width="180" show-overflow-tooltip />
        <el-table-column prop="permission" label="权限标识" min-width="160" show-overflow-tooltip />
        <el-table-column prop="sort" label="排序" width="80" align="center" />
        <el-table-column label="显示" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.visible === 1 ? 'success' : 'info'" size="small">
              {{ row.visible === 1 ? '显示' : '隐藏' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-action">
              <el-button v-permission="'system:menu:edit'" type="primary" link @click="handleEdit(row as MenuNode)">
                编辑
              </el-button>
              <el-button v-permission="'system:menu:remove'" type="danger" link @click="handleDelete(row as MenuNode)">
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <MenuForm v-model="formVisible" :menu-id="editId" @success="loadTree" />
  </div>
</template>

<style scoped>
.table-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
</style>
