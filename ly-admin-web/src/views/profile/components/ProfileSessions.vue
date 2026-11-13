<script setup lang="ts">
/**
 * 用户画像：我的在线会话（当前设备 / 其他设备）。
 *
 * 数据来源：GET /profile 返回的 sessions（Redis 会话记录，不落库）。
 * 与「在线用户」页的区别：这里只有自己的会话，且提供「下线其他设备」的自助能力；
 * 管理员的全量视角仍在监控 → 在线用户。
 */
import { ElMessage, ElMessageBox } from '@/utils/element';
import { removeOwnSessionApi } from '@/api/profile';
import { formatDateTime, formatOnlineDuration } from '@/utils/format';
import type { SessionProfileItem } from '@/types/api';

defineProps<{
  /** 会话列表（父组件传入，便于与其他资料一起刷新） */
  sessions: SessionProfileItem[];
  /** 是否只读访客（不允许自助下线） */
  readonly?: boolean;
}>();

const emit = defineEmits<{
  (e: 'changed'): void;
}>();

/** 下线自己的某个会话。 */
async function handleRemove(row: SessionProfileItem): Promise<void> {
  const tip = row.current
    ? '这是当前设备：下线后当前页面会在下次请求时被登出，确定继续吗？'
    : `确定下线「${row.browser || '未知浏览器'} · ${row.ip}」这次登录吗？该设备下次请求即失效。`;
  try {
    await ElMessageBox.confirm(tip, '下线设备', {
      type: 'warning',
      confirmButtonText: '确定下线',
      cancelButtonText: '取消',
    });
  } catch {
    return;
  }
  await removeOwnSessionApi(row.sid);
  ElMessage.success('已下线');
  emit('changed');
}
</script>

<template>
  <div class="profile-sessions">
    <el-empty v-if="sessions.length === 0" description="暂无在线会话（Redis 不可用时画像不可用）" :image-size="72" />
    <div v-else class="flex flex-col gap-2">
      <div
        v-for="row in sessions"
        :key="row.sid"
        class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-solid border-line px-3 py-2"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium text-ink">
              {{ row.browser || '未知浏览器' }} · {{ row.os || '未知系统' }}
            </span>
            <el-tag v-if="row.current" type="success" size="small" effect="plain">本机</el-tag>
          </div>
          <span class="text-xs text-muted">
            {{ row.ip || '-' }}
            <template v-if="row.location">（{{ row.location }}）</template>
            · 登录 {{ formatDateTime(row.loginAt) }} · 在线 {{ formatOnlineDuration(row.loginAt) }} · 最后活跃
            {{ formatDateTime(row.lastSeenAt) }}
          </span>
        </div>
        <el-button v-if="!readonly" type="danger" link size="small" @click="handleRemove(row)">
          {{ row.current ? '下线本机' : '下线' }}
        </el-button>
      </div>
    </div>
  </div>
</template>
