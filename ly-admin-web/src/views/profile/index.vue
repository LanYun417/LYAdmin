<script setup lang="ts">
/**
 * 个人中心页。
 * 模块职责：展示当前用户信息与头像上传，并编排「修改资料 / 修改密码」两个子表单。
 */

import { ElMessage } from '@/utils/element';
import type { UploadRequestOptions } from 'element-plus';
import { getProfileDetailApi, uploadAvatarApi } from '@/api/profile';
import { useDict } from '@/composables/useDict';
import { useUserStore } from '@/store/modules/user';
import ProfileForm from './components/ProfileForm.vue';
import PasswordForm from './components/PasswordForm.vue';
import ProfileExtraForm from './components/ProfileExtraForm.vue';
import ProfileSessions from './components/ProfileSessions.vue';
import { withUploadToken } from '@/utils/uploadToken';
import type { ProfileDetail } from '@/types/api';

defineOptions({ name: 'Profile' });

const userStore = useUserStore();
const uploading = ref(false);
const loadingDetail = ref(false);

/** 详情（扩展资料 + 会话画像）。账户信息仍走 userStore（登录时已拉全）。 */
const detail = ref<ProfileDetail | null>(null);

const avatar = computed(() => userStore.avatar);
const nickname = computed(() => userStore.nickname);
const username = computed(() => userStore.userInfo?.username ?? '');
const roles = computed(() => userStore.roles.join('、') || '-');

/** 性别字典（字典管理 → 用户性别 sys_user_sex），把存储值渲染成标签 */
const { labelOf: genderLabel } = useDict('sys_user_sex');

/** 拉取详情（首次进入 + 保存扩展资料/下线设备后刷新）。 */
async function loadDetail(): Promise<void> {
  loadingDetail.value = true;
  try {
    detail.value = await getProfileDetailApi();
  } finally {
    loadingDetail.value = false;
  }
}

onMounted(loadDetail);

/** 头像上传前校验 */
function beforeAvatarUpload(file: File): boolean {
  const isImage = file.type.startsWith('image/');
  if (!isImage) {
    ElMessage.error('头像必须是图片格式');
    return false;
  }
  if (file.size > 2 * 1024 * 1024) {
    ElMessage.error('头像大小不能超过 2MB');
    return false;
  }
  return true;
}

/** 自定义头像上传 */
async function handleAvatarUpload(options: UploadRequestOptions): Promise<void> {
  uploading.value = true;
  try {
    const res = await uploadAvatarApi(options.file as unknown as File);
    if (userStore.userInfo) {
      userStore.userInfo.avatar = res.avatar;
    }
    ElMessage.success('头像更新成功');
    options.onSuccess?.(res);
  } catch (error) {
    options.onError?.(error as Parameters<NonNullable<UploadRequestOptions['onError']>>[0]);
  } finally {
    uploading.value = false;
  }
}
</script>

<template>
  <div class="profile-page">
    <el-row :gutter="16">
      <el-col :xs="24" :md="8">
        <el-card shadow="never">
          <template #header>个人信息</template>
          <div class="py-2 flex flex-col items-center">
            <el-upload
              v-if="!userStore.isReadonlyGuest"
              class="cursor-pointer"
              :show-file-list="false"
              accept="image/*"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
            >
              <el-avatar v-loading="uploading" :size="100" :src="withUploadToken(avatar)">
                <el-icon aria-hidden="true"><i class="bi bi-plus" /></el-icon>
              </el-avatar>
            </el-upload>
            <el-avatar v-else :size="100" :src="withUploadToken(avatar)" />
            <div class="mt-2 text-xs text-muted">
              {{ userStore.isReadonlyGuest ? '只读访客不支持更换头像' : '点击更换头像' }}
            </div>
            <p class="mt-3 text-base font-semibold text-ink">{{ nickname }}</p>
            <p class="text-[13px] text-muted">@{{ username }}</p>
          </div>
          <el-descriptions :column="1" border class="mt-4">
            <el-descriptions-item label="账号">{{ username }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ nickname }}</el-descriptions-item>
            <el-descriptions-item label="角色">{{ roles }}</el-descriptions-item>
            <!-- 部门由管理员在「用户管理」中分配，此处只读展示；未分配时显示 - -->
            <el-descriptions-item label="所属部门 / 岗位">
              {{ userStore.userInfo?.deptName || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="邮箱">
              {{ userStore.userInfo?.email || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="手机号">
              {{ userStore.userInfo?.phone || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="性别">
              {{ genderLabel(userStore.userInfo?.gender) || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="16">
        <el-card shadow="never">
          <template #header>修改资料</template>
          <!-- 只读访客不允许修改个人资料：后端会直接拒绝（409），这里提前收口，避免填完表单才报错 -->
          <p v-if="userStore.isReadonlyGuest" class="text-[13px] text-muted">
            只读访客账号不支持修改个人资料，如需变更请联系超级管理员。
          </p>
          <ProfileForm v-else />
        </el-card>
        <el-card shadow="never" class="mt-4">
          <template #header>修改密码</template>
          <!-- 只读访客不允许自助改密：后端会直接拒绝（409），这里提前收口，避免填完表单才报错 -->
          <p v-if="userStore.isReadonlyGuest" class="text-[13px] text-muted">
            只读访客账号不支持自助修改密码，如需变更请联系超级管理员在「用户管理 → 重置密码」中处理。
          </p>
          <PasswordForm v-else />
        </el-card>

        <!-- Sprint 5：扩展资料（资料域，独立于账户字段） -->
        <el-card v-loading="loadingDetail" shadow="never" class="mt-4">
          <template #header>扩展资料</template>
          <p v-if="userStore.isReadonlyGuest" class="text-[13px] text-muted">
            只读访客账号不支持修改个人资料，如需变更请联系超级管理员。
          </p>
          <ProfileExtraForm v-else :detail="detail" @saved="loadDetail" />
        </el-card>

        <!-- Sprint 5：用户画像（我的在线会话） -->
        <el-card v-loading="loadingDetail" shadow="never" class="mt-4">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span>我的设备</span>
              <span class="text-xs text-muted">共 {{ detail?.sessions.length ?? 0 }} 个在线会话</span>
            </div>
          </template>
          <ProfileSessions
            :sessions="detail?.sessions ?? []"
            :readonly="userStore.isReadonlyGuest"
            @changed="loadDetail"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
