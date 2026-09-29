<script setup lang="ts">
/**
 * Vditor Markdown 编辑器封装。
 * 模块职责：把第三方 Vditor 收敛为一个受控组件（v-model + 只读 + 主题联动 + 生命周期清理），
 * 业务侧只需 `<VditorEditor v-model="content" />` 即可，无需关心实例创建与销毁。
 *
 * 关键设计：
 * - **懒加载**：`import('vditor')` 动态引入，仅在使用本组件的页面才加载（含 lute wasm 等资源）；
 * - **资源自托管**：`cdn` 指向 `/vditor`（见 `admin/public/vditor/`），不依赖外部网络；
 * - **主题联动**：跟随 app store 的暗黑模式切换编辑器主题；
 * - **受控**：关闭 Vditor 的 localStorage 缓存，内容完全由外部 v-model 掌控。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from '@/utils/element';
import type VditorType from 'vditor';
import { useAppStore } from '@/store/modules/app';
import { getAccessToken } from '@/utils/auth';

defineOptions({ name: 'VditorEditor' });

const props = withDefaults(
  defineProps<{
    /** Markdown 内容（v-model） */
    modelValue?: string;
    /** 编辑器高度（px 或 CSS 尺寸） */
    height?: number | string;
    /** 空内容占位提示 */
    placeholder?: string;
    /** 是否只读 */
    readonly?: boolean;
    /** 编辑模式：ir 即时渲染 / wysiwyg 所见即所得 / sv 分屏预览 */
    mode?: 'ir' | 'wysiwyg' | 'sv';
  }>(),
  {
    modelValue: '',
    height: 480,
    placeholder: '请输入内容…',
    readonly: false,
    mode: 'ir',
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'ready'): void;
}>();

/**
 * Vditor 静态资源根路径（自托管）。
 * Vditor 会按需从 `${cdn}/dist/...` 加载 emoji、内容主题、代码高亮、KaTeX、mermaid 等资源。
 * 若要启用未自托管的能力（流程图 / 脑图 / 五线谱等），请把对应 `dist/js/<name>` 一并拷入
 * `admin/public/vditor/dist/js/`，无需改动本组件。
 */
const VDITOR_CDN = '/vditor';

/**
 * 工具栏：不显式指定 `toolbar` → Vditor 使用其内置**完整默认工具栏**（emoji / 标题 / 加粗 …
 * 上传 / 录制 / more 等全部包含）。按需求「要全部」。
 *
 * 注：`more` 菜单里的图表 / 脑图 / 五线谱 / 流程图 等需要额外自托管渲染器
 * （echarts、abcjs、markmap…），当前 `public/vditor/dist/js/` 未包含，点开那些子项会因缺少
 * 渲染器而报错；如要使用，把对应 `node_modules/vditor/dist/js/<name>` 拷入自托管目录即可。
 */

/**
 * 文件上传：接入后端既有 `/api/files/upload`（需要 `file:upload` 权限）。
 * 后端返回 `{ code, message, data: FileItem[] }`，而 Vditor 期望 `{ code:0, data:{ succMap, errFiles } }`，
 * 用 `format` 做适配；鉴权靠 `setHeaders` 每次读取最新 Bearer Token
 * （Vditor 自行发起 XHR，不走前端请求封装，故需手动注入）。
 */
const VDITOR_UPLOAD = {
  url: '/api/files/upload',
  // 每次上传前刷新请求头，保证 token 失效/刷新后仍可用
  setHeaders: () => ({ Authorization: `Bearer ${getAccessToken()}` }),
  format: (files: File[], responseText: string): string => {
    try {
      const res = JSON.parse(responseText) as {
        data?: Array<{ originName?: string; fileName?: string; fileUrl?: string }>;
      };
      const items = Array.isArray(res.data) ? res.data : [];
      const succMap: Record<string, string> = {};
      for (const item of items) {
        if (item?.fileUrl) {
          succMap[item.originName || item.fileName || ''] = item.fileUrl;
        }
      }
      return JSON.stringify({ code: 0, msg: '', data: { errFiles: [], succMap } });
    } catch {
      return JSON.stringify({
        code: 1,
        msg: '上传失败：响应解析错误',
        data: { errFiles: files.map((f) => f.name), succMap: {} },
      });
    }
  },
  error: (msg: string) => {
    ElMessage.error(msg || '图片上传失败');
  },
};

const appStore = useAppStore();
const containerRef = ref<HTMLDivElement>();

/** Vditor 实例（懒加载完成后赋值） */
let vditor: VditorType | null = null;
/** 组件是否已卸载：异步初始化返回后不再操作实例 */
let unmounted = false;
/** 同步标记：避免 setValue 触发的 input 回调再 emit，造成父子循环更新 */
let syncing = false;

/** 当前亮暗主题对应的 Vditor 主题 */
function currentTheme(): 'classic' | 'dark' {
  return appStore.dark ? 'dark' : 'classic';
}

/** 当前亮暗主题对应的内容主题 */
function currentContentTheme(): 'light' | 'dark' {
  return appStore.dark ? 'dark' : 'light';
}

/** 初始化编辑器（动态加载 vditor 与其样式，避免进入主包） */
async function init(): Promise<void> {
  const el = containerRef.value;
  if (!el) {
    return;
  }
  const [vditorModule] = await Promise.all([import('vditor'), import('vditor/dist/index.css')]);
  if (unmounted) {
    return;
  }
  vditor = new vditorModule.default(el, {
    height: props.height,
    placeholder: props.placeholder,
    mode: props.mode,
    theme: currentTheme(),
    cdn: VDITOR_CDN,
    lang: 'zh_CN',
    icon: 'ant',
    // 工具栏：不显式指定 → 使用 Vditor 内置完整默认工具栏（含上传 / more 等全部按钮）
    upload: VDITOR_UPLOAD,
    // 内容由外部 v-model 掌控，关闭内置 localStorage 缓存
    cache: { enable: false },
    counter: { enable: true },
    preview: {
      theme: { current: currentContentTheme() },
      hljs: { style: 'github', lineNumber: true },
      math: { engine: 'KaTeX' },
    },
    input: (value: string) => {
      // setValue 引发的回调不向外 emit，避免回环
      if (syncing) {
        return;
      }
      emit('update:modelValue', value);
    },
    after: () => {
      syncing = true;
      vditor?.setValue(props.modelValue ?? '');
      syncing = false;
      if (props.readonly) {
        vditor?.disabled();
      }
      emit('ready');
    },
  });
}

/** 外部内容变化 → 同步到编辑器（内容一致时不打断输入/光标） */
watch(
  () => props.modelValue,
  (value) => {
    if (!vditor) {
      return;
    }
    const next = value ?? '';
    if (next === vditor.getValue()) {
      return;
    }
    syncing = true;
    vditor.setValue(next);
    syncing = false;
  },
);

/** 亮暗切换 → 联动编辑器主题与内容主题 */
watch(
  () => appStore.dark,
  (dark) => {
    vditor?.setTheme(dark ? 'dark' : 'classic', dark ? 'dark' : 'light');
  },
);

/** 只读切换 */
watch(
  () => props.readonly,
  (readonly) => {
    if (readonly) {
      vditor?.disabled();
    } else {
      vditor?.enable();
    }
  },
);

onMounted(() => {
  void init();
});

onBeforeUnmount(() => {
  unmounted = true;
  vditor?.destroy();
  vditor = null;
});
</script>

<template>
  <div ref="containerRef" class="vditor-editor-wrapper" />
</template>

<style scoped>
.vditor-editor-wrapper {
  width: 100%;
  min-width: 0;
}
</style>
