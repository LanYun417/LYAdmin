<script setup lang="ts">
/**
 * 告警渠道表单（新增 / 编辑）。
 * 模块职责：按渠道类型动态渲染配置字段；敏感字段只写不读（留空 = 不修改）。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { createAlertChannelApi, getAlertChannelConfig, updateAlertChannelApi } from '@/api/alert';
import type { AlertChannel } from '@/types/api';

defineOptions({ name: 'ChannelForm' });

const props = defineProps<{
  /** 编辑的渠道 id；undefined = 新增 */
  editId?: number;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = defineModel<boolean>({ required: true });

const CHANNEL_TYPES = [
  { value: 'email', label: '邮件', icon: 'bi-envelope' },
  { value: 'webhook', label: 'Webhook', icon: 'bi-link-45deg' },
  { value: 'dingtalk', label: '钉钉', icon: 'bi-chat-dots' },
  { value: 'wecom', label: '企业微信', icon: 'bi-wechat' },
  { value: 'feishu', label: '飞书', icon: 'bi-chat-square-dots' },
];

const formRef = ref<FormInstance>();
const submitting = ref(false);
const loadingDetail = ref(false);

interface ChannelFormModel {
  type: string;
  name: string;
  remark: string;
  status: number;
  sort: number;
  /** 邮件 */
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
  /** Webhook 类 */
  url: string;
  webhook: string;
  secret: string;
}

const emptyForm = (): ChannelFormModel => ({
  type: 'email',
  name: '',
  remark: '',
  status: 1,
  sort: 0,
  host: '',
  port: 465,
  secure: true,
  user: '',
  pass: '',
  from: '',
  to: '',
  url: '',
  webhook: '',
  secret: '',
});

const form = ref<ChannelFormModel>(emptyForm());

/** 是否为 webhook 类型（url 字段） */
const isWebhook = computed(() => form.value.type === 'webhook');
/** 是否为机器人类型（webhook + 可选 secret 字段） */
const isRobot = computed(() => ['dingtalk', 'wecom', 'feishu'].includes(form.value.type));

const rules: FormRules = {
  type: [{ required: true, message: '请选择渠道类型', trigger: 'change' }],
  name: [{ required: true, message: '请输入渠道名称', trigger: 'blur' }],
};

/** 打开时重置 / 回显 */
watch(visible, async (open) => {
  if (!open) {
    return;
  }
  form.value = emptyForm();
  if (props.editId === undefined) {
    return;
  }
  loadingDetail.value = true;
  try {
    const detail: AlertChannel = await getAlertChannelConfig(props.editId);
    Object.assign(form.value, {
      type: detail.type,
      name: detail.name,
      remark: detail.remark ?? '',
      status: detail.status,
      sort: detail.sort,
      ...detail.config,
    });
  } finally {
    loadingDetail.value = false;
  }
});

/** 组装 config（按类型裁剪字段，敏感字段为空串不下发）。 */
function buildConfig(): Record<string, unknown> {
  const common = { remark: form.value.remark };
  if (form.value.type === 'email') {
    return {
      host: form.value.host,
      port: form.value.port,
      secure: form.value.secure,
      user: form.value.user,
      ...(form.value.pass.trim() ? { pass: form.value.pass.trim() } : {}),
      ...(form.value.from.trim() ? { from: form.value.from.trim() } : {}),
      to: form.value.to,
      ...common,
    };
  }
  if (isWebhook.value) {
    return {
      url: form.value.url,
      ...(form.value.secret.trim() ? { secret: form.value.secret.trim() } : {}),
      ...common,
    };
  }
  return {
    webhook: form.value.webhook,
    ...(form.value.secret.trim() ? { secret: form.value.secret.trim() } : {}),
    ...common,
  };
}

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
    const payload = {
      type: form.value.type,
      name: form.value.name.trim(),
      config: buildConfig(),
      status: form.value.status,
      sort: form.value.sort,
      ...(form.value.remark.trim() ? { remark: form.value.remark.trim() } : {}),
    };
    if (props.editId === undefined) {
      await createAlertChannelApi(payload);
    } else {
      await updateAlertChannelApi(props.editId, payload);
    }
    ElMessage.success('保存成功');
    emit('saved');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog v-model="visible" :title="editId === undefined ? '新增告警渠道' : '编辑告警渠道'" width="560px">
    <el-form
      ref="formRef"
      v-loading="loadingDetail"
      :model="form"
      :rules="rules"
      label-width="110px"
      class="channel-form"
    >
      <el-form-item label="类型" prop="type">
        <el-select v-model="form.type" :disabled="editId !== undefined" placeholder="请选择渠道类型">
          <el-option v-for="item in CHANNEL_TYPES" :key="item.value" :label="item.label" :value="item.value">
            <i :class="item.icon" class="mr-2" />{{ item.label }}
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" maxlength="50" placeholder="如：运维邮件 / 安全群机器人" />
      </el-form-item>

      <!-- 邮件 -->
      <template v-if="form.type === 'email'">
        <el-form-item label="SMTP 地址" required>
          <el-input v-model="form.host" placeholder="smtp.example.com" maxlength="255" />
        </el-form-item>
        <el-form-item label="端口">
          <el-input-number v-model="form.port" :min="1" :max="65535" />
          <el-checkbox v-model="form.secure" class="ml-3">SSL/TLS</el-checkbox>
        </el-form-item>
        <el-form-item label="用户名">
          <el-input v-model="form.user" maxlength="255" placeholder="SMTP 登录账号" />
        </el-form-item>
        <el-form-item label="口令">
          <el-input
            v-model="form.pass"
            type="password"
            show-password
            maxlength="255"
            :placeholder="editId === undefined ? 'SMTP 口令（加密后入库）' : '留空 = 不修改原口令'"
          />
        </el-form-item>
        <el-form-item label="发件人">
          <el-input v-model="form.from" maxlength="255" placeholder="留空则用 LOGIN 用户名" />
        </el-form-item>
        <el-form-item label="收件人" required>
          <el-input v-model="form.to" placeholder="多个收件人用逗号分隔" maxlength="500" />
        </el-form-item>
      </template>

      <!-- Webhook -->
      <template v-else-if="isWebhook">
        <el-form-item label="Webhook URL" required>
          <el-input v-model="form.url" placeholder="https://example.com/hook" maxlength="500" />
        </el-form-item>
        <el-form-item label="签名密钥">
          <el-input
            v-model="form.secret"
            type="password"
            show-password
            maxlength="255"
            placeholder="留空 = 不加签；配置后以 X-Signature 头下发 HMAC-SHA256"
          />
        </el-form-item>
      </template>

      <!-- 钉钉 / 企微 / 飞书 -->
      <template v-else-if="isRobot">
        <el-form-item label="机器人 Webhook" required>
          <el-input
            v-model="form.webhook"
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            maxlength="500"
          />
        </el-form-item>
        <el-form-item v-if="form.type !== 'wecom'" label="加签密钥">
          <el-input
            v-model="form.secret"
            type="password"
            show-password
            maxlength="255"
            :placeholder="editId === undefined ? '机器人加签密钥（可选，加密后入库）' : '留空 = 不修改原密钥'"
          />
        </el-form-item>
      </template>

      <el-form-item label="排序">
        <el-input-number v-model="form.sort" :min="0" :max="9999" />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" maxlength="255" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </BasicDialog>
</template>
