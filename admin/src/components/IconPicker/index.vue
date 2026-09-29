<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BIconSearch } from 'bootstrap-icons-vue';
import { appIconNames } from '@/utils/icons';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';

defineOptions({ name: 'IconPicker' });

defineProps<{
  /** 当前选中的图标名 */
  modelValue?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

/** 每批渲染的图标数量，避免一次性挂载全部图标 SVG。 */
const BATCH_SIZE = 200;

/** 滚动到底部的提前触发距离（px）。 */
const SCROLL_THRESHOLD = 100;

const keyword = ref('');
/** 当前已渲染的图标数量上限 */
const visibleCount = ref(BATCH_SIZE);
/** 图标网格容器，用于定位 el-scrollbar 的滚动容器 */
const gridRef = ref<HTMLElement | null>(null);

/** 过滤后的图标名（完整结果，用于搜索匹配与总数展示）。候选来自已注册图标，保证「可选即可用」。 */
const filteredIcons = computed(() => {
  const key = keyword.value.trim().toLowerCase();
  if (!key) {
    return appIconNames;
  }
  return appIconNames.filter((name) => name.toLowerCase().includes(key));
});

/** 实际渲染到 DOM 的图标名（仅一个窗口，避免一次性创建大量节点） */
const renderedIcons = computed(() => filteredIcons.value.slice(0, visibleCount.value));

// 关键词变化后重置窗口，否则会出现残留过多节点或列表空白
watch(keyword, () => {
  visibleCount.value = BATCH_SIZE;
});

/** 追加下一批图标 */
function loadMore(): void {
  visibleCount.value = Math.min(visibleCount.value + BATCH_SIZE, filteredIcons.value.length);
}

/** 滚动接近底部时加载下一批 */
function handleScroll({ scrollTop }: { scrollTop: number }): void {
  const wrap = gridRef.value?.closest('.el-scrollbar__wrap') as HTMLElement | null;
  if (!wrap || visibleCount.value >= filteredIcons.value.length) {
    return;
  }
  if (scrollTop + wrap.clientHeight >= wrap.scrollHeight - SCROLL_THRESHOLD) {
    loadMore();
  }
}

/** 选择图标 */
function selectIcon(name: string): void {
  emit('update:modelValue', name);
}

/** 气泡响应式宽度：桌面 360px，窄屏留 8% 边距（92%），避免移动端超出屏幕 */
const { size: popoverWidth } = useResponsiveSize(360, '92%');
</script>

<template>
  <el-popover placement="bottom-start" :width="popoverWidth" trigger="click">
    <template #reference>
      <el-input :model-value="modelValue" placeholder="点击选择图标" readonly clearable />
    </template>
    <div class="icon-picker">
      <el-input v-model="keyword" :prefix-icon="BIconSearch" placeholder="搜索图标" clearable class="mb-2" />
      <el-scrollbar height="280px" @scroll="handleScroll">
        <div ref="gridRef" class="gap-1 flex flex-wrap">
          <div
            v-for="name in renderedIcons"
            :key="name"
            class="w-10 h-10 cursor-pointer border border-line-light rounded flex-center"
            :class="
              name === modelValue
                ? 'text-primary border-primary bg-[var(--el-color-primary-light-9)]'
                : 'hover:text-primary hover:border-primary'
            "
            role="button"
            tabindex="0"
            :title="name"
            :aria-label="name"
            @click="selectIcon(name)"
          >
            <el-icon :size="20">
              <component :is="name" />
            </el-icon>
          </div>
        </div>
      </el-scrollbar>
      <div class="mt-1.5 text-xs text-muted text-center">
        显示 {{ renderedIcons.length }} / {{ filteredIcons.length }}
        <template v-if="renderedIcons.length < filteredIcons.length">，滚动加载更多</template>
      </div>
    </div>
  </el-popover>
</template>
