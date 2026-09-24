/**
 * 日志归档器。
 * 模块职责：扫描「日期 < 今天」的按天日志文件，使用系统 tar 压缩为 `.tar.gz` 归档，幂等。
 *
 * 关键约束（见 docs/system_design.md §3.5 / §4）：
 * - 归档二进制：系统 `tar`（`child_process.execFile` 传参数组，避免 shell 注入），`-czf`；
 *   `TAR_BIN` 环境变量可覆盖可执行文件路径（默认 PATH 中的 `tar`）。
 * - **跨平台路径处理**：以源日志目录为工作目录（`cwd`），归档目标用「相对路径 + 正斜杠」传入。
 *   原因：Windows 绝对路径含盘符冒号（如 `C:\...`），GNU tar（Git Bash）会将其误判为远端主机
 *   （报 `Cannot connect to C: resolve failed`）；而 `--force-local` 又不受 Windows 自带 bsdtar 支持。
 *   改用无冒号的相对路径后，GNU tar 与 bsdtar 均可正常工作。
 * - 归档前先 `closeStream` 释放文件句柄（Windows 下占用会导致失败）。
 * - 仅归档日期严格小于今天的文件（今天正在写的不动）。
 * - 目标 `.tar.gz` 已存在即跳过（幂等，nodemon 频繁重启安全）。
 * - 归档成功后按 `config.log.keepSourceAfterArchive` 决定是否删除源 `.log`（默认删除）。
 * - 归档失败必须捕获并记录，不得抛出，也不得删除源文件。
 */
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { config } from '@/config';
import { LOG_TYPES } from './types';
import type { ArchiveResult, LogType } from './types';
import { archiveLogPath, closeStream, dateKey, dailyLogFileName, getLogDir } from './logManager';

const execFileAsync = promisify(execFile);

/** 匹配按天日志文件名 `YYYY-M-D.log`（月/日不补零）。 */
const LOG_FILE_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})\.log$/;

/** tar 可执行文件路径（来自 config.log.tarBin，可由环境变量 TAR_BIN 覆盖）。 */
function tarBin(): string {
  return config.log.tarBin;
}

/** 将数字补零到两位。 */
function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * 归档单个文件（核心逻辑）。
 * @param type 日志类型
 * @param date 该文件对应日期
 * @param fileName 文件名（如 `2026-9-23.log`）
 * @returns 归档结果（archived / skipped / failed）
 */
async function archiveFile(type: LogType, date: Date, fileName: string): Promise<ArchiveResult> {
  const key = dateKey(date);
  const srcDir = getLogDir(type);
  const srcPath = path.join(srcDir, fileName);
  const dest = archiveLogPath(type, date);
  const destExistedBefore = fs.existsSync(dest);

  try {
    // 幂等：归档已存在则跳过，不覆盖
    if (destExistedBefore) {
      return { type, dateKey: key, status: 'skipped', archivePath: dest, message: '归档已存在，跳过（幂等）' };
    }

    // 源文件不存在则跳过
    if (!fs.existsSync(srcPath)) {
      return { type, dateKey: key, status: 'skipped', message: '源文件不存在' };
    }

    // 归档前释放写入句柄（Windows 下文件被占用会导致 tar 失败）
    await closeStream(type, date);

    // 确保归档目标目录存在
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // 以源目录为工作目录，归档目标用「相对路径 + 正斜杠」传入，避免 Windows 盘符冒号被 tar 误判为远端主机。
    // 默认归档目录位于日志目录之下（同一盘符），相对路径成立；跨盘符（极罕见）时回退为绝对路径。
    const relativeDest = path.relative(srcDir, dest).split(path.sep).join('/');
    const destArg = relativeDest && !path.isAbsolute(relativeDest) ? relativeDest : dest;

    // 用系统 tar 压缩：-czf <dest> <fileName>（传参数组，无 shell 注入）
    await execFileAsync(tarBin(), ['-czf', destArg, fileName], { cwd: srcDir, windowsHide: true });

    // 归档成功后按配置删除源文件（默认删除）
    if (!config.log.keepSourceAfterArchive) {
      fs.unlinkSync(srcPath);
    }

    return { type, dateKey: key, status: 'archived', archivePath: dest };
  } catch (error) {
    // 归档失败：记录并清理可能产生的半成品归档，保证下次可重试；绝不删除源文件
    if (!destExistedBefore) {
      try {
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
      } catch (cleanupError) {
        console.error(`[Archiver] 清理半成品归档失败 ${dest}:`, cleanupError);
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Archiver] 归档失败 ${type} ${key}:`, error);
    return { type, dateKey: key, status: 'failed', archivePath: dest, message };
  }
}

/**
 * 归档所有「日期 < 今天」的日志文件（启动补跑 + 每日定时共用）。
 * 扫描每种类型的目录，仅处理日期键严格小于今天的文件；今天正在写的不动。
 * @returns 每个待归档文件的结果列表（跳过/成功/失败）
 */
export async function archivePastLogs(): Promise<ArchiveResult[]> {
  const todayKey = dateKey(new Date());
  const results: ArchiveResult[] = [];

  for (const type of LOG_TYPES) {
    let fileNames: string[];
    try {
      fileNames = fs.readdirSync(getLogDir(type));
    } catch (error) {
      // 目录不存在等异常：跳过该类型，不影响其它类型
      console.error(`[Archiver] 读取日志目录失败 ${type}:`, error);
      continue;
    }

    for (const fileName of fileNames) {
      const match = LOG_FILE_RE.exec(fileName);
      if (!match) {
        continue;
      }
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      // 内部规范键（补零），用于与 todayKey 做字符串比较（同格式定长，安全）
      const fileKey = `${year}-${pad2(month)}-${pad2(day)}`;
      if (fileKey >= todayKey) {
        continue; // 今天及未来：不动
      }
      const date = new Date(year, month - 1, day);
      results.push(await archiveFile(type, date, fileName));
    }
  }

  return results;
}

/**
 * 归档指定日期的日志（供测试 / 手动触发）。
 * @param date 目标日期（按本地时区解析为该日的日志文件）
 * @returns 各类型的归档结果列表
 */
export async function archiveForDate(date: Date): Promise<ArchiveResult[]> {
  const key = dateKey(date);
  const fileName = dailyLogFileName(date);
  const results: ArchiveResult[] = [];

  for (const type of LOG_TYPES) {
    const srcPath = path.join(getLogDir(type), fileName);
    if (!fs.existsSync(srcPath)) {
      results.push({ type, dateKey: key, status: 'skipped', message: '源文件不存在' });
      continue;
    }
    results.push(await archiveFile(type, date, fileName));
  }

  return results;
}
