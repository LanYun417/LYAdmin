/**
 * 分片上传 / 合并 / 秒传 / 续传 / Range 下载 e2e（真实 MySQL + Redis）。
 *
 * 覆盖：
 * 1. 三片上传 → 状态查询 → 合并 → 落库（大小 / 哈希 / 磁盘文件逐项核对）；
 * 2. 秒传：同内容换标识再传再合，复用既有记录（deduplicated），不产生新物理文件；
 * 3. 断点续传：缺片时查询状态只返回已收序号，补齐后合并成功；
 * 4. 缺片合并 → 400；totalSize 虚报 → 400 且不落库；
 * 5. 取消上传：分片目录清空；
 * 6. Range 下载：206 + Content-Range + 精确字节数（分片下载的前置能力）。
 */
import { createHash, randomBytes } from 'node:crypto';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { RedisService } from '../src/common/redis/redis.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { resolveSeedAdminPassword } from '../src/prisma/seed.service.js';
import { createTestApp } from './setup-app.js';
import { config } from '../src/common/config/config.js';

const API = '/api';
const CAPTCHA_KEY_PREFIX = 'auth:captcha:';

/** PNG 幻数（幻数校验只比前 16 字节，真图与「图头 + 随机数据」等价）。 */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** 测试文件：16MB，按 5MB 切 = 4 片（5+5+5+1），内容全随机避免与库内文件撞哈希。 */
const FILE_SIZE = 16 * 1024 * 1024;
const FILE_CONTENT = Buffer.concat([PNG_MAGIC, randomBytes(FILE_SIZE - PNG_MAGIC.length)]);
const FILE_HASH = createHash('sha256').update(FILE_CONTENT).digest('hex');
const FILE_NAME = 'e2e-chunked-file.png';
const FILE_MIME = 'image/png';
/** 总片数（按后端 chunkSize 向上取整，与前端切片逻辑同口径）。 */
const TOTAL_CHUNKS = Math.ceil(FILE_SIZE / config.upload.chunkSize);

/** 分片大小（与后端 config.upload.chunkSize 一致，末片取余数）。 */
function chunkAt(index: number): Buffer {
  const size = config.upload.chunkSize;
  const start = index * size;
  return FILE_CONTENT.subarray(start, Math.min(start + size, FILE_CONTENT.length));
}

/** 文件记录（合并返回）。 */
interface MergedFile {
  id: number;
  originName: string;
  fileName: string;
  filePath: string;
  size: number;
  hash: string | null;
  deduplicated?: boolean;
}

describe('分片上传与 Range 下载 (e2e)', () => {
  let app: NestExpressApplication;
  let redis: RedisService;
  let prisma: PrismaService;
  let token: string;
  /** 本用例创建的记录，afterAll 统一清库清盘。 */
  const createdFileIds = new Set<number>();

  /** 登录（验证码答案从 Redis 取，与 contract e2e 同构）。 */
  async function login(): Promise<string> {
    const captcha = await request(app.getHttpServer()).get(`${API}/auth/captcha`).expect(200);
    const { enabled, captchaId } = captcha.body.data as { enabled: boolean; captchaId: string | null };
    let captchaCode = '';
    if (enabled && captchaId) {
      captchaCode = (await redis.get(`${CAPTCHA_KEY_PREFIX}${captchaId}`)) ?? '';
    }
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ username: 'admin', password: resolveSeedAdminPassword(), captchaId, captchaCode })
      .expect(200);
    return (login.body.data as { accessToken: string }).accessToken;
  }

  /** 上传一片（multipart：文件字段 file + 元信息字段）。返回 Test 供调用方 .expect。 */
  function uploadChunk(
    identifier: string,
    index: number,
    totalChunks: number,
    body = chunkAt(index),
    totalSize = FILE_SIZE,
  ): request.Test {
    return request(app.getHttpServer())
      .post(`${API}/files/chunk`)
      .set('authorization', `Bearer ${token}`)
      .field('identifier', identifier)
      .field('chunkIndex', String(index))
      .field('totalChunks', String(totalChunks))
      .field('filename', FILE_NAME)
      .field('totalSize', String(totalSize))
      .attach('file', body, { filename: 'blob' });
  }

  /** 查询已上传分片序号。 */
  async function chunkStatus(identifier: string): Promise<number[]> {
    const response = await request(app.getHttpServer())
      .get(`${API}/files/chunk/status`)
      .set('authorization', `Bearer ${token}`)
      .query({ identifier })
      .expect(200);
    return (response.body.data as { uploaded: number[] }).uploaded;
  }

  /** 合并（成功返回记录；失败返回响应供断言）。返回 Test 供调用方 .expect。 */
  function mergeChunks(identifier: string, totalChunks = TOTAL_CHUNKS, totalSize = FILE_SIZE): request.Test {
    return request(app.getHttpServer())
      .post(`${API}/files/chunk/merge`)
      .set('authorization', `Bearer ${token}`)
      .send({ identifier, totalChunks, filename: FILE_NAME, totalSize, mimeType: FILE_MIME });
  }

  beforeAll(async () => {
    app = await createTestApp();
    redis = app.get(RedisService);
    prisma = app.get(PrismaService);
    token = await login();
  });

  afterAll(async () => {
    // 清库 + 清盘：测试文件不进正式环境的数据集
    for (const id of createdFileIds) {
      const row = await prisma.file.findUnique({ where: { id: BigInt(id) } });
      if (row) {
        await fsp.rm(path.join(config.upload.dir, row.fileName), { force: true }).catch(() => undefined);
        await prisma.file.delete({ where: { id: BigInt(id) } }).catch(() => undefined);
      }
    }
    await fsp.rm(config.upload.chunkDir, { recursive: true, force: true }).catch(() => undefined);
    await app?.close();
  });

  it('分片上传 → 状态齐全 → 合并落库（大小 / 哈希 / 磁盘核对）', async () => {
    const identifier = 'e2e-chunk-flow-a1b2c3d4';
    for (let index = 0; index < TOTAL_CHUNKS; index += 1) {
      await uploadChunk(identifier, index, TOTAL_CHUNKS).expect(200);
    }

    expect(await chunkStatus(identifier)).toEqual([0, 1, 2, 3]);

    const response = await mergeChunks(identifier).expect(200);
    const file = response.body.data as MergedFile;
    createdFileIds.add(file.id);

    expect(file.originName).toBe(FILE_NAME);
    expect(file.size).toBe(FILE_SIZE);
    expect(file.hash).toBe(FILE_HASH);
    expect(file.deduplicated).toBeFalsy();

    // 磁盘文件与库记录一一对应（fileName = 分组相对路径；filePath 已含 uploads/ 前缀）
    const onDisk = await fsp.readFile(path.join(config.upload.dir, file.fileName));
    expect(onDisk.length).toBe(FILE_SIZE);
    expect(createHash('sha256').update(onDisk).digest('hex')).toBe(FILE_HASH);

    // 合并成功即清理分片目录
    expect(await chunkStatus(identifier)).toEqual([]);
  });

  it('秒传：同内容换标识重传，复用既有记录不产生新物理文件', async () => {
    const identifier = 'e2e-chunk-flow-e5f6a7b8';
    const before = await prisma.file.count({ where: { hash: FILE_HASH } });
    const beforePath = (await prisma.file.findFirstOrThrow({ where: { hash: FILE_HASH }, orderBy: { id: 'asc' } }))
      .fileName;

    for (let index = 0; index < TOTAL_CHUNKS; index += 1) {
      await uploadChunk(identifier, index, TOTAL_CHUNKS).expect(200);
    }

    const response = await mergeChunks(identifier).expect(200);
    const file = response.body.data as MergedFile;
    createdFileIds.add(file.id);

    expect(file.deduplicated).toBe(true);
    expect(file.hash).toBe(FILE_HASH);
    // 记录数与物理文件都不增长
    expect(await prisma.file.count({ where: { hash: FILE_HASH } })).toBe(before);
    expect(file.fileName).toBe(beforePath);
  });

  it('断点续传：缺片时状态只返回已收序号，补齐后合并成功', async () => {
    const identifier = 'e2e-chunk-flow-c9d0e1f2';
    // 只传第 0、2 片，模拟「传到一半断了」
    await uploadChunk(identifier, 0, TOTAL_CHUNKS).expect(200);
    await uploadChunk(identifier, 2, TOTAL_CHUNKS).expect(200);
    expect(await chunkStatus(identifier)).toEqual([0, 2]);

    // 缺片合并 → 400，且不落任何记录
    const missing = await mergeChunks(identifier);
    expect(missing.status).toBe(400);
    expect(await prisma.file.count({ where: { hash: FILE_HASH } })).toBe(1);

    // 续传补齐第 1 片 → 合并成功
    await uploadChunk(identifier, 1, TOTAL_CHUNKS).expect(200);
    await uploadChunk(identifier, 3, TOTAL_CHUNKS).expect(200);
    expect(await chunkStatus(identifier)).toEqual([0, 1, 2, 3]);
    const response = await mergeChunks(identifier).expect(200);
    createdFileIds.add((response.body.data as MergedFile).id);
  });

  it('totalSize 虚报 → 400 且不留记录与分片残留', async () => {
    const identifier = 'e2e-chunk-flow-a3b4c5d6';
    for (let index = 0; index < TOTAL_CHUNKS; index += 1) {
      await uploadChunk(identifier, index, TOTAL_CHUNKS).expect(200);
    }

    // 少报 1 字节：合并时大小核对必须抓住
    const response = await mergeChunks(identifier, 3, FILE_SIZE - 1);
    expect(response.status).toBe(400);
    expect(await prisma.file.count({ where: { hash: FILE_HASH } })).toBe(1);
    // 合并失败保留分片，客户端可修参重试
    expect(await chunkStatus(identifier)).toEqual([0, 1, 2, 3]);

    // 清理现场
    await request(app.getHttpServer())
      .delete(`${API}/files/chunk`)
      .set('authorization', `Bearer ${token}`)
      .query({ identifier })
      .expect(200);
    expect(await chunkStatus(identifier)).toEqual([]);
  });

  it('Range 下载：206 + Content-Range + 精确字节数', async () => {
    const exist = await prisma.file.findFirstOrThrow({ where: { hash: FILE_HASH }, orderBy: { id: 'asc' } });
    const fileId = Number(exist.id);

    const ranged = await request(app.getHttpServer())
      .get(`${API}/files/${fileId}/download`)
      .set('authorization', `Bearer ${token}`)
      .set('Range', 'bytes=0-1023')
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(ranged.status).toBe(206);
    expect(ranged.headers['content-range']).toBe(`bytes 0-1023/${FILE_SIZE}`);
    expect(ranged.body.length).toBe(1024);
    // 内容确实从文件头开始（分片下载拼装的正确性依据）
    expect(ranged.body.subarray(0, 8)).toEqual(PNG_MAGIC);
  });
});
