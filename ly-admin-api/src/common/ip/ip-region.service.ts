/**
 * IP 归属地解析服务（ip2region 离线库）。
 * 模块职责：把客户端 IP 解析为「国家 省份 城市 运营商」文本，供登录 / 操作 / 访问日志落库展示。
 *
 * 设计取舍：
 * - 离线优先：全程不访问外网。IP 库为本地 xdb 文件（约 10MB，`npm run ip2region:update` 更新），
 *   启动时一次性读入内存做全量缓存，查询纯内存完成（微秒级），无文件 IO 压力；
 * - 只支持 IPv4：后台管理系统面向办公 / 家庭网络，IPv6 直连罕见。
 *   IPv4-mapped IPv6（`::ffff:x.x.x.x`，Windows 常见回环形态）先归一化再解析，其余 IPv6 静默跳过；
 * - 全链路容错：数据文件缺失 / 损坏 / IP 非法均降级，**绝不影响业务响应与日志写入**；
 * - 结果缓存：日志场景同一 IP 会反复出现（批量操作、健康检查、爬虫重试），
 *   Map 缓存上限 1 万条、超出整体清空——日志场景命中率随时间快速趋近 100%，简单策略足够。
 */
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { IPv4, loadContentFromFile, newWithBuffer, type Searcher } from 'ip2region.js';
import { config } from '../config/config.js';

/** 归属地落库上限（与 log.prisma 三张表的 VarChar(100) 对齐）。 */
const LOCATION_MAX_LENGTH = 100;

/** 缓存上限（条），超出整体清空。 */
const CACHE_LIMIT = 10_000;

@Injectable()
export class IpRegionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IpRegionService.name);
  private searcher: Searcher | null = null;
  /** IP → 归属地缓存（含空串结果：无效 IP 不反复解析）。 */
  private readonly cache = new Map<string, string>();

  async onModuleInit(): Promise<void> {
    try {
      // 全量内容缓存：一次读入 10MB，此后查询零 IO；buffer 型 searcher 可并发安全使用
      this.searcher = newWithBuffer(IPv4, loadContentFromFile(config.ip2region.dbPath));
      this.logger.log(`ip2region 数据加载完成：${config.ip2region.dbPath}`);
    } catch (error) {
      // 文件缺失 / 损坏：禁用归属地解析而非阻断启动（日志功能降级，核心业务不受影响）
      this.searcher = null;
      this.logger.warn(
        `ip2region 数据加载失败，IP 归属地解析已禁用（执行 npm run ip2region:update 可修复）：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  onModuleDestroy(): void {
    this.searcher?.close();
    this.searcher = null;
    this.cache.clear();
  }

  /**
   * 解析 IP 归属地。
   * @param ip 客户端 IP（IPv4，或 IPv4-mapped IPv6）
   * @returns 「国家 省份 城市 运营商」文本（如 `中国 广东省 潮州市 移动`）；
   *          内网 / 保留地址返回 `内网`，无法解析时返回空串。
   */
  async locate(ip: string | null | undefined): Promise<string> {
    const normalized = normalizeIp(ip);
    if (normalized === null || this.searcher === null) {
      return '';
    }

    const cached = this.cache.get(normalized);
    if (cached !== undefined) {
      return cached;
    }

    let location = '';
    try {
      // 包的 .d.ts 标注 search 同步返回 string，实际实现为 async；Promise.resolve 对两种形态均成立
      const raw = await Promise.resolve(this.searcher.search(normalized));
      location = formatRegion(raw);
    } catch {
      // 非法 IP / 数据异常：视为无归属地
    }

    if (this.cache.size >= CACHE_LIMIT) {
      this.cache.clear();
    }
    this.cache.set(normalized, location);
    return location;
  }
}

/**
 * 规范化 IP：仅接受 IPv4；IPv4-mapped IPv6（`::ffff:1.2.3.4`）剥离前缀后按 IPv4 处理，
 * 其余 IPv6 / 非法输入返回 null（放弃解析）。
 */
function normalizeIp(ip: string | null | undefined): string | null {
  if (typeof ip !== 'string') {
    return null;
  }
  let text = ip.trim();
  if (text.length === 0) {
    return null;
  }
  if (text.includes(':')) {
    const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(text);
    if (mapped === null) {
      return null;
    }
    text = mapped[1];
  }
  const parts = text.split('.');
  if (parts.length !== 4) {
    return null;
  }
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) {
      return null;
    }
  }
  return text;
}

/**
 * 格式化 xdb 原始区域串。
 * 数据形如 `中国|广东省|潮州市|移动|CN`（`|` 分隔，0 / 空为占位，末段为 ISO 国家码），
 * 过滤占位段与国家码后以空格连接：`中国 广东省 潮州市 移动`。
 * 内网 / 保留地址原始数据为 `Reserved|Reserved|Reserved|0|0`，统一展示为 `内网`。
 */
function formatRegion(raw: string): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    return '';
  }
  const segments = raw
    .split('|')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '0');
  if (segments.length === 0) {
    return '';
  }
  if (segments.every((segment) => segment === 'Reserved')) {
    return '内网';
  }
  // 末段为两位大写 ISO 国家码（CN / US / AU…）时剔除，避免与段首国家名重复
  if (segments.length >= 2 && /^[A-Z]{2}$/.test(segments[segments.length - 1])) {
    segments.pop();
  }
  return segments.join(' ').slice(0, LOCATION_MAX_LENGTH);
}
