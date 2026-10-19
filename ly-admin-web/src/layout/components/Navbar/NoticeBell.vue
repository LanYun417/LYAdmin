<script setup lang="ts">
/**
 * 顶栏通知铃铛（未读红点 + 最近通知下拉）。
 *
 * 取最近 5 条：铃铛是"提醒入口"而不是完整列表，正文要能在下拉里读完，
 * 更多请进通知中心。点击某条即标记已读，有 link 的顺带跳转。
 */
import { ElMessage } from '@/utils/element';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getNoticeListApi, markAllNoticesReadApi, markNoticeReadApi } from '@/api/notice';
import { useNoticeStore } from '@/store/modules/notice';
import { formatDateTime } from '@/utils/format';
import type { NoticeItem } from '@/types/api';

const router = useRouter();
const noticeStore = useNoticeStore();
const { t } = useI18n();

/** 最近通知（下拉里展示） */
const recent = ref<NoticeItem[]>([]);
const loading = ref(false);

/** 通知类型 → 标签文案与配色 */
const TYPE_META: Record<number, { label: string; type: 'primary' | 'success' | 'warning' }> = {
  1: { label: '系统', type: 'primary' },
  2: { label: '公告', type: 'success' },
  3: { label: '安全', type: 'warning' },
};

/** 下拉展开时拉取（点击即触发，避免挂载就请求） */
async function handleOpen(): Promise<void> {
  loading.value = true;
  try {
    const result = await getNoticeListApi({ page: 1, pageSize: 5 });
    recent.value = result.list;
    await noticeStore.refreshUnread();
  } finally {
    loading.value = false;
  }
}

/** 点击一条：标记已读 + 按需跳转 */
async function handleClick(item: NoticeItem): Promise<void> {
  if (item.isRead === 0) {
    await markNoticeReadApi(item.id);
    item.isRead = 1;
    noticeStore.decreaseUnread();
  }
  if (item.link) {
    await router.push(item.link);
  }
}

/** 全部已读 */
async function handleReadAll(): Promise<void> {
  await markAllNoticesReadApi();
  ElMessage.success('已全部标记为已读');
  recent.value = recent.value.map((item) => ({ ...item, isRead: 1 }));
  noticeStore.resetUnread();
}

/** 进入通知中心 */
function handleViewAll(): void {
  void router.push('/system/notice');
}
</script>

<template>
  <el-popover placement="bottom-end" :width="360" trigger="click" @show="handleOpen">
    <template #reference>
      <el-badge :value="noticeStore.unreadCount" :hidden="noticeStore.unreadCount === 0" :max="99">
        <el-icon class="text-lg text-ink cursor-pointer" role="button" tabindex="0" :aria-label="t('nav.notice')">
          <i class="bi bi-bell" />
        </el-icon>
      </el-badge>
    </template>

    <div class="flex items-center justify-between mb-2">
      <span class="text-sm font-semibold text-ink">{{ t('notice.title') }}</span>
      <div class="flex items-center gap-2">
        <el-button v-if="noticeStore.unreadCount > 0" type="primary" link size="small" @click="handleReadAll">
          {{ t('common.readAll') }}
        </el-button>
        <el-button type="primary" link size="small" @click="handleViewAll">查看全部</el-button>
      </div>
    </div>

    <div v-loading="loading" class="max-h-96 overflow-y-auto">
      <p v-if="!loading && recent.length === 0" class="py-6 text-center text-sm text-faint">{{ t('notice.empty') }}</p>
      <div
        v-for="item in recent"
        :key="item.id"
        class="px-2 py-2 rounded cursor-pointer hover:bg-fill-light"
        @click="handleClick(item)"
      >
        <div class="flex items-center gap-2">
          <span v-if="item.isRead === 0" class="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span v-else class="w-1.5 shrink-0" />
          <span class="text-sm font-medium truncate" :class="item.isRead === 0 ? 'text-ink' : 'text-muted'">
            {{ item.title }}
          </span>
          <el-tag :type="TYPE_META[item.noticeType]?.type ?? 'primary'" size="small" class="!mr-0">
            {{ TYPE_META[item.noticeType]?.label ?? '通知' }}
          </el-tag>
        </div>
        <p class="mt-1 text-xs text-muted line-clamp-2 pl-3.5">{{ item.content }}</p>
        <p class="mt-1 text-xs text-faint pl-3.5">{{ formatDateTime(item.createdAt) }}</p>
      </div>
    </div>
  </el-popover>
</template>
