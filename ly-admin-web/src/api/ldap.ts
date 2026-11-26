/**
 * LDAP 目录认证接口：配置读取 / 保存 / 连接测试。
 * bindPassword 只写不读：后端永不明文返回，编辑时留空 = 不修改。
 */
import { get, post, put } from './request';
import type { LdapConfig, LdapTestResult } from '@/types/api';

/** 配置视图（bindPassword 只回 hasPassword） */
export function getLdapConfigApi(): Promise<LdapConfig> {
  return get<LdapConfig>('/ldap/config');
}

/** 保存配置（bindPassword 留空 = 不修改） */
export function saveLdapConfigApi(data: Partial<LdapConfig>): Promise<LdapConfig> {
  return put<LdapConfig>('/ldap/config', data);
}

/** 用已保存配置测试连接 */
export function testSavedLdapApi(): Promise<LdapTestResult> {
  return post<LdapTestResult>('/ldap/test');
}

/** 用表单参数测试连接（保存前校验，不落库） */
export function testPreviewLdapApi(data: {
  url: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  verifyCert?: boolean;
  startTls?: boolean;
}): Promise<LdapTestResult> {
  return post<LdapTestResult>('/ldap/test-preview', data);
}
