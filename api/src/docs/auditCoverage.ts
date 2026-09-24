/**
 * 留痕覆盖率守卫（F3 · 差异化能力）。
 * 模块职责：启动时枚举「运行时实际注册的写方法路由」（POST/PUT/PATCH/DELETE），
 * 与操作日志规则表（`OPERATION_RULES`）比对，列出「有写操作、无留痕」的接口，
 * 把审计黑洞在**启动阶段**即时暴露，而不是等线上出事后才发现。
 *
 * 背景：`OPERATION_RULES` 是一张**路径正则表**，新增写接口极易漏挂规则 → 产生
 * “有写操作、无留痕”的审计黑洞。本守卫是「覆盖率不变量」检查：目标为未留痕写接口数 = 0。
 *
 * 设计要点（与 `routeAudit.ts` 的 `auditDocsCoverage` 并列、风格一致）：
 * - 复用 `routeAudit.collectRuntimeRoutes` 的运行时路由枚举能力（不复制粘贴解析逻辑）；
 * - 复用 `operationLog` 的 `OPERATION_RULES` 与 `EXCLUDED_PREFIXES`（不另存一份规则表，避免漂移）；
 * - 容错约定：任何异常只打印一条提示，**绝不抛出异常影响启动**（覆盖校验仅用于开发提示）。
 *
 * ⚠️ 本模块只**暴露**未留痕清单，**不自动修改** `OPERATION_RULES`——补哪条规则属功能决策。
 */
import type { Express } from 'express';
import { collectRuntimeRoutes, type RuntimeRoute } from '@/docs/routeAudit';
import { EXCLUDED_PREFIXES, OPERATION_RULES } from '@/middlewares/operationLog';

/** 需要纳入留痕覆盖校验的写方法。 */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * 额外排除前缀（不属于业务路由）。
 * `/api-docs` 为公开接口文档，不在操作留痕范围；认证类排除前缀复用 `operationLog.EXCLUDED_PREFIXES`。
 */
const EXTRA_EXCLUDED_PREFIXES = ['/api-docs'];

/**
 * 判断路径是否落在排除前缀内。
 * @param path 完整路由路径
 * @returns 命中任一排除前缀则为 true
 */
function isExcluded(path: string): boolean {
  return [...EXCLUDED_PREFIXES, ...EXTRA_EXCLUDED_PREFIXES].some((prefix) => path.startsWith(prefix));
}

/**
 * 把路由模板中的 Express 路径参数（`:name`）替换为指定样本值。
 * @param routePath 运行时路由模板（可能含 `:param`）
 * @param sample 替换样本（如数字 `1` / 文本 `test`）
 * @returns 具体路径样本
 */
function replaceParams(routePath: string, sample: string): string {
  return routePath.replace(/:[^/]+/g, sample);
}

/**
 * 提取路由模板中的全部路径参数名。
 * @param routePath 运行时路由模板
 * @returns 参数名列表
 */
function paramNames(routePath: string): string[] {
  return Array.from(routePath.matchAll(/:([^/]+)/g), (match) => match[1]);
}

/** 形似「数字型」的参数名（如 id / userId / num / seq / code）。 */
const NUMERIC_PARAM_NAME_RE = /(id|ids|num|number|count|seq|code)$/i;

/**
 * 判断路由的路径参数是否「看着像数字」（用于区分「数字 id 参数」与「字符串参数」）。
 * 仅当路由**有参数**且**所有参数名都形似数字型**时返回 true。
 * @param routePath 运行时路由模板
 * @returns 是否形似数字型参数
 */
function looksNumericParams(routePath: string): boolean {
  const names = paramNames(routePath);
  return names.length > 0 && names.every((name) => NUMERIC_PARAM_NAME_RE.test(name));
}

/**
 * 判断给定具体路径样本中是否有任一命中 `OPERATION_RULES`。
 * @param samples 待匹配的具体路径样本
 * @returns 命中任一规则则为 true
 */
function hitsAnyRule(samples: string[]): boolean {
  return OPERATION_RULES.some((rule) => samples.some((sample) => rule.pattern.test(sample)));
}

/** 单条写路由的留痕覆盖判定结果。 */
export interface RouteCoverageVerdict {
  /** 是否已被留痕规则覆盖（数字样本或文本样本任一命中） */
  covered: boolean;
  /**
   * 是否属于「仅靠数字样本才命中」的提示（防假阴性）：
   * 当路由带**非数字型**参数、且只有数字样本命中、文本样本（`test`）不命中时为 true——
   * 说明真实请求若传字符串参数将**不落审计**，需人工确认参数类型。
   */
  numericOnlyHint: boolean;
}

/**
 * 判定单条写路由的留痕覆盖情况（纯函数，便于单测 / 验证）。
 *
 * 说明：运行时枚举得到的是**模板**（`/api/users/:id`），而 `OPERATION_RULES` 的正则按**真实请求
 * 路径**编写（如 `^/api/users/\d+$`）。直接拿模板去匹配必然失败，会产生大量误报。因此把 `:param`
 * 展开为具体样本（数字 `1` 与文本 `test`）后再匹配。
 *
 * 判定策略（宁滥毋纵，不漏黑洞、也不对现有数字 id 路由误报）：
 * - 「任一样本命中即视为已覆盖」→ 避免当前 22 处数字 id 路由被误报为未留痕；
 * - 另对「仅数字样本命中、文本样本不命中、且参数名不像数字」的路由追加提示，
 *   覆盖“字符串参数 + 数字正则规则”这一未来可能出现的假阴性。
 * @param routePath 运行时路由模板
 * @returns 覆盖判定结果
 */
export function classifyWriteRoute(routePath: string): RouteCoverageVerdict {
  const numericSample = replaceParams(routePath, '1');
  const textualSample = replaceParams(routePath, 'test');
  const hasParams = numericSample !== textualSample;
  const numericHit = hitsAnyRule([numericSample]);
  const textualHit = hitsAnyRule([textualSample]);
  const covered = numericHit || textualHit;
  const numericOnlyHint = hasParams && numericHit && !textualHit && !looksNumericParams(routePath);
  return { covered, numericOnlyHint };
}

/**
 * 校验留痕覆盖率并打印结果。
 * 正常时输出一行汇总；发现未留痕写接口时逐条告警；无法解析路由时输出一条提示。
 * 本函数在任何情况下都不抛出异常。
 * @param app Express 应用实例
 */
export function auditCoverage(app: Express): void {
  try {
    const runtime = collectRuntimeRoutes(app);
    if (runtime === null) {
      console.log('[AuditCoverage] 留痕覆盖校验：无法读取运行时路由列表（Express 版本差异），已跳过校验');
      return;
    }

    // 过滤写方法 + 去重（同一 method+path 去重）
    const writeRouteMap = new Map<string, RuntimeRoute>();
    runtime.forEach((route) => {
      if (!WRITE_METHODS.has(route.method) || isExcluded(route.path)) {
        return;
      }
      writeRouteMap.set(`${route.method} ${route.path}`, route);
    });
    const writeRoutes = Array.from(writeRouteMap.values());

    const uncovered: RuntimeRoute[] = [];
    const paramHints: RuntimeRoute[] = [];
    for (const route of writeRoutes) {
      const verdict = classifyWriteRoute(route.path);
      if (!verdict.covered) {
        uncovered.push(route);
      } else if (verdict.numericOnlyHint) {
        paramHints.push(route);
      }
    }

    const total = writeRoutes.length;
    const covered = total - uncovered.length;
    const rate = total === 0 ? 100 : Math.round((covered / total) * 100);

    console.log(`[AuditCoverage] 写接口 ${total} 个，未留痕 ${uncovered.length} 个（覆盖率 ${rate}%）`);

    uncovered.forEach((route) => {
      console.warn(`[AuditCoverage] 告警：写接口未留痕（未命中 OPERATION_RULES）→ ${route.method} ${route.path}`);
    });
    paramHints.forEach((route) => {
      console.warn(`[AuditCoverage] 提示：${route.method} ${route.path} 仅数字参数可留痕，请确认参数类型是否为数字`);
    });
  } catch (error) {
    console.log(
      '[AuditCoverage] 留痕覆盖校验：执行时发生异常，已跳过校验',
      error instanceof Error ? error.message : error,
    );
  }
}
