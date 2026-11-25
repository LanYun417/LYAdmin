<script setup lang="ts">
/** IP 规则新增 / 编辑弹窗。模块职责：维护 IP/CIDR、规则类型、过期时间与封禁原因。 */

import { ElMessage } from '@/utils/element';
import type { FormInstance, FormRules } from 'element-plus';
import { createIpRuleApi, getIpRuleDetailApi, updateIpRuleApi } from '@/api/ipRule';
import BasicDialog from '@/components/BasicDialog/index.vue';
import type { IpRuleUpsert } from '@/types/api';

defineOptions({ name: 'IpRuleForm' });

const props = defineProps<{
  /** 弹窗可见性 */
  modelValue: boolean;
  /** 编辑的规则 id（为空表示新增） */
  ruleId?: number;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success'): void;
}>();

const formRef = ref<FormInstance>();
const submitting = ref(false);
const isEdit = ref(false);

const defaultForm = (): IpRuleUpsert & { expiresDate?: string } => ({
  ip: '',
  ruleType: 1,
  remark: '',
  expiresAt: null,
  expiresDate: undefined,
});

const form = reactive(defaultForm());

/** 校验 IP/CIDR：IPv4 或 IPv4/0~32 */
function validateIp(_rule: unknown, value: string, callback: (error?: Error) => void): void {
  if (!value) {
    callback(new Error('请输入 IP 或 CIDR 段'));
    return;
  }
  const parts = value.trim().split('/');
  if (parts.length > 2) {
    callback(new Error('仅支持 IPv4 地址或 CIDR 段，如 10.0.0.0/8'));
    return;
  }
  const base = parts[0] ?? '';
  const baseOk =
    /^(\d{1,3}\.){3}\d{1,3}$/.test(base) &&
    base.split('.').every((n) => /^(0|[1-9]\d{0,2})$/.test(n) && Number(n) <= 255);
  let ok = baseOk;
  if (ok && parts.length === 2) {
    const bits = parts[1] ?? '';
    ok = /^\d{1,2}$/.test(bits) && Number(bits) >= 0 && Number(bits) <= 32;
  }
  callback(ok ? undefined : new Error('仅支持 IPv4 地址或 CIDR 段，如 10.0.0.0/8'));
}

const rules: FormRules = {
  ip: [{ required: true, validator: validateIp, trigger: 'blur' }],
  ruleType: [{ required: true, message: '请选择规则类型', trigger: 'change' }],
};

/** 重置表单 */
function resetForm(): void {
  Object.assign(form, defaultForm());
  formRef.value?.clearValidate();
}

/** 加载详情：把 ISO 时间转成 datetime-local 输入值 */
async function loadDetail(id: number): Promise<void> {
  const detail = await getIpRuleDetailApi(id);
  Object.assign(form, {
    ip: detail.ip,
    ruleType: detail.ruleType,
    remark: detail.remark ?? '',
    expiresAt: detail.expiresAt,
    expiresDate: detail.expiresAt ? detail.expiresAt.slice(0, 16) : undefined,
  });
}

watch(
  () => props.modelValue,
  async (visible) => {
    if (!visible) {
      return;
    }
    resetForm();
    isEdit.value = Boolean(props.ruleId);
    if (props.ruleId) {
      await loadDetail(props.ruleId);
    }
  },
);

/** 关闭弹窗 */
function handleClose(): void {
  emit('update:modelValue', false);
}

/** 提交：把本地时间输入转成 ISO 字符串 */
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
    const expiresAt = form.expiresDate ? new Date(form.expiresDate).toISOString() : null;
    if (isEdit.value && props.ruleId) {
      await updateIpRuleApi(props.ruleId, {
        ruleType: form.ruleType,
        remark: form.remark || undefined,
        expiresAt,
      });
      ElMessage.success('更新成功');
    } else {
      await createIpRuleApi({
        ip: form.ip.trim(),
        ruleType: form.ruleType,
        remark: form.remark || undefined,
        expiresAt,
      });
      ElMessage.success('新增成功');
    }
    emit('success');
    handleClose();
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BasicDialog
    :model-value="modelValue"
    :title="isEdit ? '编辑规则' : '新增规则'"
    width="560px"
    :confirm-loading="submitting"
    @update:model-value="handleClose"
    @confirm="handleSubmit"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="IP / CIDR" prop="ip">
        <el-input v-model="form.ip" :disabled="isEdit" placeholder="如 192.168.1.10 或 10.0.0.0/8" />
        <p v-if="isEdit" class="mt-1 text-xs text-muted">IP 创建后不可修改，如需变更请删除后重建。</p>
      </el-form-item>
      <el-form-item label="规则类型" prop="ruleType">
        <el-radio-group v-model="form.ruleType">
          <el-radio-button :value="1">黑名单（拦截）</el-radio-button>
          <el-radio-button :value="2">白名单（放行）</el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="过期时间">
        <el-date-picker
          v-model="form.expiresDate"
          type="datetime"
          placeholder="留空表示永久生效"
          value-format="YYYY-MM-DDTHH:mm:ss"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="封禁原因等（可选）" />
      </el-form-item>
      <el-alert
        v-if="form.ruleType === 2"
        type="info"
        :closable="false"
        show-icon
        title="白名单优先于黑名单：命中白名单的 IP 会直接放行，可用于误封后的自救。"
      />
    </el-form>
  </BasicDialog>
</template>
