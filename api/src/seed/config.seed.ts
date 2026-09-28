/**
 * 系统参数种子数据。
 * 模块职责：写入内置系统参数（幂等，按 configKey 去重），systemFlag=1 受删除保护。
 */
import { SysConfig } from '@/models';

/** 内置参数定义。 */
interface ConfigSeed {
  configName: string;
  configKey: string;
  configValue: string;
  remark: string;
}

/** 内置参数（登录安全等模块的运行时可调项）。 */
const CONFIG_SEEDS: ConfigSeed[] = [
  {
    configName: '登录失败锁定阈值',
    configKey: 'sys.account.maxLoginAttempts',
    configValue: '5',
    remark: '同一账号连续登录失败达到该次数后触发锁定（登录安全加固模块读取）',
  },
  {
    configName: '账号锁定时长（分钟）',
    configKey: 'sys.account.lockMinutes',
    configValue: '15',
    remark: '登录锁定持续时间，超过后自动解除锁定',
  },
];

/**
 * 执行系统参数种子（幂等：按 configKey 去重；已存在的键不覆盖现值，便于运维自行调参）。
 */
export async function seedConfig(): Promise<void> {
  for (const seed of CONFIG_SEEDS) {
    await SysConfig.findOrCreate({
      where: { configKey: seed.configKey },
      defaults: {
        configName: seed.configName,
        configKey: seed.configKey,
        configValue: seed.configValue,
        systemFlag: 1,
        remark: seed.remark,
      },
    });
  }
  console.log(`[Seed] 系统参数数据完成，共 ${CONFIG_SEEDS.length} 项`);
}
