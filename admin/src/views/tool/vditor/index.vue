<script setup lang="ts">
/**
 * Vditor 编辑器示例页。
 * 模块职责：演示封装组件 `VditorEditor` 的用法（v-model 双向绑定、只读切换、主题联动），
 * 并实时回显 Markdown 源码，便于验证受控行为是否正常。
 *
 * 本页为纯前端示例，不涉及任何后端接口。
 */

import VditorEditor from '@/components/VditorEditor/index.vue';

defineOptions({ name: 'ToolVditor' });

/** 示例 Markdown：覆盖标题 / 强调 / 列表 / 任务 / 表格 / 引用 / 代码 / 数学 / 图表 / 表情 */
const SAMPLE = `# Vditor 编辑器示例

把 \`VditorEditor\` 作为**受控组件**使用，内容通过 \`v-model\` 双向绑定。

## 文本与列表
- **加粗**、*斜体*、~~删除线~~、\`行内代码\`
- 无序 / 有序 / 任务列表 👇

1. 第一步
2. 第二步

- [x] 已完成的事项
- [ ] 待办的事项

## 表格
| 名称 | 说明 | 备注 |
| --- | --- | --- |
| dictType | 字典类型编码 | 创建后不可修改 |
| dictValue | 字典值 | 同类型内唯一 |

> 引用块：Vditor 支持即时渲染（ir）、所见即所得（wysiwyg）、分屏预览（sv）三种模式。

## 代码块
\`\`\`ts
export function toDictItemBrief(item: DictItem): DictItemBrief {
  return { id: Number(item.id), dictLabel: item.dictLabel, dictValue: item.dictValue };
}
\`\`\`

## 数学公式（KaTeX，资源已自托管）
行内 $E = mc^2$，块级：

$$
\\int_{0}^{1} x^{2} \\, dx = \\frac{1}{3}
$$

## 图表（Mermaid，资源已自托管）
\`\`\`mermaid
graph LR
  A[浏览器] --> B[Express]
  B --> C[(MySQL)]
\`\`\`

## 表情
:tada: :rocket: :100:
`;

const content = ref<string>(SAMPLE);
const readonly = ref(false);

/** 字符数（按 Markdown 原文计） */
const charCount = computed(() => content.value.length);

/** 填充示例内容 */
function fillSample(): void {
  content.value = SAMPLE;
}

/** 清空 */
function clearAll(): void {
  content.value = '';
}
</script>

<template>
  <div class="vditor-page">
    <el-card shadow="never">
      <template #header>
        <div class="flex flex-wrap items-center justify-between gap-y-2">
          <span class="text-[15px] font-semibold text-ink">Vditor Markdown 编辑器</span>
          <div class="flex flex-wrap items-center gap-2">
            <el-tag type="info" size="small">v-model 受控</el-tag>
            <el-switch v-model="readonly" active-text="只读" inline-prompt />
            <el-button size="small" @click="fillSample">填充示例</el-button>
            <el-button size="small" @click="clearAll">清空</el-button>
          </div>
        </div>
      </template>

      <VditorEditor v-model="content" :readonly="readonly" :height="520" placeholder="在这里输入 Markdown…" />

      <p class="mt-2 text-xs text-muted">
        提示：编辑器资源（lute 引擎 / 代码高亮 / KaTeX / mermaid / emoji / 内容主题）已自托管于
        <code>admin/public/vditor/</code>，离线环境亦可正常渲染。
      </p>
    </el-card>

    <el-card shadow="never" class="mt-4">
      <template #header>
        <span class="text-[15px] font-semibold text-ink">实时 Markdown 源码（{{ charCount }} 字符）</span>
      </template>
      <pre class="m-0 max-h-80 overflow-auto rounded bg-fill-light px-3 py-2.5 font-mono text-xs leading-[1.6]">{{
        content
      }}</pre>
    </el-card>
  </div>
</template>
