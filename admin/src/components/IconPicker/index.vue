<script setup lang="ts">
import { computed, ref } from 'vue';
import * as ElementPlusIcons from '@element-plus/icons-vue';
import { Search } from '@element-plus/icons-vue';

defineOptions({ name: 'IconPicker' });

defineProps<{
  /** 当前选中的图标名 */
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

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

/** 选择图标 */
function selectIcon(name: string): void {
  emit('update:modelValue', name);
}
</script>

<template>
  <el-popover placement="bottom-start" :width="360" trigger="click">
    <template #reference>
      <el-input :model-value="modelValue" placeholder="点击选择图标" readonly clearable />
    </template>
    <div class="icon-picker">
      <el-input v-model="keyword" :prefix-icon="Search" placeholder="搜索图标" clearable class="mb-2" />
      <el-scrollbar height="280px">
        <div class="icon-grid flex flex-wrap">
          <div
            v-for="name in filteredIcons"
            :key="name"
            class="icon-cell flex-center"
            :class="{ active: name === modelValue }"
            :title="name"
            @click="selectIcon(name)"
          >
            <el-icon :size="20">
              <component :is="name" />
            </el-icon>
          </div>
        </div>
      </el-scrollbar>
    </div>
  </el-popover>
</template>

<style scoped>
.icon-grid {
  gap: 4px;
}

.icon-cell {
  width: 40px;
  height: 40px;
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
