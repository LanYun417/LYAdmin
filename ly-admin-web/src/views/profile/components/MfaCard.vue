<script setup lang="ts">
/**
 * 二次验证（TOTP）管理卡。
 * 模块职责：状态展示、绑定（种子 → 动态码确认 → 恢复码）、解绑、恢复码重签。
 *
 *  sagas：恢复码只在签发时明文展示一次，之后只存哈希——用户没保存就只能
 * 重签（旧码作废），因此签发后必须显式提示「已复制保存」。
 */

import { ElMessage, ElMessageBox } from '@/utils/element';
import { disableMfaApi, enableMfaApi, getMfaStatusApi, regenerateMfaRecoveryApi, setupMfaApi } from '@/api/mfa';
import type { MfaStatus } from '@/types/api';
import BasicDialog from '@/components/BasicDialog/index.vue';

defineOptions({ name: 'MfaCard' });

const loading = ref(false);
const status = ref<MfaStatus>({ enabled: false, pending: false, recoveryRemaining: 0, enabledAt: null });

/* ------------------------------- 绑定流程 ------------------------------- */

/** 绑定弹窗可见 */
const setupVisible = ref(false);
/** setup 返回的种子 / otpauth URL */
const setupResult = ref<{ secret: string; otpauthUrl: string } | null>(null);
/** 动态码输入 */
const codeInput = ref('');
const setupSubmitting = ref(false);
/** 启用后返回的恢复码（一次性明文） */
const recoveryCodes = ref<string[]>([]);

/** 账号登录口令（绑定属于敏感操作，需二次确认身份） */
const passwordInput = ref('');

/** 加载状态 */
async function loadStatus(): Promise<void> {
  loading.value = true;
  try {
    status.value = await getMfaStatusApi();
  } finally {
    loading.value = false;
  }
}

onMounted(loadStatus);

/** 开始绑定 */
async function startSetup(): Promise<void> {
  if (!passwordInput.value) {
    ElMessage.warning('请输入登录口令');
    return;
  }
  setupSubmitting.value = true;
  try {
    setupResult.value = await setupMfaApi(passwordInput.value);
    setupVisible.value = true;
  } finally {
    setupSubmitting.value = false;
  }
}

/** 确认启用 */
async function confirmEnable(): Promise<void> {
  if (!/^\d{6}$/.test(codeInput.value)) {
    ElMessage.warning('请输入 6 位动态码');
    return;
  }
  setupSubmitting.value = true;
  try {
    recoveryCodes.value = await enableMfaApi(codeInput.value);
    setupVisible.value = false;
    setupResult.value = null;
    codeInput.value = '';
    passwordInput.value = '';
    recoveryViewVisible.value = true;
    await loadStatus();
    ElMessage.success('二次验证已启用，请妥善保存恢复码');
  } finally {
    setupSubmitting.value = false;
  }
}

/** 解绑 */
async function handleDisable(): Promise<void> {
  try {
    await ElMessageBox.confirm('解绑后将无法使用动态码登录，确定继续吗？', '提示', { type: 'warning' });
  } catch {
    return;
  }
  await disableMfaApi(passwordInput.value);
  passwordInput.value = '';
  recoveryCodes.value = [];
  await loadStatus();
  ElMessage.success('已解绑二次验证');
}

/** 重签恢复码 */
const recoveryDialogVisible = ref(false);
const recoveryCodeInput = ref('');
const newRecoveryCodes = ref<string[]>([]);
const recoverySubmitting = ref(false);
/** 恢复码一次性展示弹窗（启用后或重签后自动弹出） */
const recoveryViewVisible = ref(false);

async function confirmRegenerate(): Promise<void> {
  if (!/^\d{6}$/.test(recoveryCodeInput.value)) {
    ElMessage.warning('请输入 6 位动态码');
    return;
  }
  recoverySubmitting.value = true;
  try {
    newRecoveryCodes.value = await regenerateMfaRecoveryApi(recoveryCodeInput.value);
    recoveryDialogVisible.value = false;
    recoveryCodeInput.value = '';
    recoveryViewVisible.value = true;
    await loadStatus();
    ElMessage.success('恢复码已重签，旧码全部作废');
  } finally {
    recoverySubmitting.value = false;
  }
}

/** 复制文本到剪贴板 */
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success('已复制');
  } catch {
    ElMessage.warning('复制失败，请手动选择复制');
  }
}

/** 复制当前展示的恢复码 */
async function copyRecovery(): Promise<void> {
  const codes = newRecoveryCodes.value.length ? newRecoveryCodes.value : recoveryCodes.value;
  await copyText(codes.join('\n'));
}

/** 关闭一次性展示时清空本地缓存（不留明文在内存里过夜） */
watch(recoveryViewVisible, (open) => {
  if (!open) {
    recoveryCodes.value = [];
    newRecoveryCodes.value = [];
  }
});
</script>

<template>
  <div v-loading="loading" class="mfa-card">
    <template v-if="!status.enabled">
      <p class="text-[13px] text-muted">
        未启用。启用后登录需额外输入 authenticator 应用的 6 位动态码，大幅提升账号安全性。
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <el-input v-model="passwordInput" type="password" show-password placeholder="登录口令" style="width: 200px" />
        <el-button type="primary" :loading="setupSubmitting" @click="startSetup">开始绑定</el-button>
      </div>
    </template>

    <template v-else>
      <p class="text-[13px] text-muted">
        已启用{{ status.enabledAt ? `（${new Date(status.enabledAt).toLocaleString()}）` : '' }}，剩余恢复码
        {{ status.recoveryRemaining }} 个。
      </p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <el-button @click="recoveryDialogVisible = true">重签恢复码</el-button>
        <el-input v-model="passwordInput" type="password" show-password placeholder="登录口令" style="width: 200px" />
        <el-button type="danger" @click="handleDisable">解绑</el-button>
      </div>
    </template>

    <!-- 绑定：种子与 otpauth URL -->
    <BasicDialog v-model="setupVisible" title="绑定二次验证" width="520px">
      <p class="text-[13px] text-muted">
        用 authenticator 应用（Google Authenticator / 1Password / Authy 等）扫描或手动添加下方密钥，然后回填动态码。
      </p>
      <el-form label-width="90px" class="mt-3">
        <el-form-item label="密钥">
          <el-input :model-value="setupResult?.secret ?? ''" readonly>
            <template #append>
              <el-button @click="copyText(setupResult?.secret ?? '')">复制</el-button>
            </template>
          </el-input>
        </el-form-item>
        <el-form-item label="otpauth">
          <el-input :model-value="setupResult?.otpauthUrl ?? ''" readonly />
        </el-form-item>
        <el-form-item label="动态码">
          <el-input v-model="codeInput" maxlength="6" placeholder="请输入 6 位动态码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="setupVisible = false">取消</el-button>
        <el-button type="primary" :loading="setupSubmitting" @click="confirmEnable">确认启用</el-button>
      </template>
    </BasicDialog>

    <!-- 恢复码一次性展示 -->
    <BasicDialog v-model="recoveryDialogVisible" title="重签恢复码" width="480px">
      <p class="text-[13px] text-muted">请输入当前动态码以重签。新恢复码生成后，旧的全部作废。</p>
      <el-input v-model="recoveryCodeInput" class="mt-3" maxlength="6" placeholder="请输入 6 位动态码" />
      <template #footer>
        <el-button @click="recoveryDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="recoverySubmitting" @click="confirmRegenerate">重签</el-button>
      </template>
    </BasicDialog>

    <BasicDialog
      v-if="recoveryCodes.length || newRecoveryCodes.length"
      :model-value="true"
      title="保存恢复码"
      width="480px"
      @update:model-value="recoveryCodes = []"
    >
      <p class="text-[13px] text-danger">恢复码仅此一次展示，刷新或离开后无法再次查看，请立即保存。</p>
      <div class="recovery-codes">
        <code v-for="item in recoveryCodes.length ? recoveryCodes : newRecoveryCodes" :key="item">{{ item }}</code>
      </div>
      <template #footer>
        <el-button type="primary" @click="copyRecovery">复制</el-button>
        <el-button @click="recoveryCodes = []">我已保存</el-button>
      </template>
    </BasicDialog>
  </div>
</template>

<style scoped>
.recovery-codes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 12px;
}

.recovery-codes code {
  padding: 6px 8px;
  font-size: 13px;
  text-align: center;
  user-select: all;
  background-color: var(--el-fill-color-light);
  border-radius: 6px;
}
</style>
