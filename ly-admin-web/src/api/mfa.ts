/**
 * 多因素认证（TOTP）接口。
 * 全部基于当前登录用户：绑定 / 解绑 / 恢复码重签，管理员不能代管他人 MFA。
 */
import { get, post, put } from './request';
import type { MfaStatus, MfaSetupResult } from '@/types/api';

/** 当前 MFA 状态 */
export function getMfaStatusApi(): Promise<MfaStatus> {
  return get<MfaStatus>('/mfa/status');
}

/** 开始绑定：返回种子与 otpauth URL（需登录口令） */
export function setupMfaApi(password: string): Promise<MfaSetupResult> {
  return post<MfaSetupResult>('/mfa/setup', { password });
}

/** 确认绑定：校验动态码后启用，返回一次性恢复码 */
export function enableMfaApi(code: string): Promise<string[]> {
  return post<string[]>('/mfa/enable', { code });
}

/** 解绑（需登录口令） */
export function disableMfaApi(password: string): Promise<null> {
  return post<null>('/mfa/disable', { password });
}

/** 重新签发恢复码（需一次动态码校验，旧码作废） */
export function regenerateMfaRecoveryApi(code: string): Promise<string[]> {
  return put<string[]>('/mfa/recovery', { code });
}
