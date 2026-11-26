<script setup lang="ts">
/**
 * SSO 提供方表单（新增 / 编辑）。
 * 模块职责：OIDC 提供方字段维护；clientSecret 只写不读（编辑时留空 = 不修改）。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { createSsoProviderApi, getSsoProviderApi, updateSsoProviderApi } from '@/api/sso';
import type { SsoProvider, SsoProviderParams } from '@/types/api';

defineOptions({ name: 'SsoForm' });

const props = defineProps<{
  /** 编辑的提供方 id；undefined = 新增 */
  editId?: number;
}>();

const emit = defineEmits<{
  (e: 'success'): void;
}>();

const visible = defineModel<boolean>({ required: true });

const formRef = ref<FormInstance>();
const submitting = ref(false);
/** 回显详情加载中 */
const loadingDetail = ref(false);

const emptyForm = (): SsoProviderParams => ({
  name: '',
  issuer: '',
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  jwksUrl: '',
  clientId: '',
  clientSecret: '',
  scopes: 'openid profile email',
  redirectUri: '',
  fieldMapping: '',
  linkByEmail: true,
  defaultRoleCodes: '',
  status: 1,
  sort: 0,
  remark: '',
});

const form = ref<SsoProviderParams>(emptyForm());

const rules: FormRules = {
  name: [{ required: true, message: '请输入提供方名称', trigger: 'blur' }],
  issuer: [{ required: true, message: '请输入 issuer', trigger: 'blur' }],
  authorizationUrl: [{ required: true, message: '请输入授权端点', trigger: 'blur' }],
  tokenUrl: [{ required: true, message: '请输入令牌端点', trigger: 'blur' }],
  userInfoUrl: [{ required: true, message: '请输入用户信息端点', trigger: 'blur' }],
  clientId: [{ required: true, message: '请输入 clientId', trigger: 'blur' }],
  redirectUri: [{ required: true, message: '请输入回调地址', trigger: 'blur' }],
};

/** 打开时重置 / 回显详情 */
watch(visible, async (open) => {
  if (!open) {
    return;
  }
  Object.assign(form.value, emptyForm());
  if (props.editId !== undefined) {
    loadingDetail.value = true;
    try {
      const detail: SsoProvider = await getSsoProviderApi(props.editId);
      Object.assign(form.value, {
        ...form.value,
        ...detail,
        jwksUrl: detail.jwksUrl ?? '',
        remark: detail.remark ?? '',
        // clientSecret 后端永不下发：编辑时留空即不修改
        clientSecret: '',
      });
    } finally {
      loadingDetail.value = false;
    }
  }
});

/** 提交 */
async function handleSubmit(): Promise<void> {
  if (!formRef.value) {
    return;
  }
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) {
    return;
  }
  submitting.value = true;
  try {
    const payload: SsoProviderParams = {
      ...form.value,
      // 空串不发给后端：留空表示不修改密钥 / 不覆盖原值
      jwksUrl: form.value.jwksUrl?.trim() || undefined,
      clientSecret: form.value.clientSecret?.trim() || undefined,
      remark: form.value.remark?.trim() || undefined,
    };
    if (props.editId !== undefined) {
      await updateSsoProviderApi(props.editId, payload);
    } else {
      await createSsoProviderApi(payload);
    }
    ElMessage.success(props.editId !== undefined ? '保存成功' : '新增成功');
    emit('success');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog
    v-model="visible"
    :title="editId === undefined ? '新增单点登录提供方' : '编辑单点登录提供方'"
    width="640px"
  >
    <el-form ref="formRef" v-loading="loadingDetail" :model="form" :rules="rules" label-width="120px" class="sso-form">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="登录页按钮文案，如「企业 OIDC」" maxlength="50" />
      </el-form-item>
      <el-form-item label="Issuer" prop="issuer">
        <el-input v-model="form.issuer" placeholder="https://sso.example.com" maxlength="255" />
      </el-form-item>
      <el-form-item label="授权端点" prop="authorizationUrl">
        <el-input v-model="form.authorizationUrl" placeholder="https://sso.example.com/authorize" maxlength="500" />
      </el-form-item>
      <el-form-item label="令牌端点" prop="tokenUrl">
        <el-input v-model="form.tokenUrl" placeholder="https://sso.example.com/token" maxlength="500" />
      </el-form-item>
      <el-form-item label="用户信息端点" prop="userInfoUrl">
        <el-input v-model="form.userInfoUrl" placeholder="https://sso.example.com/userinfo" maxlength="500" />
      </el-form-item>
      <el-form-item label="JWKS 端点" prop="jwksUrl">
        <el-input v-model="form.jwksUrl" placeholder="留空 = 不验签（仅内网自建提供方建议填写）" maxlength="500" />
      </el-form-item>
      <el-form-item label="Client ID" prop="clientId">
        <el-input v-model="form.clientId" maxlength="255" />
      </el-form-item>
      <el-form-item label="Client Secret" prop="clientSecret">
        <el-input
          v-model="form.clientSecret"
          type="password"
          show-password
          maxlength="255"
          :placeholder="editId === undefined ? '请输入客户端密钥（加密后入库）' : '留空 = 不修改原密钥'"
        />
      </el-form-item>
      <el-form-item label="Scope" prop="scopes">
        <el-input v-model="form.scopes" placeholder="openid profile email" maxlength="255" />
      </el-form-item>
      <el-form-item label="回调地址" prop="redirectUri">
        <el-input v-model="form.redirectUri" placeholder="https://admin.example.com/api/sso/callback" maxlength="500" />
      </el-form-item>
      <el-form-item label="字段映射" prop="fieldMapping">
        <el-input
          v-model="form.fieldMapping"
          type="textarea"
          :rows="2"
          placeholder='JSON，如 {"username":"preferred_username","email":"email"}；缺省用标准 claim'
        />
      </el-form-item>
      <el-form-item label="邮箱绑定" prop="linkByEmail">
        <el-switch v-model="form.linkByEmail" />
      </el-form-item>
      <el-form-item label="默认角色" prop="defaultRoleCodes">
        <el-input
          v-model="form.defaultRoleCodes"
          placeholder="自动建号时授予的角色编码，逗号分隔，如 viewer"
          maxlength="255"
        />
      </el-form-item>
      <el-form-item label="排序" prop="sort">
        <el-input-number v-model="form.sort" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" maxlength="255" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </BasicDialog>
</template>

<style scoped>
.sso-form {
  max-width: 100%;
}
</style>
