/**
 * 数据导入服务。
 * 模块职责：上传 CSV → 入队 → 由队列异步执行 → 结果通知。
 *
 * 为什么走队列而不是同步返回：
 * - 大文件（万行级）同步执行会占满请求超时（15s），用户面对的是「转圈 30 秒然后失败」；
 * - 走队列后上传立刻返回「已受理」，执行进度与逐行失败报告落在导入记录里，
 *   完成后站内通知领取，与「异步导出中心」的口径完全对称。
 *
 * 行级处理复用各业务已有的校验链路（用户导入复用 CreateUserDto），
 * 本服务只负责编排：读文件 → 调业务 processor → 落记录。
 */
import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { AppException } from '../../exception/app.exception.js';
import { buildPageResult, parsePagination } from '../../utils/utils.js';
import { QueueService } from '../queue.service.js';
import { NOTICE_TYPE, NoticeService } from '../../../modules/notice/notice.service.js';
import { CSV_IMPORT_MULTER_OPTIONS } from '../../file/upload.config.js';

/** 单次导入行数上限（与队列批大小、内存压力相关）。 */
export const IMPORT_MAX_ROWS = 20_000;

/** 业务处理器：把 CSV 文本转成导入结果。 */
export type ImportProcessor = (csvText: string) => Promise<ImportExecutionResult>;

/** 处理器返回的执行结果。 */
export interface ImportExecutionResult {
  total: number;
  created: number;
  /** 逐行失败报告 */
  failed: Array<{ row: number; message: string }>;
}

/** 已注册的导入类型。 */
interface RegisteredImport {
  title: string;
  processor: ImportProcessor;
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);
  private readonly registry = new Map<string, RegisteredImport>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly notice: NoticeService,
  ) {}

  /** 注册某导入类型的处理器（幂等覆盖）。 */
  register(type: string, title: string, processor: ImportProcessor): void {
    this.registry.set(type, { title, processor });
    this.queue.registerHandler(`import.${type}`, async (payload, ctx) => {
      const csvText = String(payload.csvText ?? '');
      const result = await processor(csvText);
      await this.finish(ctx.jobId, type, result);
    });
  }

  /** 已注册的导入类型（供前端下拉）。 */
  listTypes(): Array<{ type: string; title: string }> {
    return Array.from(this.registry.entries()).map(([type, item]) => ({ type, title: item.title }));
  }

  /** 导入记录分页。 */
  async listRecords(
    query: Record<string, unknown>,
  ): Promise<{ list: unknown[]; total: number; page: number; pageSize: number }> {
    const { page, pageSize, offset, limit } = parsePagination(query);
    const type = typeof query.type === 'string' ? query.type : '';
    const status = typeof query.status === 'string' ? query.status : '';
    const where = {
      ...(type ? { type: { contains: type } } : {}),
      ...(status ? { status } : {}),
    };
    const [rows, count] = await Promise.all([
      this.prisma.importRecord.findMany({ where, orderBy: { id: 'desc' }, skip: offset, take: limit }),
      this.prisma.importRecord.count({ where }),
    ]);
    const items = rows.map((row) => ({
      id: Number(row.id),
      jobId: Number(row.jobId),
      type: row.type,
      title: row.title,
      fileName: row.fileName,
      total: Number(row.total),
      created: Number(row.created),
      failed: safeParseFailed(row.failed),
      status: row.status,
      createdAt: row.createdAt,
    }));
    return buildPageResult(items, count, page, pageSize);
  }

  /**
   * 提交导入：文件 → 校验 → 入队。
   * @returns 受理信息（任务 id + 总行数预估）
   */
  async submit(
    type: string,
    file: { buffer: Buffer; originalname: string },
    userId: number,
  ): Promise<{ jobId: number; fileName: string }> {
    const registered = this.registry.get(type);
    if (!registered) {
      throw AppException.badRequest(`未知的导入类型：${type}`);
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw AppException.badRequest('文件为空，请先下载模板并填写数据');
    }
    if (file.buffer.length > CSV_IMPORT_MULTER_OPTIONS.limits?.fileSize) {
      throw AppException.badRequest('文件超出大小上限');
    }
    const csvText = file.buffer.toString('utf8').replace(/^\uFEFF/, '');
    // 快速行数预估（不含表头）——超限直接拒，避免超大文件进队列
    const estimated = csvText.split(/\r?\n/).filter((line) => line.trim().length > 0).length - 1;
    if (estimated <= 0) {
      throw AppException.badRequest('文件中没有有效数据行');
    }
    if (estimated > IMPORT_MAX_ROWS) {
      throw AppException.badRequest(`单次导入行数不得超过 ${IMPORT_MAX_ROWS}（当前约 ${estimated} 行）`);
    }
    const job = await this.queue.enqueue({
      type: `import.${type}`,
      title: `导入${registered.title}`,
      payload: { csvText, fileName: file.originalname, userId },
      // 幂等键：同用户同分钟内同内容只入队一次（防连点重复导入）
      idemKey: `import:${type}:${userId}:${hashContent(csvText)}`,
      maxAttempts: 2,
      createdBy: userId,
    });
    return { jobId: job.id, fileName: file.originalname };
  }

  /** 队列执行完成后的收尾：写导入记录 + 通知提交人。 */
  private async finish(jobId: number, type: string, result: ImportExecutionResult): Promise<void> {
    const job = await this.prisma.queueJob.findUnique({ where: { id: BigInt(jobId) } });
    if (!job) {
      return;
    }
    const createdBy = Number(job.createdBy);
    await this.prisma.importRecord.create({
      data: {
        jobId: BigInt(jobId),
        type,
        title: job.title,
        fileName: String(this.safePayload(job.payload).fileName ?? ''),
        total: result.total,
        created: result.created,
        failed: JSON.stringify(result.failed),
        status: result.failed.length === 0 ? 'ok' : 'partial',
      },
    });
    if (createdBy > 0) {
      await this.notice
        .publish({
          title: result.failed.length === 0 ? '导入完成' : '导入完成（存在失败行）',
          content:
            result.failed.length === 0
              ? `「${job.title}」已完成：共 ${result.total} 行，成功 ${result.created} 行。`
              : `「${job.title}」已完成：共 ${result.total} 行，成功 ${result.created} 行，失败 ${result.failed.length} 行（详见导入记录）。`,
          noticeType: result.failed.length === 0 ? NOTICE_TYPE.SYSTEM : NOTICE_TYPE.SECURITY,
          userIds: [createdBy],
          createdBy,
        })
        .catch(() => undefined);
    }
  }

  /** 解析 job payload（坏 JSON 归一为空对象）。 */
  private safePayload(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}

/** 内容摘要（SHA-256 前 16 位）：同内容同用户只入队一次（真幂等，防连点与重复提交）。 */
function hashContent(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** 解析失败报告（坏 JSON 归一为空数组）。 */
function safeParseFailed(raw: string): Array<{ row: number; message: string }> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Array<{ row: number; message: string }>) : [];
  } catch {
    return [];
  }
}
