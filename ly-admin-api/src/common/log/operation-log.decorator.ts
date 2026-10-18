/**
 * 操作日志装饰器与规则常量。
 * 模块职责：以**声明式元数据**描述「哪个接口属于哪个模块、什么动作」。
 *
 * 为什么用装饰器而非集中式规则表：
 * ① 路由改名/改前缀时规则表会静默失效（无编译期保障）；
 * ② 规则表需要与端点列表人工保持同步，易漂移。
 * 装饰器把元数据与端点写在一起，改名即同步，也可被静态检查直接反射读取。
 */

/** 写操作方法白名单（其余方法不记操作日志）。 */
export const OPERATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

/** 不记操作日志的路径前缀（认证类单独记登录日志）。 */
export const OPERATION_EXCLUDED_PREFIXES = ['/api/auth/'] as const;

/** 操作日志元数据键。 */
export const OPERATION_LOG_KEY = 'ly:operationLog';

/** 单个端点的操作日志描述。 */
export interface OperationMeta {
  /** 模块名，如「用户管理」 */
  module: string;
  /** 动作名，如「新增」；留空则按 HTTP 方法推断 */
  action?: string;
}

/**
 * 声明该端点的操作日志信息。
 *
 * 用法：
 * ```ts
 * @Post()
 * @OperationLog('用户管理', '新增')
 * create() {}
 * ```
 */
export const OperationLog = (module: string, action?: string): MethodDecorator & ClassDecorator => {
  const meta: OperationMeta = { module, action: action ?? '' };
  // 自行写 metadata 而非 SetMetadata：便于同时挂载到方法与类
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void => {
    const metaKey = OPERATION_LOG_KEY;
    if (descriptor && propertyKey !== undefined) {
      Reflect.defineMetadata(metaKey, meta, descriptor.value);
    } else {
      Reflect.defineMetadata(metaKey, meta, target);
    }
  };
};

/** 读取端点声明的操作日志信息。 */
export function getOperationMeta(handler: (...args: never[]) => unknown): OperationMeta | null {
  return Reflect.getMetadata(OPERATION_LOG_KEY, handler) ?? null;
}

/**
 * 兜底动作推断：`action` 留空时按 HTTP 方法推断。
 * DELETE → 删除；POST → 新增；其余（PUT/PATCH）→ 编辑。
 */
export function inferAction(method: string): string {
  switch (method.toUpperCase()) {
    case 'DELETE':
      return '删除';
    case 'POST':
      return '新增';
    default:
      return '编辑';
  }
}

/** 判断该请求是否需要记操作日志。 */
export function shouldLogOperation(method: string, path: string): boolean {
  if (!(OPERATION_METHODS as readonly string[]).includes(method.toUpperCase())) {
    return false;
  }
  return !OPERATION_EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix));
}
