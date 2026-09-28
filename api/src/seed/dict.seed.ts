/**
 * 字典种子数据。
 * 模块职责：写入少量常用字典类型与其字典项，幂等执行。
 *
 * 幂等策略：类型按 `dictType` 编码、项按「类型 + 值」去重，已存在则**跳过**，
 * 不覆盖使用者在界面上后续做的修改（与菜单/角色种子的 findOrCreate 语义一致）。
 */
import { Status } from '@/constants';
import { DictItem, DictType } from '@/models';

/** 字典项种子定义。 */
interface DictItemSeed {
  dictLabel: string;
  dictValue: string;
  sort: number;
  remark?: string;
}

/** 字典类型种子定义。 */
interface DictTypeSeed {
  dictName: string;
  dictType: string;
  remark: string;
  items: DictItemSeed[];
}

/** 默认字典定义。 */
const DICT_SEEDS: DictTypeSeed[] = [
  {
    dictName: '用户性别',
    dictType: 'sys_user_sex',
    remark: '用户性别列表',
    items: [
      { dictLabel: '男', dictValue: '1', sort: 1 },
      { dictLabel: '女', dictValue: '2', sort: 2 },
      { dictLabel: '未知', dictValue: '0', sort: 3 },
    ],
  },
  {
    dictName: '系统是否',
    dictType: 'sys_yes_no',
    remark: '通用是否（Y / N）',
    items: [
      { dictLabel: '是', dictValue: 'Y', sort: 1 },
      { dictLabel: '否', dictValue: 'N', sort: 2 },
    ],
  },
  {
    dictName: '通用状态',
    dictType: 'sys_common_status',
    remark: '启用 / 禁用',
    items: [
      { dictLabel: '启用', dictValue: '1', sort: 1 },
      { dictLabel: '禁用', dictValue: '0', sort: 2 },
    ],
  },
];

/**
 * 执行字典种子（幂等）。
 */
export async function seedDict(): Promise<void> {
  let typeCreated = 0;
  let itemCreated = 0;

  for (const seed of DICT_SEEDS) {
    const [dictTypeRow, created] = await DictType.findOrCreate({
      where: { dictType: seed.dictType },
      defaults: {
        dictName: seed.dictName,
        dictType: seed.dictType,
        status: Status.ENABLED,
        remark: seed.remark,
      },
    });
    if (created) {
      typeCreated += 1;
    }

    for (const item of seed.items) {
      const [, itemWasCreated] = await DictItem.findOrCreate({
        where: { dictType: dictTypeRow.dictType, dictValue: item.dictValue },
        defaults: {
          dictType: dictTypeRow.dictType,
          dictLabel: item.dictLabel,
          dictValue: item.dictValue,
          sort: item.sort,
          status: Status.ENABLED,
          remark: item.remark ?? null,
        },
      });
      if (itemWasCreated) {
        itemCreated += 1;
      }
    }
  }

  console.log(`[Seed] 字典数据完成，新增 ${typeCreated} 个字典类型 / ${itemCreated} 个字典项`);
}
