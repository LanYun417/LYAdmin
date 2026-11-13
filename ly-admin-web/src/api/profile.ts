/**
 * 个人中心接口：修改资料、修改密码、更换头像，以及 Sprint 5 的
 * 个人中心详情（含扩展资料与在线会话画像）与扩展资料更新。
 */
import { del, get, put, request } from './request';
import type {
  ChangePasswordParams,
  ProfileDetail,
  ProfileExtraParams,
  ProfileUpdateParams,
  UserBrief,
} from '@/types/api';

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

/** 个人中心详情（账户 + 扩展资料 + 在线会话画像） */
export function getProfileDetailApi(): Promise<ProfileDetail> {
  return get<ProfileDetail>('/profile');
}

/** 更新扩展资料（简介 / 生日 / 公司 / 职位 / 所在地） */
export function updateProfileExtraApi(data: ProfileExtraParams): Promise<ProfileDetail> {
  return put<ProfileDetail>('/profile/extra', data);
}

/** 下线我的某个会话（按 sid） */
export function removeOwnSessionApi(sid: string): Promise<null> {
  return del<null>(`/profile/sessions/${sid}`);
}
