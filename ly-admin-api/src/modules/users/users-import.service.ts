/**
 * 用户批量导入服务（CSV）。
 *
 * 口径（与「批量删除」刻意相反，见 common/utils/batch.ts 的注释）：
 * - **全成功或全不写**：先解析 + 逐行校验，任何一行不合格就整批不落库并返回逐行报告；
 *   全部合格才在一个事务里写入。导入是"批量新建"，半成功会让管理员难以判断到底导进去几条，
 *   而删除是幂等的、可部分成功。
 * - **校验复用 DTO**：逐行把对象交给 `CreateUserDto` + class-validator 校验，
 *   错误文案与接口新增用户完全一致（不再维护第二套规则）。
 * - **请求级问题返回 400**（文件为空 / 表头缺列 / 超行数上限），
 *   **行级问题返回 200 + 报告**（`{ total, created, failed[] }`）——报告是"处理结果"而不是异常，
 *   且统一异常信封的 `data` 恒为 null，装不下逐行明细。
 */
import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AppException } from '../../common/exception/app.exception.js';
import { assertPasswordNotContainsAccount } from '../../common/auth/password-policy.js';
import { parseCsv, rowToObject } from '../../common/utils/csv-parse.js';
import { hashPassword } from '../../common/utils/utils.js';
import { Status } from '../../common/config/constants.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthCacheService } from '../../common/auth/auth-cache.service.js';
import { CreateUserDto } from './dto/users.dto.js';

/** 导入模板表头（顺序即模板列顺序；括号内是取值说明，解析时会自动忽略）。 */
const TEMPLATE_HEADER = [
  '账号',
  '昵称',
  '密码',
  '邮箱',
  '手机号',
  '性别(男/女)',
  '部门ID',
  '状态(启用/禁用)',
  '角色编码',
  '备注',
];

/** 必填列（缺哪列直接 400，避免"整表都少字段"这种低级错误被当成 N 行行级错误）。 */
const REQUIRED_HEADER = ['账号', '昵称', '密码'];

/** 性别文本 → 字典值（与 sys_user_sex 字典一致）。 */
const GENDER_MAP: Record<string, string> = { 男: '1', 女: '2', 未知: '0' };

/** 状态文本 → 数值。 */
const STATUS_MAP: Record<string, number> = {
  启用: Status.ENABLED,
  正常: Status.ENABLED,
  禁用: Status.DISABLED,
  停用: Status.DISABLED,
};

/** 单行导入失败原因。 */
export interface ImportRowError {
  /** 文件中的物理行号（含表头，便于用户定位） */
  line: number;
  /** 账号（能解析出来时带上，方便对号入座） */
  username: string;
  /** 失败原因（可多条，用「；」连接） */
  message: string;
}

/** 导入结果。 */
export interface ImportResult {
  /** 数据行总数 */
  total: number;
  /** 成功写入条数（全成功或全不写，故非 0 即 total） */
  created: number;
  /** 失败明细（为空表示导入成功） */
  failed: ImportRowError[];
}

@Injectable()
export class UsersImportService {
  private readonly logger = new Logger(UsersImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authCache: AuthCacheService,
  ) {}

  /** 模板内容（表头 + 两行示例，含一行中文字段示例与一行留空示例）。 */
  buildTemplateCsv(): string {
    const header = TEMPLATE_HEADER.join(',');
    const example = [
      'zhangsan',
      '张三',
      'Zhang123',
      'zhangsan@example.com',
      '13800000000',
      '男',
      '0',
      '启用',
      'common',
      '示例行，可删除',
    ];
    const hint = ['lisi', '李四', 'Li456789', '', '', '女', '0', '禁用', '', '密码需 8~20 位且含字母和数字'];
    return `\uFEFF${[header, example.join(','), hint.join(',')].join('\r\n')}\r\n`;
  }

  /**
   * 导入用户。
   * @param csvText CSV 文本（已按 UTF-8 解码）
   * @returns 导入报告（行级问题在 `failed` 中，不抛异常）
   */
  async importUsers(csvText: string): Promise<ImportResult> {
    const trimmed = csvText.trim();
    if (!trimmed) {
      throw AppException.badRequest('文件为空，请先下载模板并填写数据');
    }

    let parsed;
    try {
      parsed = parseCsv(csvText);
    } catch (error) {
      throw AppException.badRequest(error instanceof Error ? error.message : 'CSV 解析失败');
    }

    const { header, rows } = parsed;
    if (header.length === 0) {
      throw AppException.badRequest('缺少表头，请使用模板文件');
    }
    const missing = REQUIRED_HEADER.filter((column) => !header.includes(column));
    if (missing.length > 0) {
      throw AppException.badRequest(`表头缺少必填列：${missing.join('、')}；请下载模板对照`);
    }
    if (rows.length === 0) {
      throw AppException.badRequest('文件中没有有效数据行');
    }

    // 1) 先取全量参照数据（角色编码 → id、已有账号），避免逐行查库
    const roleCodes = new Set<string>();
    rows.forEach((row) => {
      const codes = rowToObject(header, row.values)['角色编码'] ?? '';
      codes
        .split(/[,，;；\s]+/)
        .map((code) => code.trim())
        .filter(Boolean)
        .forEach((code) => roleCodes.add(code));
    });
    const roles = roleCodes.size
      ? await this.prisma.role.findMany({
          where: { roleCode: { in: Array.from(roleCodes) } },
          select: { id: true, roleCode: true },
        })
      : [];
    const roleIdByCode = new Map(roles.map((role) => [role.roleCode, Number(role.id)]));

    // 2) 逐行解析 + 校验（不落库）
    const failed: ImportRowError[] = [];
    const pending: Array<{ dto: CreateUserDto; roleIds: number[] }> = [];
    const seenUsernames = new Map<string, number>();
    const usernameList: string[] = [];

    for (const row of rows) {
      const record = rowToObject(header, row.values);
      const username = record['账号'] ?? '';
      const rowErrors: string[] = [];

      // 文件内重复：同一次导入里出现两次同账号，DB 唯一约束只会报第一条，提前给出更准的提示
      const duplicatedAt = username ? seenUsernames.get(username) : undefined;
      if (duplicatedAt !== undefined) {
        rowErrors.push(`与第 ${duplicatedAt} 行的账号重复`);
      } else if (username) {
        seenUsernames.set(username, row.line);
        usernameList.push(username);
      }

      const dto = plainToInstance(CreateUserDto, {
        username,
        nickname: record['昵称'] ?? '',
        password: record['密码'] ?? '',
        email: record['邮箱'] || undefined,
        phone: record['手机号'] || undefined,
        gender: this.normalizeGender(record['性别(男/女)'] ?? record['性别'] ?? ''),
        deptId: this.normalizeDeptId(record['部门ID'] ?? record['部门'] ?? '', rowErrors),
        status: this.normalizeStatus(record['状态(启用/禁用)'] ?? record['状态'] ?? '', rowErrors),
        remark: record['备注'] || undefined,
      });

      const violations = await validate(dto, { whitelist: true });
      violations.forEach((violation) => {
        rowErrors.push(...Object.values(violation.constraints ?? {}));
      });

      // 口令与账号不得互相包含（跨字段规则，DTO 装饰器管不到）
      if (rowErrors.length === 0) {
        try {
          assertPasswordNotContainsAccount(dto.password, dto.username);
        } catch (error) {
          rowErrors.push(error instanceof Error ? error.message : '密码不符合要求');
        }
      }

      // 角色编码：未知编码直接报错，避免"导入了但角色没绑定"
      const roleIds: number[] = [];
      const codes = (record['角色编码'] ?? '')
        .split(/[,，;；\s]+/)
        .map((code) => code.trim())
        .filter(Boolean);
      codes.forEach((code) => {
        const roleId = roleIdByCode.get(code);
        if (roleId === undefined) {
          rowErrors.push(`角色编码不存在：${code}`);
        } else {
          roleIds.push(roleId);
        }
      });

      if (rowErrors.length > 0) {
        failed.push({ line: row.line, username: username || `第 ${row.line} 行`, message: rowErrors.join('；') });
        continue;
      }
      pending.push({ dto, roleIds });
    }

    // 3) 与库内已有账号比对（一次查询，避免逐行 findUnique）
    if (usernameList.length > 0) {
      const existing = await this.prisma.user.findMany({
        where: { username: { in: usernameList } },
        select: { username: true },
      });
      const existingSet = new Set(existing.map((user) => user.username));
      if (existingSet.size > 0) {
        for (let index = pending.length - 1; index >= 0; index -= 1) {
          const item = pending[index]!;
          if (existingSet.has(item.dto.username)) {
            const sourceRow = rows.find((row) => (rowToObject(header, row.values)['账号'] ?? '') === item.dto.username);
            failed.push({
              line: sourceRow?.line ?? 0,
              username: item.dto.username,
              message: '账号已存在',
            });
            pending.splice(index, 1);
          }
        }
      }
    }

    // 有任何一行不合格 → 整批不写，返回报告
    if (failed.length > 0) {
      failed.sort((left, right) => left.line - right.line);
      this.logger.warn(`[UsersImport] 校验未通过，未写入任何数据：失败 ${failed.length} 行`);
      return { total: rows.length, created: 0, failed };
    }

    // 4) 全部合格 → 事务写入（要么全进去，要么一条都没有）
    const created = await this.writeAll(pending);
    this.logger.log(`[UsersImport] 导入成功：${created} 条`);
    return { total: rows.length, created, failed: [] };
  }

  /**
   * 事务写入用户与角色绑定。
   * 直接使用事务客户端而不是逐个调用 `UsersService.createUser`：后者用自己的 prisma 连接，
   * 无法参与同一个事务，"全成功或全不写"就无从保证。
   */
  private async writeAll(items: Array<{ dto: CreateUserDto; roleIds: number[] }>): Promise<number> {
    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const dto = item.dto;
        const user = await tx.user.create({
          data: {
            username: dto.username,
            password: await hashPassword(dto.password),
            nickname: dto.nickname,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            gender: dto.gender ?? null,
            status: dto.status ?? Status.ENABLED,
            deptId: BigInt(dto.deptId ?? 0),
            remark: dto.remark ?? null,
          },
        });
        if (item.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: item.roleIds.map((roleId) => ({ userId: user.id, roleId: BigInt(roleId) })),
            skipDuplicates: true,
          });
        }
      }
    });
    // 新增用户不影响既有用户的权限缓存，但角色成员数变了（角色管理页的"用户数"来自实时查询）；
    // 这里清一次缓存是防御性的：避免刚导入的账号在 30s 内因缓存拿到空权限。
    this.authCache.invalidate();
    return items.length;
  }

  /** 性别文本 → 字典值（空值返回 undefined，交给 DTO 的可选校验）。 */
  private normalizeGender(value: string): string | undefined {
    const text = value.trim();
    if (!text) {
      return undefined;
    }
    if (GENDER_MAP[text] !== undefined) {
      return GENDER_MAP[text];
    }
    // 也接受直接写字典值 0/1/2
    return /^[012]$/.test(text) ? text : undefined;
  }

  /** 部门 ID 归一（非数字直接记为行级错误）。 */
  private normalizeDeptId(value: string, rowErrors: string[]): number | undefined {
    const text = value.trim();
    if (!text) {
      return undefined;
    }
    if (!/^\d+$/.test(text)) {
      rowErrors.push('部门ID 必须为数字（可留空）');
      return undefined;
    }
    return Number(text);
  }

  /** 状态归一（空值默认启用；无法识别记为行级错误）。 */
  private normalizeStatus(value: string, rowErrors: string[]): number | undefined {
    const text = value.trim();
    if (!text) {
      return undefined;
    }
    if (STATUS_MAP[text] !== undefined) {
      return STATUS_MAP[text];
    }
    if (/^[01]$/.test(text)) {
      return Number(text);
    }
    rowErrors.push('状态只能填「启用」或「禁用」');
    return undefined;
  }
}
