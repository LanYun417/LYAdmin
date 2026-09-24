/**
 * 接口文档覆盖校验。
 * 模块职责：启动时比对「运行时实际注册的路由」与「文档目录（catalog）」，输出一行汇总，
 * 发现差异时逐条告警，帮助开发者及时同步文档。
 *
 * 容错约定（重要）：
 * - Express 5 的 Layer 不再暴露挂载路径，且不同版本的内部结构存在差异；
 * - 本模块在任何异常/结构不符的情况下都只打印一条提示，**绝不抛出异常影响启动**；
 * - 覆盖校验仅用于开发提示，不参与任何业务逻辑。
 */
import type { Express } from 'express';
import { ALL_ENDPOINTS, buildProbeMounts, ENDPOINT_TOTAL } from '@/docs/catalog';

/** 运行时解析出的单个路由。 */
export interface RuntimeRoute {
  /** HTTP 方法（大写） */
  method: string;
  /** 完整路径（含 /api 前缀） */
  path: string;
}

/** 需要忽略的 HTTP 方法（Express 内部占位）。 */
const IGNORED_METHODS = new Set(['_all', 'head', 'options']);

/** 拼接前缀与路由路径，做规范化（去重斜杠、去尾部斜杠）。 */
function joinPath(prefix: string, routePath: string): string {
  let path = routePath || '';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  let full = `${prefix || ''}${path}`;
  full = full.replace(/\/{2,}/g, '/');
  if (full.length > 1 && full.endsWith('/')) {
    full = full.slice(0, -1);
  }
  return full;
}

/**
 * 还原子路由（mounted router）的挂载前缀。
 * 优先读取 `layer.path`（部分 Express 版本可用）；否则用 matcher 逐个探测候选前缀。
 * @param layer 当前 layer
 * @param candidates 候选挂载前缀
 * @returns 挂载前缀；无法还原时返回 null
 */
function resolveMount(layer: Record<string, unknown>, candidates: string[]): string | null {
  const rawPath = layer.path;
  if (typeof rawPath === 'string' && rawPath.length > 0) {
    return rawPath;
  }

  const matchers = layer.matchers;
  if (!Array.isArray(matchers)) {
    return null;
  }

  for (const matcher of matchers) {
    if (typeof matcher !== 'function') {
      continue;
    }
    for (const candidate of candidates) {
      try {
        const result = (matcher as (input: string) => unknown)(candidate);
        if (result && typeof result === 'object') {
          const matched = (result as { path?: unknown }).path;
          if (typeof matched === 'string' && matched.length > 0) {
            return matched;
          }
        }
      } catch {
        // 单个候选探测失败不影响其它候选
      }
    }
  }
  return null;
}

/** 递归遍历 router 栈，收集路由。 */
function walkRouter(
  router: Record<string, unknown>,
  prefix: string,
  out: RuntimeRoute[],
  candidates: string[],
  depth: number,
): void {
  if (depth > 16) {
    return;
  }
  const stack = router.stack;
  if (!Array.isArray(stack)) {
    return;
  }

  for (const rawLayer of stack) {
    if (!rawLayer || typeof rawLayer !== 'object') {
      continue;
    }
    const layer = rawLayer as Record<string, unknown>;

    // 路由层
    const route = layer.route as Record<string, unknown> | undefined;
    if (route && typeof route === 'object') {
      const routePath = typeof route.path === 'string' ? route.path : '';
      const methods = route.methods as Record<string, unknown> | undefined;
      if (methods && typeof methods === 'object') {
        for (const key of Object.keys(methods)) {
          if (methods[key] && !IGNORED_METHODS.has(key.toLowerCase())) {
            out.push({ method: key.toUpperCase(), path: joinPath(prefix, routePath) });
          }
        }
      }
      continue;
    }

    // 子路由层（Express 5 的 handle 为「函数对象」，故不能用 typeof === 'object' 判定）
    const handle = layer.handle as unknown;
    if (handle && (typeof handle === 'object' || typeof handle === 'function')) {
      const handleRecord = handle as Record<string, unknown>;
      if (Array.isArray(handleRecord.stack)) {
        const mount = resolveMount(layer, candidates);
        if (mount !== null) {
          walkRouter(handleRecord, joinPath(prefix, mount), out, candidates, depth + 1);
        }
      }
    }
  }
}

/**
 * 从 Express 应用实例解析运行时注册的全部路由。
 * 供接口文档覆盖校验（auditDocsCoverage）与留痕覆盖校验（auditCoverage）共用。
 * @param app Express 应用
 * @returns 路由列表；无法解析时返回 null
 */
export function collectRuntimeRoutes(app: Express): RuntimeRoute[] | null {
  const anyApp = app as unknown as Record<string, unknown>;
  // 注意：Express 5 的 `app.router` 是一个「函数对象」（带 stack），并非普通对象，
  // 因此这里不能用 typeof === 'object' 作为判定条件。
  const root = (anyApp.router ?? anyApp._router) as unknown;
  if (!root || (typeof root !== 'object' && typeof root !== 'function')) {
    return null;
  }
  const out: RuntimeRoute[] = [];
  walkRouter(root as Record<string, unknown>, '', out, buildProbeMounts(), 0);
  return out;
}

/**
 * 校验接口文档覆盖率并打印结果。
 * 正常时输出一行汇总；发现差异时逐条告警；无法解析路由时输出一条提示。
 * 本函数在任何情况下都不抛出异常。
 * @param app Express 应用实例
 */
export function auditDocsCoverage(app: Express): void {
  try {
    const runtime = collectRuntimeRoutes(app);
    if (runtime === null) {
      console.log('[Docs] 接口文档覆盖校验：无法读取运行时路由列表（Express 版本差异），已跳过校验');
      return;
    }

    // 去重
    const runtimeMap = new Map<string, RuntimeRoute>();
    runtime.forEach((route) => runtimeMap.set(`${route.method} ${route.path}`, route));

    const catalogKeys = new Set(ALL_ENDPOINTS.map((ep) => `${ep.method} ${ep.path}`));

    const missingInDocs: RuntimeRoute[] = [];
    runtimeMap.forEach((route, key) => {
      if (!catalogKeys.has(key)) {
        missingInDocs.push(route);
      }
    });

    const missingInCode = ALL_ENDPOINTS.filter((ep) => !runtimeMap.has(`${ep.method} ${ep.path}`));

    const documentedCount = runtimeMap.size - missingInDocs.length;
    const diffCount = missingInDocs.length + missingInCode.length;

    console.log(`[Docs] 接口文档覆盖校验：已文档化 ${documentedCount} 个路由，${diffCount} 处不一致`);

    missingInDocs.forEach((route) => {
      console.warn(`[Docs] 告警：代码里有但文档缺 → ${route.method} ${route.path}`);
    });
    missingInCode.forEach((ep) => {
      console.warn(`[Docs] 告警：文档里有但代码没有 → ${ep.method} ${ep.path}`);
    });

    if (diffCount === 0 && documentedCount !== ENDPOINT_TOTAL) {
      // 仅在数量异常但无差异时提示（防御性，正常不会触发）
      console.warn(`[Docs] 提示：文档收录 ${ENDPOINT_TOTAL} 个接口，运行时匹配 ${documentedCount} 个`);
    }
  } catch (error) {
    console.log('[Docs] 接口文档覆盖校验：执行时发生异常，已跳过校验', error instanceof Error ? error.message : error);
  }
}
