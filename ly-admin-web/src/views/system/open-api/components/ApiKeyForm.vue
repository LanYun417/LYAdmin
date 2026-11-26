<script setup lang="ts">
/**
 * API Key 表单（签发 / 编辑配置）。
 * 模块职责：名称、所属用户、权限范围、IP 白名单、过期时间。
 * 密钥本体不可编辑——轮换 = 删旧建新（避免「改了密钥但调用方没同步」的事故）。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { getApiKeyApi, createApiKeyApi, updateApiKeyApi } from '@/api/open';
import { getUserListApi } from '@/api/user';
import type { ApiKey, UserDetail } from '@/types/api';

defineOptions({ name: 'ApiKeyForm' });

const props = defineProps<{
  /** 编辑的密钥 id；undefined = 新增 */
  editId?: number;
}>();

const emit = defineEmits<{
  (e: 'saved', plainKey?: string): void;
}>();

const visible = defineModel<boolean>({ required: true });

const formRef = ref<FormInstance>();
const submitting = ref(false);
const loadingDetail = ref(false);
/** 可选的所属用户（下拉） */
const users = ref<UserDetail[]>([]);

interface ApiKeyFormModel {
  name: string;
  userId: number | undefined;
  /** 逗号分隔输入，提交时拆数组 */
  scopesText: string;
  allowIpsText: string;
  expiresAt: string;
  remark: string;
}

const emptyForm = (): ApiKeyFormModel => ({
  name: '',
  userId: undefined,
  scopesText: '',
  allowIpsText: '',
  expiresAt: '',
  remark: '',
});

const form = ref<ApiKeyFormModel>(emptyForm());

const rules: FormRules = {
  name: [{ required: true, message: '请输入密钥名称', trigger: 'blur' }],
  userId: [{ required: true, message: '请选择所属用户', trigger: 'change' }],
};

/** 打开时重置 / 回显 */
watch(visible, async (open) => {
  if (!open) {
    return;
  }
  form.value = emptyForm();
  if (users.value.length === 0) {
    try {
      const res = await getUserListApi({ page: 1, pageSize: 100 });
      users.value = res.list ?? [];
    } catch {
      users.value = [];
    }
  }
  if (props.editId === undefined) {
    return;
  }
  loadingDetail.value = true;
  try {
    const detail: ApiKey = await getApiKeyApi(props.editId);
    Object.assign(form.value, {
      name: detail.name,
      userId: detail.userId,
      scopesText: (detail.scopes ?? []).join(', '),
      allowIpsText: (detail.allowIps ?? []).join(', '),
      expiresAt: detail.expiresAt ? detail.expiresAt.slice(0, 10) : '',
      remark: detail.remark ?? '',
    });
  } finally {
    loadingDetail.value = false;
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
    const split = (text: string): string[] =>
      text
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter(Boolean);
    if (props.editId === undefined) {
      const created = await createApiKeyApi({
        name: form.value.name.trim(),
        userId: form.value.userId,
        scopes: split(form.value.scopesText),
        allowIps: split(form.value.allowIpsText),
        ...(form.value.expiresAt ? { expiresAt: new Date(form.value.expiresAt).toISOString() } : {}),
        remark: form.value.remark.trim() || undefined,
      } as Partial<ApiKey>);
      ElMessage.success('密钥已签发，请立即保存明文');
      emit('saved', created.key);
      return;
    }
    await updateApiKeyApi(props.editId, {
      name: form.value.name.trim(),
      scopes: split(form.value.scopesText),
      allowIps: split(form.value.allowIpsText),
      ...(form.value.expiresAt ? { expiresAt: new Date(form.value.expiresAt).toISOString() } : {}),
      remark: form.value.remark.trim() || undefined,
    } as Partial<ApiKey>);
    ElMessage.success('保存成功');
    emit('saved');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog v-model="visible" :title="editId === undefined ? '签发 API Key' : '编辑 API Key'" width="560px">
    <el-alert
      v-if="editId === undefined"
      type="info"
      :closable="false"
      class="mb-3"
      title="密钥明文仅在签发成功时展示一次，请妥善保存；遗失只能删除后重新签发。"
    />
    <el-form
      ref="formRef"
      v-loading="loadingDetail"
      :model="form"
      :rules="rules"
      label-width="110px"
      class="api-key-form"
    >
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" maxlength="50" placeholder="如：CI 部署 / 数据分析同步" />
      </el-form-item>
      <el-form-item v-if="editId === undefined" label="所属用户" prop="userId">
        <el-select v-model="form.userId" filterable placeholder="Key 将以该用户身份调用接口">
          <el-option
            v-for="item in users"
            :key="item.id"
            :label="`${item.nickname}（${item.username}）`"
            :value="item.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="权限范围">
        <el-input
          v-model="form.scopesText"
          placeholder="留空 = 与所属用户完全一致；否则填写权限码，逗号分隔（仅能缩小范围）"
        />
      </el-form-item>
      <el-form-item label="IP 白名单">
        <el-input
          v-model="form.allowIpsText"
          placeholder="留空 = 不限制；支持 IP 与 CIDR，逗号分隔，如 10.0.0.1, 192.168.1.0/24"
        />
      </el-form-item>
      <el-form-item label="过期时间">
        <el-date-picker v-model="form.expiresAt" type="date" placeholder="留空 = 永久" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" maxlength="255" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ editId === undefined ? '签发' : '保存' }}
      </el-button>
    </template>
  </BasicDialog>
</template>
