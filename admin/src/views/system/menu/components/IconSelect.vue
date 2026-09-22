<script setup lang="ts">
import { computed, ref } from 'vue';
import * as ElementPlusIcons from '@element-plus/icons-vue';
import { Search } from '@element-plus/icons-vue';

defineOptions({ name: 'IconSelect' });

defineProps<{
  /** 当前选中的图标名 */
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const visible = ref(false);
const keyword = ref('');

/** 全部图标名 */
const iconNames = Object.keys(ElementPlusIcons);

/** 过滤后的图标名 */
const filteredIcons = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  if (!key) {
    return iconNames;
  }
  return iconNames.filter((name) => name.toLowerCase().includes(key));
});

/** 打开选择弹层 */
function handleOpen(): void {
  visible.value = true;
}

/** 选择图标 */
function handleSelect(name: string): void {
  emit('update:modelValue', name);
  visible.value = false;
}
</script>

<template>
  <div class="icon-select flex items-center gap-2">
    <el-input :model-value="modelValue" placeholder="请选择图标" readonly style="width: 220px">
      <template #prefix>
        <el-icon v-if="modelValue"><component :is="modelValue" /></el-icon>
      </template>
    </el-input>
    <el-button @click="handleOpen">选择图标</el-button>

    <el-dialog v-model="visible" title="选择图标" width="620px" append-to-body>
      <el-input v-model="keyword" :prefix-icon="Search" placeholder="搜索图标" clearable class="mb-3" />
      <el-scrollbar height="360px">
        <div class="icon-grid flex flex-wrap">
          <div
            v-for="name in filteredIcons"
            :key="name"
            class="icon-cell flex-center"
            :class="{ active: name === modelValue }"
            :title="name"
            @click="handleSelect(name)"
          >
            <el-icon :size="20"><component :is="name" /></el-icon>
          </div>
        </div>
      </el-scrollbar>
    </el-dialog>
  </div>
</template>

<style scoped>
.icon-grid {
  gap: 4px;
}

.icon-cell {
  width: 42px;
  height: 42px;
  cursor: pointer;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.icon-cell:hover {
  color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.icon-cell.active {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}
</style>
