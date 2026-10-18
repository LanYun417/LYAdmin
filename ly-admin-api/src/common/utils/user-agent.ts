/**
 * User-Agent 轻量解析（零第三方依赖）。
 *
 * 模块职责：把原始 User-Agent 串解析成「浏览器名称 + 主版本」与「操作系统名称 + 版本」。
 * 设计取舍：运营后台只需「看个大概」的可读标签，纯正则 + 结果缓存，微秒级开销。
 */
/** UA 解析结果：`null` 表示该维度未能识别。 */
export interface UserAgentInfo {
  /** 浏览器（含主版本），如 `Chrome 130` */
  browser: string | null;
  /** 操作系统（含版本），如 `Windows 10+` / `iOS 16.6` */
  os: string | null;
}

/** 未识别时的空结果（复用同一对象，避免重复分配）。 */
const UNKNOWN: UserAgentInfo = { browser: null, os: null };

/** 缓存上限，防止海量不同 UA 撑爆内存（简单 FIFO 淘汰）。 */
const CACHE_LIMIT = 1000;

/** UA 解析结果缓存：UA 串 → 结果。 */
const cache = new Map<string, UserAgentInfo>();

/** 浏览器匹配规则：**顺序敏感** —— 必须先匹配"套壳/衍生"浏览器，再匹配底层内核。 */
const BROWSER_RULES: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: 'Edge', pattern: /(?:Edg|EdgA|EdgiOS|Edge)\/([\d.]+)/ },
  { name: 'Opera', pattern: /(?:OPR|OPiOS|Opera)\/([\d.]+)/ },
  { name: 'QQ浏览器', pattern: /(?:QQBrowser|MQQBrowser)\/([\d.]+)/ },
  { name: 'UC浏览器', pattern: /UCBrowser\/([\d.]+)/ },
  { name: '微信内置浏览器', pattern: /MicroMessenger\/([\d.]+)/ },
  { name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/([\d.]+)/ },
  { name: 'Chrome', pattern: /(?:Chrome|CriOS)\/([\d.]+)/ },
  { name: 'Safari', pattern: /Version\/([\d.]+)(?: Mobile\S*)? Safari\// },
  { name: 'IE', pattern: /MSIE ([\d.]+)/ },
  { name: 'IE', pattern: /Trident\/[\d.]+.*?rv:([\d.]+)/ },
] as const;

/** 操作系统匹配规则：顺序敏感（移动端/派生内核优先于通用平台）。 */
const OS_RULES: ReadonlyArray<{ name: string; pattern: RegExp; majorOnly?: boolean }> = [
  { name: 'iOS', pattern: /(?:iPhone|iPad|iPod).*? OS ([\d_]+)/ },
  { name: 'Android', pattern: /Android ([\d.]+)/, majorOnly: true },
  { name: 'macOS', pattern: /Mac OS X ([\d_.]+)/ },
  { name: 'Windows', pattern: /Windows NT 10\.0/ },
  { name: 'Windows', pattern: /Windows NT 6\.3/ },
  { name: 'Windows', pattern: /Windows NT 6\.2/ },
  { name: 'Windows', pattern: /Windows NT 6\.1/ },
  { name: 'Linux', pattern: /(?:Linux|X11)(?!.*Android)/ },
] as const;

/** Windows NT 版本号 → 展示名（`10.0` 无法区分 Win10/Win11，统一展示 `10+`）。 */
const WINDOWS_LABELS: Record<string, string> = {
  'Windows NT 10.0': 'Windows 10+',
  'Windows NT 6.3': 'Windows 8.1',
  'Windows NT 6.2': 'Windows 8',
  'Windows NT 6.1': 'Windows 7',
};

/** 取版本号的主版本段（如 `130.0.6723.116` → `130`）。 */
function majorOf(raw: string): string {
  return raw.split('.')[0] || '';
}

/** 把 `10_15_7` / `16_6` 这类 UA 写法还原成点分版本号，并去掉无意义的 `.0` 尾巴。 */
function normalizeRawVersion(raw: string, majorOnly?: boolean): string {
  const dotted = raw.replace(/_/g, '.');
  if (majorOnly) {
    return majorOf(dotted);
  }
  return dotted.replace(/(\.0)+$/, '');
}

/** 匹配浏览器（返回可读名称 + 主版本）。 */
function matchBrowser(ua: string): string | null {
  for (const rule of BROWSER_RULES) {
    const hit = rule.pattern.exec(ua);
    if (hit?.[1]) {
      const version = majorOf(normalizeRawVersion(hit[1]));
      return version ? `${rule.name} ${version}` : rule.name;
    }
  }
  return null;
}

/** 匹配操作系统（返回可读名称 + 版本）。 */
function matchOs(ua: string): string | null {
  for (const rule of OS_RULES) {
    const hit = rule.pattern.exec(ua);
    if (!hit) {
      continue;
    }
    if (rule.name === 'Windows') {
      return WINDOWS_LABELS[hit[0]] ?? rule.name;
    }
    if (rule.name === 'Linux') {
      return rule.name;
    }
    const version = normalizeRawVersion(hit[1] ?? '', rule.majorOnly);
    return version ? `${rule.name} ${version}` : rule.name;
  }
  return null;
}

/**
 * 解析 User-Agent（带缓存）。
 * @param userAgent 原始 UA 串；空值直接返回空结果
 * @returns 浏览器与操作系统信息，无法识别的维度为 `null`
 */
export function parseUserAgent(userAgent: string | null | undefined): UserAgentInfo {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return UNKNOWN;
  }

  const cached = cache.get(ua);
  if (cached) {
    return cached;
  }

  const info: UserAgentInfo = { browser: matchBrowser(ua), os: matchOs(ua) };

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(ua, info);
  return info;
}
