<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { uploadAvatarApi } from '@/api/profile';
import { useUserStore } from '@/store/modules/user';
import ProfileForm from './components/ProfileForm.vue';
import PasswordForm from './components/PasswordForm.vue';

defineOptions({ name: 'Profile' });

const userStore = useUserStore();
const uploading = ref(false);

const avatar = computed(() => userStore.avatar);
const nickname = computed(() => userStore.nickname);
const username = computed(() => userStore.userInfo?.username ?? '');
const roles = computed(() => userStore.roles.join('、') || '-');

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
          <div class="profile-avatar flex flex-col items-center">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              accept="image/*"
              :before-upload="beforeAvatarUpload"
              :http-request="handleAvatarUpload"
            >
              <el-avatar v-loading="uploading" :size="100" :src="avatar">
                <el-icon><Plus /></el-icon>
              </el-avatar>
              <div class="avatar-tip">点击更换头像</div>
            </el-upload>
            <p class="profile-nickname">{{ nickname }}</p>
            <p class="profile-username">@{{ username }}</p>
          </div>
          <el-descriptions :column="1" border class="mt-4">
            <el-descriptions-item label="账号">{{ username }}</el-descriptions-item>
            <el-descriptions-item label="昵称">{{ nickname }}</el-descriptions-item>
            <el-descriptions-item label="角色">{{ roles }}</el-descriptions-item>
            <el-descriptions-item label="邮箱">
              {{ userStore.userInfo?.email || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="手机号">
              {{ userStore.userInfo?.phone || '-' }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="16">
        <el-card shadow="never">
          <template #header>修改资料</template>
          <ProfileForm />
        </el-card>
        <el-card shadow="never" class="mt-4">
          <template #header>修改密码</template>
          <PasswordForm />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.profile-avatar {
  padding: 8px 0;
}

.avatar-uploader {
  text-align: center;
  cursor: pointer;
}

.avatar-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.profile-nickname {
  margin-top: 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.profile-username {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
