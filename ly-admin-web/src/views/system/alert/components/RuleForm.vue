<script setup lang="ts">
/**
 * 告警规则表单（新增 / 编辑）。
 * 模块职责：事件类型、级别、渠道选择与冷却配置。
 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import BasicDialog from '@/components/BasicDialog/index.vue';
import { createAlertRuleApi, updateAlertRuleApi } from '@/api/alert';
import type { AlertChannel } from '@/types/api';

defineOptions({ name: 'RuleForm' });

const props = defineProps<{
  /** 编辑的规则 id；undefined = 新增 */
  editId?: number;
  /** 渠道列表（供多选；由父页面加载后传入） */
  channels: AlertChannel[];
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

const visible = defineModel<boolean>({ required: true });

const LEVELS = [
  { value: 'info', label: '提示', description: '一般性通知' },
  { value: 'warning', label: '警告', description: '需要关注的问题' },
  { value: 'critical', label: '严重', description: '紧急，需立即处理' },
];

/** 常用事件类型（下拉 + 允许自定义输入）。 */
const COMMON_EVENTS = ['export.failed', 'login.bruteForce', 'monitor.disk', 'task.failed', 'alert.test'];

const formRef = ref<FormInstance>();
const submitting = ref(false);

interface RuleFormModel {
  name: string;
  eventType: string;
  level: string;
  channelIds: number[];
  cooldownSeconds: number;
  remark: string;
}

const emptyForm = (): RuleFormModel => ({
  name: '',
  eventType: '',
  level: 'warning',
  channelIds: [],
  cooldownSeconds: 300,
  remark: '',
});

const form = ref<RuleFormModel>(emptyForm());

/** 规则编辑回显：父页面传入的列表里没有详情接口，这里走列表过滤（规则数量少） */
watch(visible, async (open) => {
  if (!open) {
    return;
  }
  form.value = emptyForm();
  if (props.editId === undefined) {
    return;
  }
  const { listAlertRulesApi } = await import('@/api/alert');
  const rules = await listAlertRulesApi();
  const detail = rules.find((item) => item.id === props.editId);
  if (detail) {
    Object.assign(form.value, {
      name: detail.name,
      eventType: detail.eventType,
      level: detail.level,
      channelIds: detail.channelIds ?? [],
      cooldownSeconds: detail.cooldownSeconds,
      remark: detail.remark ?? '',
    });
  }
});

const rules: FormRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  eventType: [{ required: true, message: '请选择或输入事件类型', trigger: 'change' }],
  level: [{ required: true, message: '请选择告警级别', trigger: 'change' }],
  channelIds: [
    {
      validator: (_rule: unknown, value: number[], callback: (error?: Error) => void) => {
        if (!Array.isArray(value) || value.length === 0) {
          callback(new Error('至少选择一个通知渠道'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
};

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
      name: form.value.name.trim(),
      eventType: form.value.eventType.trim(),
      level: form.value.level,
      channelIds: form.value.channelIds,
      cooldownSeconds: form.value.cooldownSeconds,
      ...(form.value.remark.trim() ? { remark: form.value.remark.trim() } : {}),
    };
    if (props.editId === undefined) {
      await createAlertRuleApi(payload);
    } else {
      await updateAlertRuleApi(props.editId, payload);
    }
    ElMessage.success('保存成功');
    emit('saved');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog v-model="visible" :title="editId === undefined ? '新增告警规则' : '编辑告警规则'" width="560px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" class="rule-form">
      <el-form-item label="规则名称" prop="name">
        <el-input v-model="form.name" maxlength="50" placeholder="如：导出失败提醒" />
      </el-form-item>
      <el-form-item label="事件类型" prop="eventType">
        <el-select
          v-model="form.eventType"
          filterable
          allow-create
          default-first-option
          placeholder="选择常用事件或输入自定义类型"
        >
          <el-option v-for="item in COMMON_EVENTS" :key="item" :label="item" :value="item" />
        </el-select>
      </el-form-item>
      <el-form-item label="告警级别" prop="level">
        <el-select v-model="form.level" placeholder="事件级别 ≥ 该级别才触发">
          <el-option v-for="item in LEVELS" :key="item.value" :label="item.label" :value="item.value">
            <span class="mr-2">{{ item.label }}</span>
            <span class="text-muted">{{ item.description }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="通知渠道" prop="channelIds">
        <el-select v-model="form.channelIds" multiple placeholder="选择要通知的渠道">
          <el-option
            v-for="item in channels"
            :key="item.id"
            :label="`${item.name}（${item.type}）`"
            :value="item.id"
            :disabled="item.status !== 1"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="冷却时间">
        <el-input-number v-model="form.cooldownSeconds" :min="0" :max="86400" :step="60" />
        <span class="ml-2 text-xs text-muted">秒；同一规则的同一去重键在该窗口内只告警一次，0 = 不冷却</span>
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
