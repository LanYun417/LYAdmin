/**
 * BasicDialog 组件测试。
 *
 * 锁住三条真规则：
 * 1. v-model 双向绑定（取消 → 关闭由调用方状态驱动，组件不擅自改 props）；
 * 2. 确定按钮只发 confirm 事件、**不自动关闭**（调用方校验失败时要能留住弹窗）；
 * 3. 窄屏宽度自动压缩为 98%（移动端固定 520px 会横向溢出）。
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import BasicDialog from '@/components/BasicDialog/index.vue';

/** 挂载并用 el-dialog 替身承接 attrs（不影响封装层逻辑断言）。 */
function mountDialog(
  props: Record<string, unknown> = {},
  slots: Record<string, string> = {},
): ReturnType<typeof mount> {
  return mount(BasicDialog, {
    props: { modelValue: true, ...props },
    slots,
    global: {
      stubs: {
        'el-dialog': {
          name: 'ElDialog',
          props: ['modelValue', 'title', 'width'],
          emits: ['update:modelValue'],
          template: '<div class="el-dialog-stub"><slot /><slot name="footer" /></div>',
        },
        'el-button': {
          name: 'ElButton',
          props: ['loading', 'disabled'],
          template: '<button class="el-button-stub"><slot /></button>',
        },
      },
    },
  });
}

describe('BasicDialog', () => {
  it('宽度默认 520px；窄屏自动压到 98%', async () => {
    const wrapper = mountDialog();
    expect(wrapper.findComponent({ name: 'ElDialog' }).props('width')).toBe('520px');

    window.innerWidth = 390;
    window.dispatchEvent(new Event('resize'));
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(wrapper.findComponent({ name: 'ElDialog' }).props('width')).toBe('98%');
    window.innerWidth = 1024;
  });

  it('确定：只发 confirm，不自动关闭（校验失败时调用方可留住弹窗）', async () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAllComponents({ name: 'ElButton' });
    // 默认 footer 两个按钮：取消、确定
    expect(buttons).toHaveLength(2);

    await buttons[1]!.trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    // 关键断言：未 emit update:modelValue=false
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });

  it('取消：发 update:modelValue=false 关闭', async () => {
    const wrapper = mountDialog();
    const buttons = wrapper.findAllComponents({ name: 'ElButton' });

    await buttons[0]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('showFooter=false 时不渲染默认按钮（自定义 #footer 场景）', () => {
    const wrapper = mountDialog({ showFooter: false }, { footer: '<span class="custom-footer">自定义</span>' });
    expect(wrapper.findAllComponents({ name: 'ElButton' })).toHaveLength(0);
    expect(wrapper.find('.custom-footer').exists()).toBe(true);
  });

  it('默认插槽内容渲染', () => {
    const wrapper = mountDialog({}, { default: '<p class="dialog-body">内容</p>' });
    expect(wrapper.find('.dialog-body').text()).toBe('内容');
  });
});
