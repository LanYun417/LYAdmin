<script setup lang="ts">
/**
 * LDAP 目录认证配置页。
 * 模块职责：单例配置维护 + 连接测试（保存前/后各一次）。
 *
 * 交互约定：表单参数变动后「测试当前表单」用表单值；保存后「测试已存配置」用后端值。
 * 口令只写不读：输入框始终为空，留空提交 = 不修改原口令。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { getLdapConfigApi, saveLdapConfigApi, testPreviewLdapApi, testSavedLdapApi } from '@/api/ldap';
import type { LdapConfig, LdapTestResult } from '@/types/api';

defineOptions({ name: 'SystemLdap' });

const formRef = ref<FormInstance>();
const loading = ref(false);
const saving = ref(false);
const testing = ref(false);
/** 测试结果展示（null = 未测试） */
const testResult = ref<LdapTestResult | null>(null);

/** 表单模型：bindPassword 只在本次提交时使用，不参与回显 */
interface LdapFormModel {
  enabled: boolean;
  url: string;
  startTls: boolean;
  verifyCert: boolean;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  userFilter: string;
  usernameAttr: string;
  emailAttr: string;
  nicknameAttr: string;
  defaultRoleCodes: string;
}

const emptyForm = (): LdapFormModel => ({
  enabled: false,
  url: '',
  startTls: false,
  verifyCert: true,
  bindDn: '',
  bindPassword: '',
  baseDn: '',
  userFilter: '(uid={{username}})',
  usernameAttr: 'uid',
  emailAttr: '',
  nicknameAttr: '',
  defaultRoleCodes: '',
});

const form = ref<LdapFormModel>(emptyForm());

/** 是否已设置口令（后端视图，用于提示「留空则不修改」） */
const hasPassword = ref(false);

const rules: FormRules = {
  url: [
    { required: true, message: '请输入服务器地址', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!/^ldaps?:\/\//.test(value ?? '')) {
          callback(new Error('必须以 ldap:// 或 ldaps:// 开头'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  bindDn: [{ required: true, message: '请输入服务账号 DN', trigger: 'blur' }],
  baseDn: [{ required: true, message: '请输入用户搜索基准 DN', trigger: 'blur' }],
  userFilter: [
    { required: true, message: '请输入用户搜索过滤器', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!(value ?? '').includes('{{username}}')) {
          callback(new Error('必须包含 {{username}} 占位符'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

/** 加载配置 */
async function loadConfig(): Promise<void> {
  loading.value = true;
  try {
    const config: LdapConfig = await getLdapConfigApi();
    hasPassword.value = config.hasPassword;
    Object.assign(form.value, {
      enabled: config.enabled,
      url: config.url,
      startTls: config.startTls,
      verifyCert: config.verifyCert,
      bindDn: config.bindDn,
      // 口令不回显：始终留空
      bindPassword: '',
      baseDn: config.baseDn,
      userFilter: config.userFilter,
      usernameAttr: config.usernameAttr,
      emailAttr: config.emailAttr ?? '',
      nicknameAttr: config.nicknameAttr ?? '',
      defaultRoleCodes: config.defaultRoleCodes ?? '',
    });
  } finally {
    loading.value = false;
  }
}

onMounted(loadConfig);

/** 保存 */
async function handleSave(): Promise<void> {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  saving.value = true;
  try {
    await saveLdapConfigApi({
      enabled: form.value.enabled,
      url: form.value.url.trim(),
      startTls: form.value.startTls,
      verifyCert: form.value.verifyCert,
      bindDn: form.value.bindDn.trim(),
      // 留空 = 不修改原口令（后端据此保留）
      bindPassword: form.value.bindPassword.trim() || undefined,
      baseDn: form.value.baseDn.trim(),
      userFilter: form.value.userFilter.trim(),
      usernameAttr: form.value.usernameAttr.trim(),
      emailAttr: form.value.emailAttr.trim() || undefined,
      nicknameAttr: form.value.nicknameAttr.trim() || undefined,
      defaultRoleCodes: form.value.defaultRoleCodes.trim() || undefined,
    });
    ElMessage.success('保存成功');
    form.value.bindPassword = '';
    hasPassword.value = hasPassword.value || Boolean(form.value.bindPassword);
    await loadConfig();
  } finally {
    saving.value = false;
  }
}

/** 测试当前表单（不落库） */
async function handleTestPreview(): Promise<void> {
  if (!form.value.url.trim() || !form.value.bindDn.trim() || !form.value.baseDn.trim()) {
    ElMessage.warning('请先填写服务器地址 / 服务账号 DN / 用户搜索基准 DN');
    return;
  }
  if (!form.value.bindPassword.trim() && !hasPassword.value) {
    ElMessage.warning('请输入服务账号口令');
    return;
  }
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await testPreviewLdapApi({
      url: form.value.url.trim(),
      bindDn: form.value.bindDn.trim(),
      bindPassword: form.value.bindPassword.trim(),
      baseDn: form.value.baseDn.trim(),
      verifyCert: form.value.verifyCert,
      startTls: form.value.startTls,
    });
  } catch {
    // 拦截器统一处理（网络层失败）；连接类错误由 testResult 展示
  } finally {
    testing.value = false;
  }
}

/** 测试已保存配置 */
async function handleTestSaved(): Promise<void> {
  testing.value = true;
  testResult.value = null;
  try {
    testResult.value = await testSavedLdapApi();
  } catch {
    // 拦截器统一处理
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <div class="ldap-page">
    <el-card v-loading="loading" shadow="never">
      <template #header><span>LDAP 目录认证</span></template>

      <el-alert
        type="info"
        :closable="false"
        class="mb-4"
        title="启用后，本地口令校验失败的登录会回退到 LDAP 目录认证；认证成功且本地不存在账号时，按「默认角色编码」自动建号（该账号只能走 LDAP 登录）。"
      />

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="140px"
        class="ldap-form"
        style="max-width: 640px"
      >
        <el-form-item label="启用 LDAP">
          <el-switch v-model="form.enabled" />
        </el-form-item>
        <el-form-item label="服务器地址" prop="url">
          <el-input v-model="form.url" placeholder="ldap://ldap.example.com 或 ldaps://" maxlength="255" />
        </el-form-item>
        <el-form-item label="StartTLS">
          <el-switch v-model="form.startTls" />
          <span class="ml-2 text-xs text-muted">ldap:// 连接时升级为加密（需要服务器支持）</span>
        </el-form-item>
        <el-form-item label="校验服务器证书">
          <el-switch v-model="form.verifyCert" />
          <span class="ml-2 text-xs text-muted">内网自签证书可关闭，生产环境不建议</span>
        </el-form-item>
        <el-form-item label="服务账号 DN" prop="bindDn">
          <el-input v-model="form.bindDn" placeholder="cn=admin,dc=example,dc=com" maxlength="255" />
        </el-form-item>
        <el-form-item label="服务账号口令">
          <el-input
            v-model="form.bindPassword"
            type="password"
            show-password
            maxlength="255"
            :placeholder="hasPassword ? '已设置，留空 = 不修改' : '请输入服务账号口令'"
          />
        </el-form-item>
        <el-form-item label="用户搜索基准 DN" prop="baseDn">
          <el-input v-model="form.baseDn" placeholder="ou=users,dc=example,dc=com" maxlength="255" />
        </el-form-item>
        <el-form-item label="用户搜索过滤器" prop="userFilter">
          <el-input v-model="form.userFilter" placeholder="(uid={{username}})" maxlength="255" />
          <span class="ml-2 text-xs text-muted">AD 常用 (sAMAccountName=&#123;&#123;username&#125;&#125;)</span>
        </el-form-item>
        <el-form-item label="用户名属性">
          <el-input v-model="form.usernameAttr" placeholder="uid" maxlength="64" />
        </el-form-item>
        <el-form-item label="邮箱属性">
          <el-input v-model="form.emailAttr" placeholder="mail（可留空）" maxlength="64" />
        </el-form-item>
        <el-form-item label="昵称属性">
          <el-input v-model="form.nicknameAttr" placeholder="displayName（可留空）" maxlength="64" />
        </el-form-item>
        <el-form-item label="默认角色编码">
          <el-input
            v-model="form.defaultRoleCodes"
            placeholder="viewer（首次登录自动建号时授予，逗号分隔）"
            maxlength="255"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          <el-button :loading="testing" @click="handleTestPreview">测试当前表单</el-button>
          <el-button :disabled="!hasPassword" :loading="testing" @click="handleTestSaved">测试已存配置</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="testResult"
        :type="testResult.ok ? 'success' : 'error'"
        :closable="false"
        class="mt-4"
        :title="testResult.ok ? '连接成功' : '连接失败'"
        :description="testResult.message"
      />
    </el-card>
  </div>
</template>
