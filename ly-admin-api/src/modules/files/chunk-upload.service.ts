/**
 * 分片上传服务。
 * 模块职责：分片暂存、断点续传状态、合并（流式拼合 + 流式哈希 + 大小核对）、
 * 取消与过期清理（sweep，由定时任务调度，不在此处自带定时器）。
 *
 * 关键决策：
 * - 暂存目录 `cache/chunks/<identifier>/`，刻意在 uploads/ **之外**——分片是半成品，
 *   绝不能被 /static 公开访问；
 * - 单片经 multer memoryStorage 进入内存（几 MB 级），由本服务负责落盘与合并，
 *   避免 diskStorage 的扩展名分组逻辑（分片本身没有目标扩展名，分组按
 *   DTO 里的 filename 在合并时做）；
 * - 合并时**流式**计算 SHA-256：大文件也不会打满内存，哈希与拼盘一次完成；
 * - 秒传发生在合并之后（服务端全量哈希）：客户端「采样哈希」只是暂存目录名，
 *   不能替代全量哈希做秒传预检——这是与直传 `check` 预检有意的取舍，
 *   换来的是「10GB 文件上传前不必先算 10GB 哈希」；
 * - 同标识合并加进程内锁：并发双合并时第二个请求拿到 400，而不是把文件合两遍。
 */
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import type { Dirent } from 'node:fs';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { AppException } from '../../common/exception/app.exception.js';
import { config } from '../../common/config/config.js';
import { UPLOAD_ALLOWED_EXT } from '../../common/config/constants.js';
import { extensionFolder, storageRelativePath } from '../../common/file/storage-layout.js';
import { FilesService, type FileItem } from './files.service.js';

/** 上传标识（客户端采样哈希）：限长 + 安全字符集，同时防目录穿越。 */
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{16,128}$/;

@Injectable()
export class ChunkUploadService implements OnModuleInit {
  private readonly logger = new Logger(ChunkUploadService.name);

  /**
   * 同标识合并锁（进行中的合并 → 其 Promise）。
   * 第二个同标识请求等它结束后直接抛 400：锁定期间分片目录随时可能被第一个
   * 请求清理掉，让后来者重扫一遍比放它进去把文件合两遍更安全。
   */
  private readonly mergeLocks = new Map<string, Promise<FileItem>>();

  constructor(private readonly filesService: FilesService) {}

  /** 启动即清理过期分片（补跑语义与任务模块一致：新任务的首次成功记录为空）。 */
  async onModuleInit(): Promise<void> {
    const result = await this.sweep();
    if (result.removed > 0) {
      this.logger.log(`[ChunkUpload] 启动清理过期分片目录 ${result.removed} 个，释放 ${result.freedBytes} 字节`);
    }
  }

  /**
   * 保存单个分片（内存 → 分片目录）。
   * @param file multer 解析出的分片（memoryStorage）
   * @param input 分片元信息（标识 / 序号 / 总数 / 目标文件名 / 总大小）
   * @returns 已收到的序号 + 当前全部已收序号（客户端可不另查状态）
   */
  async saveChunk(
    file: Express.Multer.File | undefined,
    input: { identifier: string; chunkIndex: number; totalChunks: number; filename: string },
  ): Promise<{ received: number; uploaded: number[] }> {
    const { identifier, chunkIndex, totalChunks, filename } = input;
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      throw AppException.badRequest('上传标识非法');
    }
    if (!file?.buffer?.length) {
      throw AppException.badRequest('未接收到分片文件');
    }
    if (chunkIndex >= totalChunks) {
      throw AppException.badRequest('分片序号超出分片总数');
    }
    // 目标文件扩展名先校验（与直传同白名单），失败不落盘。
    // MIME 在合并时校验（分片请求不带目标 MIME，直传的 mimetype 由浏览器提供）。
    const ext = path.extname(filename).toLowerCase();
    if (!UPLOAD_ALLOWED_EXT.includes(ext)) {
      throw AppException.badRequest(`不支持的文件类型: ${ext || '未知'}`);
    }

    const dir = this.chunkDir(identifier);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(this.chunkPath(dir, chunkIndex), file.buffer);
    return { received: chunkIndex, uploaded: await this.scanIndexes(dir) };
  }

  /**
   * 查询已上传分片序号（断点续传的依据）。
   * 标识从未用过 / 已被合并清理时返回空数组——客户端据此从 0 开始重传。
   */
  async status(identifier: string): Promise<{ uploaded: number[] }> {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      throw AppException.badRequest('上传标识非法');
    }
    return { uploaded: await this.scanIndexes(this.chunkDir(identifier)) };
  }

  /**
   * 合并分片：拼合 → 大小核对 → 流式哈希 → 秒传去重 → 落库。
   * 成功或秒传命中后清理整个分片目录；失败保留分片，客户端可修完再合并。
   */
  async merge(
    input: { identifier: string; totalChunks: number; filename: string; totalSize: number; mimeType?: string },
    uploaderId: number | null,
    biz: { bizType?: string; bizId?: number } = {},
  ): Promise<FileItem> {
    const { identifier } = input;
    const inflight = this.mergeLocks.get(identifier);
    if (inflight) {
      // 等前一次合并落地（含其清理）再拒绝，避免两个请求同时读同一批分片
      await inflight.catch(() => undefined);
      throw AppException.badRequest('合并已在进行中或已完成，请勿重复提交');
    }
    const task = this.doMerge(input, uploaderId, biz).finally(() => {
      this.mergeLocks.delete(identifier);
    });
    this.mergeLocks.set(identifier, task);
    return task;
  }

  /** 取消上传：清理该标识的全部分片（幂等，目录不存在也返回成功）。 */
  async cancel(identifier: string): Promise<void> {
    if (!IDENTIFIER_PATTERN.test(identifier)) {
      throw AppException.badRequest('上传标识非法');
    }
    await fsp.rm(this.chunkDir(identifier), { recursive: true, force: true });
  }

  /**
   * 清理过期分片目录（mtime 超过 TTL 视为废弃）。
   * 供定时任务调度（task.registry 的 chunk-cache-sweep）与启动补跑调用；
   * TTL 配 0 表示不按时间清理，直接跳过。
   */
  async sweep(): Promise<{ removed: number; freedBytes: number }> {
    const ttlMs = config.upload.chunkTtlHours * 60 * 60 * 1000;
    if (ttlMs <= 0) {
      return { removed: 0, freedBytes: 0 };
    }
    const result = { removed: 0, freedBytes: 0 };
    let entries: Dirent[];
    try {
      entries = await fsp.readdir(config.upload.chunkDir, { withFileTypes: true });
    } catch {
      // 目录不存在（从未分片上传过）：无需清理
      return result;
    }
    const now = Date.now();
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const dir = path.join(config.upload.chunkDir, entry.name);
      try {
        const stats = await fsp.stat(dir);
        // 目录 mtime 由「最后一次写入 / 删除条目」刷新，续传中的目录不会被误清
        if (now - stats.mtimeMs <= ttlMs) {
          continue;
        }
        result.freedBytes += await this.dirSize(dir);
        await fsp.rm(dir, { recursive: true, force: true });
        result.removed += 1;
      } catch (error) {
        // 单个目录失败（占用 / 权限）不影响整体清理
        this.logger.warn(
          `[ChunkUpload] 清理分片目录失败 ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return result;
  }

  /** 合并主流程（锁由 merge 控制，这里假定已拿到执行权）。 */
  private async doMerge(
    input: { identifier: string; totalChunks: number; filename: string; totalSize: number; mimeType?: string },
    uploaderId: number | null,
    biz: { bizType?: string; bizId?: number },
  ): Promise<FileItem> {
    const { identifier, totalChunks, filename, totalSize } = input;
    const dir = this.chunkDir(identifier);

    // 完整性：序号必须恰好 0..totalChunks-1 全覆盖（重传统战场景靠 status 对齐）
    const uploaded = await this.scanIndexes(dir);
    if (uploaded.length !== totalChunks) {
      const missing = Array.from({ length: totalChunks }, (_, i) => i).filter((i) => !uploaded.includes(i));
      throw AppException.badRequest(
        `分片不完整：已收 ${uploaded.length}/${totalChunks}，缺少第 ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' 等' : ''} 片`,
      );
    }

    // 流式拼合 + 流式哈希：按序号从小到大读，边写边算，内存占用恒定
    const mergedPath = path.join(dir, 'merged.part');
    const hash = createHash('sha256');
    let written = 0;
    const out = createWriteStream(mergedPath);
    try {
      for (let index = 0; index < totalChunks; index += 1) {
        const stream = createReadStream(this.chunkPath(dir, index));
        for await (const chunk of stream) {
          hash.update(chunk);
          written += chunk.length;
          out.write(chunk);
        }
      }
      await new Promise<void>((resolve, reject) => {
        out.on('error', reject);
        out.end(() => resolve());
      });
    } catch (error) {
      out.destroy();
      await fsp.rm(mergedPath, { force: true });
      throw AppException.serviceUnavailable(`合并分片失败: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 大小核对：防缺片伪装、防客户端改 totalSize
    if (written !== totalSize) {
      await fsp.rm(mergedPath, { force: true });
      throw AppException.badRequest(`文件大小不符：应收 ${totalSize} 字节，实收 ${written} 字节`);
    }

    // 移入正式目录（与直传同一布局：uploads/<扩展名分组>/<时间戳_随机><ext>）
    const ext = path.extname(filename).toLowerCase();
    const destDir = path.join(config.upload.dir, extensionFolder(ext));
    await fsp.mkdir(destDir, { recursive: true });
    const destPath = path.join(destDir, `${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`);
    try {
      await fsp.rename(mergedPath, destPath);
    } catch {
      // 跨设备 rename 失败（极少见：tmp 与 uploads 不在同一文件系统）：退回复制
      await fsp.copyFile(mergedPath, destPath);
      await fsp.rm(mergedPath, { force: true });
    }

    // 委托 FilesService：类型/MIME/幻数校验 → 秒传去重 → 配额预检 → 落库。
    // 任何一步失败它会自行清理 destPath，分片目录留给下面统一清。
    const item = await this.filesService.adoptMergedFile(
      {
        absPath: destPath,
        relPath: storageRelativePath(ext, path.basename(destPath)),
        originName: filename,
        mimeType: input.mimeType ?? '',
        size: totalSize,
        hash: hash.digest('hex'),
      },
      uploaderId,
      biz,
    );

    // 成功（含秒传命中）即清分片：目录留着只会被 sweep 二次处理
    await fsp.rm(dir, { recursive: true, force: true });
    this.logger.log(
      `[ChunkUpload] 合并完成：${filename}（${totalChunks} 片 / ${totalSize} 字节${item.deduplicated ? '，秒传命中' : ''}）`,
    );
    return item;
  }

  /** 分片目录：cache/chunks/<identifier>。 */
  private chunkDir(identifier: string): string {
    return path.join(config.upload.chunkDir, identifier);
  }

  /** 分片文件路径：chunk-<8 位序号>.part（定宽保证字典序 = 序号序）。 */
  private chunkPath(dir: string, index: number): string {
    return path.join(dir, `chunk-${index.toString().padStart(8, '0')}.part`);
  }

  /** 扫描目录内已收分片序号（升序）。目录不存在返回空数组。 */
  private async scanIndexes(dir: string): Promise<number[]> {
    let files: string[];
    try {
      files = await fsp.readdir(dir);
    } catch {
      return [];
    }
    const indexes: number[] = [];
    for (const name of files) {
      const matched = /^chunk-(\d{8})\.part$/.exec(name);
      if (matched) {
        indexes.push(Number(matched[1]));
      }
    }
    return indexes.sort((left, right) => left - right);
  }

  /** 目录体积（字节）：单个文件失败按 0 计，清理统计不必精确。 */
  private async dirSize(dir: string): Promise<number> {
    const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
    let total = 0;
    for (const entry of entries) {
      if (entry.isFile()) {
        const stats = await fsp.stat(path.join(dir, entry.name)).catch(() => null);
        total += stats?.size ?? 0;
      }
    }
    return total;
  }
}
