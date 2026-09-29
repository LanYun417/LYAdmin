/**
 * 个人中心接口：修改资料、修改密码与更换头像。
 */
import { put, request } from './request';
import type { ChangePasswordParams, ProfileUpdateParams, UserBrief } from '@/types/api';

/** 修改个人资料 */
export function updateProfileApi(data: ProfileUpdateParams): Promise<UserBrief> {
  return put<UserBrief>('/profile', data);
}

/** 修改密码 */
export function changePasswordApi(data: ChangePasswordParams): Promise<null> {
  return put<null>('/profile/password', data);
}

/** 更换头像 */
export function uploadAvatarApi(file: File): Promise<{ avatar: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return request<{ avatar: string }>({
    url: '/profile/avatar',
    method: 'POST',
    data: formData,
  });
}
