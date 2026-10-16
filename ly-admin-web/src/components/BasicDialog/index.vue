<script setup lang="ts">
defineOptions({ name: 'BasicDialog', inheritAttrs: false });

interface Props {
  /** 是否显示弹窗 */
  modelValue: boolean;
  /** 弹窗标题 */
  title?: string;
  /** 桌面端宽度；视口 ≤768px 时自动压缩为 98%，固定宽度不再溢出移动端 */
  width?: string | number;
  /** 确定按钮 loading（使用默认 footer 时生效） */
  confirmLoading?: boolean;
  /** 确定按钮禁用（使用默认 footer 时生效） */
  confirmDisabled?: boolean;
  /** 是否渲染默认 footer（取消/确定）；自定义 footer 时用 #footer 插槽，无需关心此值 */
  showFooter?: boolean;
  cancelText?: string;
  confirmText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '520px',
  confirmLoading: false,
  confirmDisabled: false,
  showFooter: true,
  cancelText: '取消',
  confirmText: '确定',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  /** 默认 footer 的确定按钮回调：表单校验与提交由调用方处理 */
  (e: 'confirm'): void;
}>();

/** 显隐双向绑定 */
const visible = defineModel<boolean>({ required: true });

const { width: windowWidth } = useWindowSize();

/** 响应式宽度：小屏自动压缩 */
const responsiveWidth = computed(() => {
  if (windowWidth.value <= 768) {
    return '98%';
  }
  return typeof props.width === 'number' ? `${props.width}px` : props.width;
});

/** 取消：仅关闭弹窗，由调用方通过 v-model / update:modelValue 感知 */
function handleCancel(): void {
  visible.value = false;
}

/** 确定：关闭行为交由调用方（校验失败时不应关闭） */
function handleConfirm(): void {
  emit('confirm');
}
</script>

<template>
  <!--
    el-dialog 二次封装：
    - 默认禁止点击空白处关闭：防止手误点空白导致表单数据丢失；
      如个别弹窗确需开启，透传 :close-on-click-modal="true" 即可覆盖；
    - 其余 el-dialog 属性/事件经 v-bind="$attrs" 全量透传
      （append-to-body、destroy-on-close、@open、@closed 等）；
    - 默认 footer 为 取消/确定：确定只 emit confirm，是否关闭由调用方决定；
    - 自定义 footer 用 #footer 插槽；#header 插槽透传。
  -->
  <el-dialog v-model="visible" :title="title" :width="responsiveWidth" :close-on-click-modal="false" v-bind="$attrs">
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <slot />

    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
    <template v-else-if="showFooter" #footer>
      <el-button @click="handleCancel">{{ cancelText }}</el-button>
      <el-button type="primary" :loading="confirmLoading" :disabled="confirmDisabled" @click="handleConfirm">
        {{ confirmText }}
      </el-button>
    </template>
  </el-dialog>
</template>
