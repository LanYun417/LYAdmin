/**
 * IP 规则匹配工具（零依赖）。
 * 模块职责：判断一个客户端 IP 是否命中「精确 IP / CIDR 段」规则。
 *
 * 口径：
 * - 仅支持 IPv4（后台管理系统当前部署以 IPv4 为主；IPv6 规则存得下但匹配时跳过，
 *   避免把写法相近的地址误判成命中——宁可漏封也不错封）；
 * - `::ffff:10.0.0.1` 这类 IPv4-mapped 形式先归一成点分十进制再比较
 *   （trust proxy 下 req.ip 可能是这种形式）；
 * - 非法规则写法一律返回 false，绝不让一条写错的规则变成「封禁所有人」。
 */
import { isIP } from 'node:net';

/** 把 IPv4-mapped IPv6 地址归一为 IPv4；非该形式原样返回。 */
function normalize(ip: string): string {
  const lower = ip.trim().toLowerCase();
  return lower.startsWith('::ffff:') ? lower.slice(7) : lower;
}

/** IPv4 点分十进制 → 32 位无符号整数；非法返回 null。 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    // 拒绝空段、前导零（避免 "010" 被误当十进制 10）、非数字与越界
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      return null;
    }
    const octet = Number(part);
    if (octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/**
 * 判断 IP 是否命中一条规则。
 * @param ip 客户端 IP
 * @param rule 精确 IP（如 192.168.1.10）或 CIDR（如 10.0.0.0/8）
 */
export function matchIpRule(ip: string, rule: string): boolean {
  const client = normalize(ip);
  const pattern = rule.trim();
  if (!client || !pattern) {
    return false;
  }

  if (!pattern.includes('/')) {
    // 精确 IP：两边都必须是 IPv4，且字节相等
    if (isIP(client) !== 4 || isIP(pattern) !== 4) {
      return false;
    }
    return client === pattern;
  }

  const [base, bitsRaw] = pattern.split('/');
  if (!base || bitsRaw === undefined || isIP(base) !== 4) {
    return false;
  }
  if (!/^\d{1,2}$/.test(bitsRaw)) {
    return false;
  }
  const bits = Number(bitsRaw);
  if (bits < 0 || bits > 32) {
    return false;
  }
  const clientInt = ipv4ToInt(client);
  const baseInt = ipv4ToInt(base);
  if (clientInt === null || baseInt === null) {
    return false;
  }
  // 全 0 掩码时移位会退化为「移 32 位 = 不移」，需特殊处理：/0 匹配所有 IPv4。
  if (bits === 0) {
    return true;
  }
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (clientInt & mask) === (baseInt & mask);
}

/** 校验规则写法是否合法（供 DTO 之外在服务层再兜一道，防止写进库却永远不生效的规则）。 */
export function isValidIpRule(pattern: string): boolean {
  const value = pattern.trim();
  if (!value || value.length > 100) {
    return false;
  }
  if (!value.includes('/')) {
    return isIP(value) === 4;
  }
  const [base, bitsRaw] = value.split('/');
  if (!base || bitsRaw === undefined || isIP(base) !== 4 || !/^\d{1,2}$/.test(bitsRaw)) {
    return false;
  }
  const bits = Number(bitsRaw);
  return bits >= 0 && bits <= 32;
}
