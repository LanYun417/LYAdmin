<script setup lang="ts">
/**
 * 顶栏通知铃铛（未读红点 + 最近通知下拉 + 详情弹窗）。
 *
 * 取最近 5 条：铃铛是"提醒入口"而不是完整列表，下拉里只做摘要（正文截两行），
 * **点击任意一条打开详情弹窗**看全文——通知正文可能很长，下拉里塞不下；
 * 有 link 的在弹窗里提供「前往查看」。更多请进通知中心。
 */
import { ElMessage } from '@/utils/element';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { getNoticeListApi, markAllNoticesReadApi, markNoticeReadApi } from '@/api/notice';
import { useNoticeStore } from '@/store/modules/notice';
import { formatDateTime } from '@/utils/format';
import type { NoticeItem } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';

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

/** 下拉展开时拉取（点击即触发，避免重复请求） */
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

/**
 * 挂载即拉一次未读数。
 * 红点是"常驻提醒"，不能等用户点开下拉才出现——否则进页面时看起来没有未读，
 * 点一下才突然冒出数字。失败静默：通知查询不该打断用户当前操作。
 */
onMounted(async () => {
  if (noticeStore.loaded) {
    return;
  }
  try {
    await noticeStore.refreshUnread();
  } catch {
    // 静默失败：保持红点隐藏，下次打开下拉时还会再试
  }
});

/** 下拉是否展开（打开详情前先收起，避免浮层叠在一起） */
const popoverVisible = ref(false);
/** 详情弹窗 */
const detailVisible = ref(false);
/** 当前查看的通知 */
const detailItem = ref<NoticeItem | null>(null);

/**
 * 点击一条：打开详情弹窗并标记已读。
 * 不在下拉里直接跳转——正文被截断的情况下用户看不到内容，先看全文再决定是否前往。
 */
async function handleClick(item: NoticeItem): Promise<void> {
  popoverVisible.value = false;
  detailItem.value = item;
  detailVisible.value = true;
  if (item.isRead === 0) {
    try {
      await markNoticeReadApi(item.id);
      item.isRead = 1;
      noticeStore.decreaseUnread();
    } catch {
      // 标记失败不影响阅读详情，下次打开下拉还会再试
    }
  }
}

/** 详情弹窗里「前往查看」 */
async function handleOpenLink(): Promise<void> {
  const link = detailItem.value?.link;
  if (!link) {
    return;
  }
  detailVisible.value = false;
  await router.push(link);
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
  <!-- 纯图标交互必须有文字提示：hover 显示「通知」，点击仍打开面板
       （tooltip 在外层、popover 在内层，两者触发方式不同，互不干扰）。 -->
  <el-tooltip :content="t('nav.notice')" placement="bottom">
    <span class="inline-flex items-center">
      <el-popover
        v-model:visible="popoverVisible"
        placement="bottom-end"
        :width="360"
        trigger="click"
        @show="handleOpen"
      >
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
          <p v-if="!loading && recent.length === 0" class="py-6 text-center text-sm text-faint">
            {{ t('notice.empty') }}
          </p>
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
    </span>
  </el-tooltip>

  <!--
    详情弹窗：通知正文可能很长，下拉里只截两行，全文在这里看。
    滚动统一交给 el-scrollbar（项目约定，避免原生滚动条）。
  -->
  <BasicDialog v-model="detailVisible" title="通知详情" width="560px" :show-footer="false" append-to-body>
    <div v-if="detailItem" class="flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
        <el-tag :type="TYPE_META[detailItem.noticeType]?.type ?? 'primary'" size="small">
          {{ TYPE_META[detailItem.noticeType]?.label ?? '通知' }}
        </el-tag>
        <span>{{ formatDateTime(detailItem.createdAt) }}</span>
      </div>

      <h3 class="text-base font-semibold text-ink">{{ detailItem.title }}</h3>

      <el-scrollbar class="max-h-[52vh]">
        <p class="pr-3 text-sm leading-6 text-ink-regular whitespace-pre-wrap break-words">
          {{ detailItem.content }}
        </p>
      </el-scrollbar>

      <div class="flex justify-end gap-2">
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button v-if="detailItem.link" type="primary" @click="handleOpenLink">前往查看</el-button>
      </div>
    </div>
  </BasicDialog>
</template>
