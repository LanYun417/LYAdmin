<script setup lang="ts">
/**
 * 在线用户页。
 * 模块职责：查看当前在线会话（账号 / IP / 归属地 / 浏览器 / 登录与活跃时间），并强制下线。
 *
 * 说明：会话是 Redis 中的实时数据，不做定时轮询（避免凭空产生请求）；
 * 页面提供「刷新」按钮，列表在强退后自动重取。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { forceLogoutSessionApi, forceLogoutUserApi, getOnlineSessionsApi } from '@/api/monitor';
import { useTable } from '@/composables/useTable';
import { formatDateTime } from '@/utils/format';
import type { OnlineSession } from '@/types/api';
import Pagination from '@/components/Pagination/index.vue';
import SearchForm from '@/components/SearchForm/index.vue';

defineOptions({ name: 'MonitorOnline' });

const { loading, list, total, query, search, reset, getList, changePage, changePageSize } = useTable(
  (p) =>
    getOnlineSessionsApi({
      page: p.page,
      pageSize: p.pageSize,
      username: p.username.trim() || undefined,
      ip: p.ip.trim() || undefined,
    }),
  { username: '', ip: '' },
);

/** 强制下线单个会话 */
async function handleForceLogout(row: OnlineSession): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定强制下线「${row.username}」在 ${row.ip || '未知 IP'} 的这次登录吗？该会话的令牌将立即失效。`,
      '强制下线',
      { type: 'warning', confirmButtonText: '确定下线', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await forceLogoutSessionApi(row.sid);
  ElMessage.success('已强制下线');
  await getList();
}

/** 强制下线某账号的全部会话 */
async function handleForceLogoutAll(row: OnlineSession): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定下线「${row.username}」的全部登录会话吗？该账号在所有设备上都将需要重新登录。`,
      '强制下线全部会话',
      { type: 'warning', confirmButtonText: '全部下线', cancelButtonText: '取消' },
    );
  } catch {
    return;
  }
  await forceLogoutUserApi(row.userId);
  ElMessage.success('已下线该账号的全部会话');
  await getList();
}
</script>

<template>
  <div class="monitor-online-page">
    <SearchForm @search="search" @reset="reset">
      <el-form-item label="账号">
        <el-input
          v-model="query.username"
          placeholder="请输入账号"
          clearable
          style="width: 160px"
          @keyup.enter="search"
        />
      </el-form-item>
      <el-form-item label="登录 IP">
        <el-input v-model="query.ip" placeholder="精确匹配" clearable style="width: 160px" @keyup.enter="search" />
      </el-form-item>
    </SearchForm>

    <el-card shadow="never" class="mt-4">
      <div class="flex items-center justify-between mb-3">
        <span class="text-[15px] font-semibold text-ink">在线会话（{{ total }}）</span>
        <el-button :loading="loading" @click="getList">
          <template #icon><i class="bi bi-arrow-clockwise" /></template>
          刷新
        </el-button>
      </div>

      <el-table v-loading="loading" :data="list">
        <el-table-column prop="username" label="账号" min-width="120" />
        <el-table-column prop="nickname" label="昵称" min-width="120" />
        <el-table-column prop="ip" label="登录 IP" width="140" />
        <el-table-column prop="location" label="归属地" width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.location || '-' }}</template>
        </el-table-column>
        <el-table-column label="客户端" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ [row.browser, row.os].filter(Boolean).join(' / ') || '-' }}</template>
        </el-table-column>
        <el-table-column label="登录时间" width="180">
          <template #default="{ row }">{{ formatDateTime(row.loginAt) }}</template>
        </el-table-column>
        <el-table-column label="最后活跃" width="180">
          <template #default="{ row }">{{ formatDateTime(row.lastSeenAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-permission="'monitor:online:forceLogout'"
              type="danger"
              link
              @click="handleForceLogout(row as OnlineSession)"
            >
              强制下线
            </el-button>
            <el-button
              v-permission="'monitor:online:forceLogout'"
              type="warning"
              link
              @click="handleForceLogoutAll(row as OnlineSession)"
            >
              全部下线
            </el-button>
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
  </div>
</template>
