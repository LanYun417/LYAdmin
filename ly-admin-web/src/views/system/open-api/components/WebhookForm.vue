<script setup lang="ts">
/**
 * Webhook 订阅表单（新增 / 编辑）。
 * 模块职责：目标 URL、事件订阅、签名密钥。
 * 签名密钥只写不读：后端永不明文返回，更新时留空 = 不修改。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { createWebhookApi, updateWebhookApi } from '@/api/open';
import type { WebhookItem } from '@/types/api';

defineOptions({ name: 'WebhookForm' });

const props = defineProps<{
  /** 编辑的订阅 id；undefined = 新增 */
  editId?: number;
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = defineModel<boolean>({ required: true });

const formRef = ref<FormInstance>();
const submitting = ref(false);

interface WebhookFormModel {
  name: string;
  url: string;
  /** 逗号分隔输入 */
  eventsText: string;
  secret: string;
  remark: string;
}

const emptyForm = (): WebhookFormModel => ({
  name: '',
  url: '',
  eventsText: '',
  secret: '',
  remark: '',
});

const form = ref<WebhookFormModel>(emptyForm());

/** 常用事件名参考。 */
const COMMON_EVENTS = ['user.created', 'user.updated', 'export.finished', 'alert.test', 'webhook.test'];

/** 事件名校验：点分小写标识。 */
const EVENT_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

const rules: FormRules = {
  name: [{ required: true, message: '请输入订阅名称', trigger: 'blur' }],
  url: [
    { required: true, message: '请输入目标 URL', trigger: 'blur' },
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!/^https?:\/\//.test(value ?? '')) {
          callback(new Error('必须以 http(s):// 开头'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
  eventsText: [
    {
      validator: (_rule: unknown, value: string, callback: (error?: Error) => void) => {
        if (!value?.trim()) {
          callback();
          return;
        }
        const bad = value
          .split(/[,，]/)
          .map((item) => item.trim())
          .filter((item) => item && !EVENT_PATTERN.test(item));
        if (bad.length > 0) {
          callback(new Error(`事件名格式不正确：${bad.join('、')}`));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

/** 打开时重置 / 回显（secret 不回显：后端永不明文返回） */
watch(visible, async (open) => {
  if (!open) {
    return;
  }
  form.value = emptyForm();
  if (props.editId === undefined) {
    return;
  }
  const { getWebhookApi } = await import('@/api/open');
  const detail: WebhookItem = await getWebhookApi(props.editId);
  Object.assign(form.value, {
    name: detail.name,
    url: detail.url,
    eventsText: (detail.events ?? []).join(', '),
    // secret 刻意不回显
    remark: detail.remark ?? '',
  });
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
    const events = form.value.eventsText
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (props.editId === undefined) {
      await createWebhookApi({
        name: form.value.name.trim(),
        url: form.value.url.trim(),
        events,
        secret: form.value.secret,
        remark: form.value.remark.trim() || undefined,
      } as Partial<WebhookItem>);
      ElMessage.success('新增成功');
    } else {
      await updateWebhookApi(props.editId, {
        name: form.value.name.trim(),
        url: form.value.url.trim(),
        events,
        // secret 留空 = 不修改
        ...(form.value.secret.trim() ? { secret: form.value.secret } : {}),
        remark: form.value.remark.trim() || undefined,
      } as Partial<WebhookItem>);
      ElMessage.success('保存成功');
    }
    emit('saved');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog
    v-model="visible"
    :title="editId === undefined ? '新增 Webhook 订阅' : '编辑 Webhook 订阅'"
    width="560px"
  >
    <el-alert
      type="info"
      :closable="false"
      class="mb-3"
      title="每次推送都会带上 X-LY-Signature 签名头（sha256=HMAC-SHA256(body, secret)），接收方用同一密钥重算即可验真。"
    />
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="webhook-form">
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" maxlength="50" placeholder="如：IM 开通通知" />
      </el-form-item>
      <el-form-item label="目标 URL" prop="url">
        <el-input v-model="form.url" placeholder="https://example.com/webhook" maxlength="500" />
      </el-form-item>
      <el-form-item label="订阅事件" prop="eventsText">
        <el-input v-model="form.eventsText" placeholder="留空 = 全部事件；多个事件用逗号分隔" />
        <div class="mt-1 flex flex-wrap gap-1">
          <span
            v-for="item in COMMON_EVENTS"
            :key="item"
            class="cursor-pointer text-primary"
            @click="form.eventsText = form.eventsText ? `${form.eventsText}, ${item}` : item"
          >
            {{ item }}
          </span>
        </div>
      </el-form-item>
      <el-form-item label="签名密钥" prop="secret">
        <el-input
          v-model="form.secret"
          type="password"
          show-password
          maxlength="255"
          :placeholder="editId === undefined ? '接收方用于验签的密钥（加密后入库）' : '留空 = 不修改原密钥'"
        />
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
