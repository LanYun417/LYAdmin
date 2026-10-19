<script setup lang="ts">
/**
 * 通知中心页。
 * 模块职责：查看我的收件箱、标记已读 / 删除 / 清空，以及（具备权限时）发布通知。
 * 未读数与顶栏铃铛共用 notice store，任何写操作后同步，避免红点与列表不一致。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { useRouter } from 'vue-router';
import {
  clearNoticesApi,
  deleteNoticeApi,
  getNoticeListApi,
  markAllNoticesReadApi,
  markNoticeReadApi,
  publishNoticeApi,
} from '@/api/notice';
import { useNoticeStore } from '@/store/modules/notice';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { NoticeItem, NoticePublishPayload } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';
import BasicDialog from '@/components/BasicDialog/index.vue';

defineOptions({ name: 'SystemNotice' });

const router = useRouter();
const noticeStore = useNoticeStore();

/** 通知类型选项（与后端 NOTICE_TYPE 对齐） */
const TYPE_OPTIONS = [
  { label: '系统通知', value: 1 },
  { label: '公告', value: 2 },
  { label: '安全提醒', value: 3 },
];
/** 通知类型 → 标签样式与短名 */
const TYPE_TAG: Record<number, { type: 'primary' | 'success' | 'warning'; label: string }> = {
  1: { type: 'primary', label: '系统' },
  2: { type: 'success', label: '公告' },
  3: { type: 'warning', label: '安全' },
};

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getNoticeListApi({
      page: p.page,
      pageSize: p.pageSize,
      isRead: p.isRead,
      noticeType: p.noticeType,
      title: p.title.trim() || undefined,
    }),
  { title: '', isRead: undefined as number | undefined, noticeType: undefined as number | undefined },
);

/** 标记单条已读（带 link 的顺带跳转） */
async function handleRead(row: NoticeItem): Promise<void> {
  if (row.isRead === 0) {
    await markNoticeReadApi(row.id);
    noticeStore.decreaseUnread();
  }
  if (row.link) {
    await router.push(row.link);
  }
  await getList();
}

/** 全部已读 */
async function handleReadAll(): Promise<void> {
  await markAllNoticesReadApi();
  ElMessage.success('已全部标记为已读');
  noticeStore.resetUnread();
  await getList();
}

/** 删除单条 */
async function handleDelete(row: NoticeItem): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除通知「${row.title}」吗？`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  await deleteNoticeApi(row.id);
  if (row.isRead === 0) {
    noticeStore.decreaseUnread();
  }
  ElMessage.success('删除成功');
  await getList();
}

/** 清空我的通知 */
async function handleClear(): Promise<void> {
  try {
    await ElMessageBox.confirm('确定清空全部通知吗？此操作不可恢复。', '提示', { type: 'warning' });
  } catch {
    return;
  }
  const result = await clearNoticesApi();
  noticeStore.resetUnread();
  ElMessage.success(`已清空 ${result.count} 条`);
  await getList();
}

/* ------------------------------ 发布通知 ------------------------------ */

const publishVisible = ref(false);
const publishing = ref(false);
const publishForm = reactive<NoticePublishPayload>({
  title: '',
  content: '',
  noticeType: 2,
  link: '',
  userIds: undefined,
});
/** true = 发给全部启用用户；false = 只发给指定用户 */
const sendToAll = ref(true);

/** 提交发布 */
async function handlePublish(): Promise<void> {
  if (publishing.value) {
    return;
  }
  if (!publishForm.title.trim()) {
    ElMessage.error('请填写通知标题');
    return;
  }
  if (!publishForm.content.trim()) {
    ElMessage.error('请填写通知正文');
    return;
  }
  if (!sendToAll.value && !publishForm.userIds?.length) {
    ElMessage.error('请至少选择一位接收人');
    return;
  }
  publishing.value = true;
  try {
    const result = await publishNoticeApi({
      title: publishForm.title.trim(),
      content: publishForm.content.trim(),
      noticeType: publishForm.noticeType,
      link: publishForm.link?.trim() || undefined,
      userIds: sendToAll.value ? undefined : publishForm.userIds,
    });
    ElMessage.success(`已发送 ${result.count} 条`);
    publishVisible.value = false;
    publishForm.title = '';
    publishForm.content = '';
    publishForm.link = '';
    publishForm.userIds = undefined;
    sendToAll.value = true;
  } finally {
    publishing.value = false;
  }
}
</script>

<template>
  <div class="system-notice-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="标题">
        <el-input v-model="query.title" placeholder="请输入标题" clearable style="width: 180px" @keyup.enter="search" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="query.noticeType" placeholder="全部" clearable style="width: 140px">
          <el-option v-for="item in TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="query.isRead" placeholder="全部" clearable style="width: 120px">
          <el-option label="未读" :value="0" />
          <el-option label="已读" :value="1" />
        </el-select>
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex flex-wrap items-center justify-between gap-y-2 mb-3">
        <span class="text-[15px] font-semibold text-ink">我的通知（{{ total }}）</span>
        <div class="flex items-center gap-2">
          <el-button :disabled="noticeStore.unreadCount === 0" @click="handleReadAll">全部已读</el-button>
          <el-button type="danger" plain @click="handleClear">清空</el-button>
          <el-button v-permission="'system:notice:add'" type="primary" @click="publishVisible = true">
            <template #icon><i class="bi bi-megaphone" /></template>
            发布通知
          </el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isRead === 0" type="danger" size="small">未读</el-tag>
            <span v-else class="text-faint">已读</span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="TYPE_TAG[row.noticeType]?.type ?? 'primary'" size="small">
              {{ TYPE_TAG[row.noticeType]?.label ?? '通知' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleRead(row as NoticeItem)">
              {{ row.isRead === 0 ? '标记已读' : '查看' }}
            </el-button>
            <el-button type="danger" link @click="handleDelete(row as NoticeItem)">删除</el-button>
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
    </el-card>

    <BasicDialog v-model="publishVisible" title="发布通知" width="640px" :show-footer="false">
      <el-form label-width="80px">
        <el-form-item label="接收范围">
          <el-radio-group v-model="sendToAll">
            <el-radio :value="true">全部启用用户</el-radio>
            <el-radio :value="false">指定用户</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!sendToAll" label="用户 ID">
          <el-select
            v-model="publishForm.userIds"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入用户 ID 后回车，可多个"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="publishForm.noticeType" style="width: 160px">
            <el-option v-for="item in TYPE_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="publishForm.title" maxlength="200" show-word-limit placeholder="请输入标题" />
        </el-form-item>
        <el-form-item label="正文">
          <el-input
            v-model="publishForm.content"
            type="textarea"
            :rows="5"
            maxlength="2000"
            show-word-limit
            placeholder="纯文本，不支持 HTML"
          />
        </el-form-item>
        <el-form-item label="跳转链接">
          <el-input v-model="publishForm.link" placeholder="可空，如 /system/user（前端路由）" />
        </el-form-item>
      </el-form>

      <div class="flex justify-end gap-2">
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" :loading="publishing" @click="handlePublish">发送</el-button>
      </div>
    </BasicDialog>
  </div>
</template>
