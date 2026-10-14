<script setup lang="ts">
/**
 * 代码生成器页。
 * 模块职责：选择数据表并填写模块名 / 业务名后，预览生成文件、下载 ZIP，或直接写入项目目录（同名文件需确认覆盖）。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import type { AxiosError } from 'axios';
import { BIconArrowClockwise, BIconCodeSlash, BIconDownload, BIconMagic, BIconTable } from 'bootstrap-icons-vue';
import {
  createGenCodeApi,
  downloadGenCodeApi,
  getGenTableDetailApi,
  getGenTablesApi,
  previewGenCodeApi,
} from '@/api/gen';
import { formatDateTime } from '@/utils/format';
import { downloadBlob } from '@/utils/download';
import type { GenColumn, GenConfig, GenCreateResult, GenFile, GenTable } from '@/api/gen';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'ToolGen' });

/** 窄屏（< 1024px）：左右两栏改为上下堆叠，避免右侧内容被挤压 */
const isNarrowScreen = useMediaQuery('(max-width: 1023px)');
/** 移动端（< 768px）：弹窗等进一步放宽 */
const isMobileScreen = useMediaQuery('(max-width: 767px)');

/** 数据表列表高度：窄屏降低，避免单页过长 */
const tableHeight = computed<number>(() => (isNarrowScreen.value ? 400 : 560));
/** 字段列表高度：同上 */
const columnHeight = computed<number>(() => (isNarrowScreen.value ? 400 : 440));
/** 预览弹窗宽度：移动端放宽到 94% */
const previewWidth = computed<string>(() => (isMobileScreen.value ? '94%' : '70%'));

/** 表列表加载态 */
const tableLoading = ref(false);
/** 字段加载态 */
const columnLoading = ref(false);
/** 预览按钮加载态 */
const previewLoading = ref(false);
/** 下载按钮加载态 */
const downloadLoading = ref(false);
/** 生成到项目按钮加载态 */
const createLoading = ref(false);

/** 全部数据表 */
const tables = ref<GenTable[]>([]);
/** 搜索框关键字（未应用） */
const keyword = ref('');
/** 已应用的关键字（点击查询后生效） */
const appliedKeyword = ref('');
/** 当前选中的表 */
const currentTable = ref<GenTable | null>(null);
/** 当前表的字段 */
const columns = ref<GenColumn[]>([]);

/** 生成选项 */
const config = reactive<GenConfig>({
  tableName: '',
  moduleName: '',
  businessName: '',
  author: '',
});

/** 预览弹窗 */
const previewVisible = ref(false);
/** 预览文件列表 */
const previewFiles = ref<GenFile[]>([]);
/** 当前查看的文件路径 */
const activeFilePath = ref('');

/** 按表名 / 表注释过滤后的表列表（后端接口无查询参数，走前端过滤） */
const filteredTables = computed<GenTable[]>(() => {
  const key = appliedKeyword.value.trim().toLowerCase();
  if (!key) {
    return tables.value;
  }
  return tables.value.filter(
    (item) => item.tableName.toLowerCase().includes(key) || (item.tableComment ?? '').toLowerCase().includes(key),
  );
});

/** 当前查看的文件内容 */
const activeFileContent = computed<string>(() => {
  const file = previewFiles.value.find((item) => item.path === activeFilePath.value);
  return file ? file.content : '// 请选择左侧文件查看代码';
});

/** 模块名 / 业务名是否已填写（作者可空） */
const configReady = computed<boolean>(() => Boolean(config.tableName && config.moduleName && config.businessName));

/** 首字母大写 */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** 加载数据表列表 */
async function loadTables(): Promise<void> {
  tableLoading.value = true;
  try {
    tables.value = (await getGenTablesApi()) ?? [];
  } finally {
    tableLoading.value = false;
  }
}

/** 查询：应用关键字 */
function handleSearch(): void {
  appliedKeyword.value = keyword.value;
}

/** 重置：清空关键字 */
function handleReset(): void {
  keyword.value = '';
  appliedKeyword.value = '';
}

/**
 * 依据表名推导默认模块名 / 业务名。
 * 例：`sys_user` → 模块 `sys`、业务 `user`；`sys_user_role` → 模块 `sys`、业务 `userRole`。
 */
function fillConfigByTableName(tableName: string): void {
  const parts = tableName.split('_').filter((item) => item.length > 0);
  if (parts.length > 1) {
    config.moduleName = parts[0];
    config.businessName = parts[1] + parts.slice(2).map(capitalize).join('');
  } else {
    config.moduleName = 'system';
    config.businessName = parts.length === 1 ? parts[0] : '';
  }
}

/** 选中表：加载字段并填充默认生成选项 */
async function handleCurrentChange(row: GenTable | null): Promise<void> {
  if (!row || row.tableName === currentTable.value?.tableName) {
    return;
  }
  currentTable.value = row;
  config.tableName = row.tableName;
  fillConfigByTableName(row.tableName);
  columnLoading.value = true;
  try {
    const detail = await getGenTableDetailApi(row.tableName);
    columns.value = detail?.columns ?? [];
  } catch {
    columns.value = [];
  } finally {
    columnLoading.value = false;
  }
}

/** 组装提交给后端的生成配置 */
function buildGenConfig(): GenConfig {
  const payload: GenConfig = {
    tableName: config.tableName,
    moduleName: config.moduleName.trim(),
    businessName: config.businessName.trim(),
  };
  const author = config.author?.trim();
  if (author) {
    payload.author = author;
  }
  return payload;
}

/** 校验生成选项，返回错误信息；通过返回空串 */
function validateConfig(): string {
  if (!config.tableName) {
    return '请先在左侧选择一张数据表';
  }
  if (!config.moduleName.trim()) {
    return '请填写模块名';
  }
  if (!config.businessName.trim()) {
    return '请填写业务名';
  }
  return '';
}

/** 预览代码 */
async function handlePreview(): Promise<void> {
  const error = validateConfig();
  if (error) {
    ElMessage.warning(error);
    return;
  }
  previewLoading.value = true;
  try {
    const res = await previewGenCodeApi(buildGenConfig());
    previewFiles.value = res?.files ?? [];
    activeFilePath.value = previewFiles.value.length > 0 ? previewFiles.value[0].path : '';
    previewVisible.value = true;
  } finally {
    previewLoading.value = false;
  }
}

/** 下载 ZIP */
async function handleDownload(): Promise<void> {
  const error = validateConfig();
  if (error) {
    ElMessage.warning(error);
    return;
  }
  downloadLoading.value = true;
  try {
    const blob = await downloadGenCodeApi(buildGenConfig());
    // 后端异常时可能返回 JSON 错误体（而非 zip 二进制），这里做一次兜底识别
    if (blob && blob.type && blob.type.includes('application/json')) {
      const text = await blob.text();
      ElMessage.error(text || '下载失败，请稍后重试');
      return;
    }
    if (!blob) {
      ElMessage.error('下载失败，未获取到文件内容');
      return;
    }
    downloadBlob(blob, `${config.businessName.trim()}.zip`);
    ElMessage.success('代码已生成，下载已开始');
  } finally {
    downloadLoading.value = false;
  }
}

/** 展示生成结果与后续人工步骤 */
async function showCreateResult(result: GenCreateResult): Promise<void> {
  const lines = [
    `已写入 ${result.written.length} 个文件，自动接线：${result.injected.length > 0 ? result.injected.join('、') : '无'}`,
    '',
    ...result.manualSteps,
  ];
  await ElMessageBox.alert(lines.join('\n'), '生成成功', { customStyle: { whiteSpace: 'pre-line' } as never });
}

/**
 * 生成代码到项目目录。
 * 同名文件已存在时后端返回 409，此处弹确认框后携带 overwrite=true 重试。
 */
async function handleGenerate(overwrite = false): Promise<void> {
  const error = validateConfig();
  if (error) {
    ElMessage.warning(error);
    return;
  }
  createLoading.value = true;
  try {
    const result = await createGenCodeApi(buildGenConfig(), overwrite);
    await showCreateResult(result);
  } catch (e) {
    const status = (e as AxiosError)?.response?.status;
    if (status === 409) {
      const confirmed = await ElMessageBox.confirm(
        '检测到同名文件已存在，是否覆盖？覆盖后原文件内容将丢失。',
        '覆盖确认',
        { type: 'warning', confirmButtonText: '覆盖生成', cancelButtonText: '取消' },
      )
        .then(() => true)
        .catch(() => false);
      if (confirmed) {
        await handleGenerate(true);
      }
    }
    // 其它错误已由请求拦截器统一提示
  } finally {
    createLoading.value = false;
  }
}

/** 复制当前预览文件的内容 */
async function handleCopyCode(): Promise<void> {
  if (!activeFilePath.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(activeFileContent.value);
    ElMessage.success('代码已复制到剪贴板');
  } catch {
    ElMessage.warning('当前浏览器不支持自动复制，请手动选择复制');
  }
}

/** TS 类型标签配色 */
function tsTypeTag(tsType: string): 'success' | 'warning' | 'danger' | 'primary' {
  if (tsType === 'number') {
    return 'warning';
  }
  if (tsType === 'boolean') {
    return 'danger';
  }
  if (tsType === 'Date') {
    return 'primary';
  }
  return 'success';
}

onMounted(() => {
  void loadTables();
});
</script>

<template>
  <div class="gen-page">
    <SearchForm @search="handleSearch" @reset="handleReset">
      <el-form-item label="表名/注释">
        <el-input
          v-model="keyword"
          placeholder="请输入表名或表注释"
          clearable
          style="width: 220px"
          @keyup.enter="handleSearch"
        />
      </el-form-item>
    </SearchForm>

    <div class="flex flex-col gap-3 lg:flex-row">
      <!-- 左：数据表列表 -->
      <el-card shadow="never" class="w-full lg:w-[480px] lg:flex-none">
        <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
          <span class="text-[15px] font-semibold text-ink">数据表（{{ filteredTables.length }}）</span>
          <el-button :icon="BIconArrowClockwise" @click="loadTables">刷新</el-button>
        </div>

        <el-table
          v-loading="tableLoading"
          :data="filteredTables"
          highlight-current-row
          :height="tableHeight"
          @current-change="handleCurrentChange"
        >
          <el-table-column prop="tableName" label="表名" min-width="150" show-overflow-tooltip />
          <el-table-column prop="tableComment" label="注释" min-width="130" show-overflow-tooltip />
          <el-table-column prop="engine" label="引擎" width="90" align="center" />
          <el-table-column label="创建时间" width="170">
            <template #default="{ row }">{{ formatDateTime(row.createTime) }}</template>
          </el-table-column>
          <template #empty>
            <span class="text-[13px] text-muted">暂无数据表</span>
          </template>
        </el-table>
      </el-card>

      <!-- 右：生成选项 + 字段列表 -->
      <el-card shadow="never" class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
          <span class="text-[15px] font-semibold text-ink">
            生成配置
            <el-tag v-if="currentTable" size="small" type="info" class="ml-2">{{ currentTable.tableName }}</el-tag>
          </span>
          <div class="flex flex-wrap items-center gap-2">
            <el-button
              v-permission="'tool:gen:preview'"
              type="primary"
              plain
              :icon="BIconCodeSlash"
              :loading="previewLoading"
              :disabled="!currentTable"
              @click="handlePreview"
            >
              预览代码
            </el-button>
            <el-button
              v-permission="'tool:gen:download'"
              type="success"
              :icon="BIconDownload"
              :loading="downloadLoading"
              :disabled="!currentTable"
              @click="handleDownload"
            >
              下载 ZIP
            </el-button>
            <el-button
              v-permission="'tool:gen:create'"
              type="warning"
              :icon="BIconMagic"
              :loading="createLoading"
              :disabled="!currentTable"
              @click="handleGenerate(false)"
            >
              生成到项目
            </el-button>
          </div>
        </div>

        <el-form :inline="true" class="mb-1" @submit.prevent>
          <el-form-item label="模块名">
            <el-input
              v-model="config.moduleName"
              placeholder="如 system"
              clearable
              style="width: 160px"
              :disabled="!currentTable"
            />
          </el-form-item>
          <el-form-item label="业务名">
            <el-input
              v-model="config.businessName"
              placeholder="如 user"
              clearable
              style="width: 160px"
              :disabled="!currentTable"
            />
          </el-form-item>
          <el-form-item label="作者">
            <el-input
              v-model="config.author"
              placeholder="可留空"
              clearable
              style="width: 160px"
              :disabled="!currentTable"
            />
          </el-form-item>
        </el-form>

        <el-alert
          v-if="!configReady"
          type="info"
          :closable="false"
          show-icon
          title="请先在左侧选择数据表，并填写模块名与业务名（作者可留空）"
        />

        <el-table v-loading="columnLoading" :data="columns" :height="columnHeight">
          <el-table-column prop="columnName" label="列名" min-width="140" show-overflow-tooltip />
          <el-table-column prop="fieldName" label="字段名" min-width="140" show-overflow-tooltip />
          <el-table-column prop="columnType" label="列类型" min-width="130" show-overflow-tooltip />
          <el-table-column label="TS 类型" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="tsTypeTag(row.tsType)" size="small">{{ row.tsType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="columnComment" label="注释" min-width="150" show-overflow-tooltip />
          <el-table-column label="主键" width="80" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isPk" type="danger" size="small">主键</el-tag>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="必填" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isNullable ? 'info' : 'warning'" size="small">
                {{ row.isNullable ? '可选' : '必填' }}
              </el-tag>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty v-if="!currentTable" description="请选择左侧数据表以查看字段" :image-size="80">
              <el-icon aria-hidden="true"><BIconTable /></el-icon>
            </el-empty>
            <span v-else class="text-[13px] text-muted">该表暂无字段</span>
          </template>
        </el-table>
      </el-card>
    </div>

    <!-- 代码预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      :title="`代码预览 - ${currentTable?.tableName ?? ''}`"
      :width="previewWidth"
      top="6vh"
      destroy-on-close
    >
      <div class="gen-preview">
        <div class="gen-preview-files">
          <div class="gen-preview-title">文件列表（{{ previewFiles.length }}）</div>
          <div class="gen-preview-list">
            <div
              v-for="file in previewFiles"
              :key="file.path"
              class="gen-preview-item"
              :class="{ 'is-active': file.path === activeFilePath }"
              :title="file.path"
              @click="activeFilePath = file.path"
            >
              {{ file.path }}
            </div>
            <div v-if="previewFiles.length === 0" class="gen-preview-empty">未生成任何文件</div>
          </div>
        </div>
        <div class="gen-preview-code">
          <div class="gen-preview-title flex items-center justify-between">
            <span class="gen-preview-path">{{ activeFilePath || '未选择文件' }}</span>
            <el-button size="small" :disabled="!activeFilePath" @click="handleCopyCode">复制代码</el-button>
          </div>
          <pre class="gen-preview-content">{{ activeFileContent }}</pre>
        </div>
      </div>
      <template #footer>
        <el-button @click="previewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 预览弹窗：左侧文件列表 + 右侧代码。
   复杂嵌套 flex 布局 + 多处响应式断点，Tailwind 表达收益低，按规范 §3.5 保留 scoped 样式。 */
.gen-preview {
  display: flex;
  height: 60vh;
  border: 1px solid var(--el-border-color-light);
  border-radius: 4px;
}

.gen-preview-files {
  display: flex;
  flex: none;
  flex-direction: column;
  width: 280px;
  border-right: 1px solid var(--el-border-color-light);
}

.gen-preview-code {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

/* 移动端：预览弹窗改为上下布局（文件列表在上、代码在下），避免横向被挤压 */
@media (width <= 767px) {
  .gen-preview {
    flex-direction: column;
    height: 68vh;
  }

  .gen-preview-files {
    width: 100%;
    height: 40%;
    border-right: none;
    border-bottom: 1px solid var(--el-border-color-light);
  }

  .gen-preview-code {
    min-height: 0;
  }
}

.gen-preview-title {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  border-bottom: 1px solid var(--el-border-color-light);
}

.gen-preview-path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gen-preview-list {
  flex: 1;
  padding: 4px 0;
  overflow: auto;
}

.gen-preview-item {
  padding: 6px 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  white-space: nowrap;
  cursor: pointer;
}

.gen-preview-item:hover {
  background-color: var(--el-fill-color-light);
}

.gen-preview-item.is-active {
  color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.gen-preview-empty {
  padding: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.gen-preview-content {
  flex: 1;
  padding: 12px;
  margin: 0;
  overflow: auto;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  background-color: var(--el-fill-color-light);
}
</style>
