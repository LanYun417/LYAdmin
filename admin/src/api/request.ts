/**
 * axios 实例与请求 / 响应拦截器（全站 HTTP 唯一出口）。
 * 模块职责：统一 baseURL 与超时、注入 Token 与时区请求头、解包统一响应体，
 * 并集中处理 401 无感刷新、403 跳转与错误提示；对业务层只暴露 get / post / put / del。
 */
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { Router } from 'vue-router';
import { ElMessage } from '@/utils/element';
import type { ApiResponse, RefreshResult } from '@/types/api';
import { getAccessToken, getRefreshToken, removeToken, setToken } from '@/utils/auth';

/** 业务成功码 */
const SUCCESS_CODE = 200;
/** 业务未认证码 */
const UNAUTHORIZED_CODE = 401;
/** 业务无权限码 */
const FORBIDDEN_CODE = 403;
/** 持久化 Store 的 key（登出时需一并清理） */
const USER_PERSIST_KEY = 'ly_admin_user';

/** 带重试标记的请求配置 */
interface RetryableConfig extends InternalAxiosRequestConfig {
  /** 是否已重试过（避免无限循环） */
  _retry?: boolean;
  /**
   * 为 true 时拦截器**不弹**错误提示，交由调用方自行处理。
   * 适用于两类请求：调用方自带错误状态展示、或失败后会自动重试——
   * 否则瞬时故障会连续弹出多条相同提示。
   */
  silentError?: boolean;
}

/** 对外暴露的请求配置（在 axios 配置上追加项目自定义开关）。 */
export interface RequestConfig extends AxiosRequestConfig {
  /** 为 true 时不弹通用错误提示（语义同 {@link RetryableConfig.silentError}） */
  silentError?: boolean;
}

/**
 * 按请求配置决定是否弹出错误提示。
 * @param config 请求配置
 * @param message 提示文案
 */
function notifyError(config: RequestConfig | undefined, message: string): void {
  if (!config?.silentError) {
    ElMessage.error(message);
  }
}

/* --------------------------- 路由导航注入（避免循环依赖） --------------------------- */

/**
 * vue-router 实例引用。
 *
 * 说明：`request.ts` 处于依赖链底层（router → guard → store → api/auth → api/request），
 * 若在此处直接 `import router from '@/router'` 会形成循环依赖。因此改为「注入式」：
 * 由 `main.ts` 在创建路由实例后调用 {@link setRequestRouter} 注入，`request.ts` 仅在
 * 拦截器触发时（运行时）读取该引用，此时实例必已就绪。
 *
 * 这里使用 `import type`（编译期擦除），不会在运行时引入 `vue-router`，不构成循环依赖。
 */
let routerInstance: Router | null = null;

/**
 * 注入应用的 vue-router 实例（由 main.ts 调用）。
 * @param router 路由实例
 */
export function setRequestRouter(router: Router): void {
  routerInstance = router;
}

/**
 * 执行路由内跳转；未注入 router 时回退为整页跳转（仅在应用初始化极早期可能发生）。
 * @param fullPath 目标完整路径（含查询串）
 */
function redirectTo(fullPath: string): void {
  if (routerInstance) {
    void routerInstance.push(fullPath);
    return;
  }
  // 兜底：router 尚未注入（正常运行时不会走到这里），退化为整页跳转以保证不丢失导航
  window.location.assign(fullPath);
}

/** 当前是否已处于无权限页（用于避免重复跳转）。 */
function isOnForbiddenPage(): boolean {
  if (routerInstance) {
    return routerInstance.currentRoute.value.path === '/403';
  }
  return window.location.pathname.startsWith('/403');
}

/** 当前完整路径（含查询串），优先取路由状态，回退到浏览器地址。 */
function currentFullPath(): string {
  if (routerInstance) {
    return routerInstance.currentRoute.value.fullPath;
  }
  const { pathname, search } = window.location;
  return `${pathname}${search}`;
}

/** 请求实例 */
const service: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 15000,
});

/* --------------------------- 无感刷新状态机 --------------------------- */

/** 是否正在刷新 Token（单飞标志，避免并发 401 触发多次刷新） */
let isRefreshing = false;
/** 刷新期间挂起的请求回调队列 */
let pendingQueue: Array<(token: string | null) => void> = [];

/**
 * 刷新失败后的统一处理：清空 Token / Store，跳转登录页。
 * 采用「路由内跳转」（router 由 main.ts 注入），避免整页刷新；
 * 通过注入而非直接 import，同样规避 request → router 的循环依赖。
 */
function handleAuthFailure(): void {
  isRefreshing = false;
  pendingQueue = [];
  removeToken();
  localStorage.removeItem(USER_PERSIST_KEY);
  const fullPath = currentFullPath();
  if (!fullPath.startsWith('/login')) {
    ElMessage.error('登录状态已失效，请重新登录');
    redirectTo(`/login?redirect=${encodeURIComponent(fullPath)}`);
  }
}

/**
 * 调用刷新接口换取新 Token。
 *
 * @returns 成功返回新的 accessToken，失败返回 null
 */
async function requestNewToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  try {
    const { data } = await axios.post<ApiResponse<RefreshResult>>(
      `${service.defaults.baseURL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 },
    );
    if (data.code === SUCCESS_CODE && data.data?.accessToken) {
      setToken(data.data.accessToken, data.data.refreshToken);
      return data.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------ 拦截器 ------------------------------ */

// 请求拦截：附加 accessToken、处理 Content-Type
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) {
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    // 告知后端当前用户时区偏移（CSV 导出等由后端按用户时区格式化时间）
    config.headers.set('X-Timezone-Offset', String(new Date().getTimezoneOffset()));
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      // 交由浏览器自动携带 multipart boundary
      config.headers.delete('Content-Type');
    } else if (config.data !== undefined && !config.headers.has('Content-Type')) {
      config.headers.set('Content-Type', 'application/json');
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

// 响应拦截：统一解包 + 401 无感刷新 + 403 跳转
service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data;
    // 非标准响应（如文件流）直接返回
    if (res === null || res === undefined || typeof res.code === 'undefined') {
      return response.data as unknown as AxiosResponse;
    }
    if (res.code === SUCCESS_CODE) {
      return res.data as unknown as AxiosResponse;
    }
    if (res.code === UNAUTHORIZED_CODE) {
      handleAuthFailure();
      return Promise.reject(new Error(res.message || '登录状态已失效'));
    }
    if (res.code === FORBIDDEN_CODE) {
      notifyError(response.config as RequestConfig, res.message || '无访问权限');
      if (!isOnForbiddenPage()) {
        redirectTo('/403');
      }
      return Promise.reject(new Error(res.message || '无访问权限'));
    }
    notifyError(response.config as RequestConfig, res.message || '请求失败');
    return Promise.reject(new Error(res.message || '请求失败'));
  },
  async (error: AxiosError<ApiResponse>) => {
    const { response, config } = error;
    const originalConfig = config as RetryableConfig | undefined;

    // 无响应（网络异常 / 超时）
    if (!response) {
      notifyError(originalConfig, error.message || '网络异常，请稍后重试');
      return Promise.reject(error);
    }

    const status = response.status;
    const businessCode = response.data?.code;

    // 403：跳转无权限页
    if (status === FORBIDDEN_CODE || businessCode === FORBIDDEN_CODE) {
      notifyError(originalConfig, response.data?.message || '无访问权限');
      if (!isOnForbiddenPage()) {
        redirectTo('/403');
      }
      return Promise.reject(error);
    }

    // 401：无感刷新
    if (status === UNAUTHORIZED_CODE || businessCode === UNAUTHORIZED_CODE) {
      if (!originalConfig || originalConfig.url?.includes('/auth/refresh')) {
        handleAuthFailure();
        return Promise.reject(error);
      }
      if (originalConfig._retry) {
        handleAuthFailure();
        return Promise.reject(error);
      }

      // 已在刷新中：压入队列，等待新 Token 后重放
      if (isRefreshing) {
        return new Promise<unknown>((resolve) => {
          pendingQueue.push((token: string | null) => {
            if (token) {
              originalConfig._retry = true;
              originalConfig.headers.set('Authorization', `Bearer ${token}`);
              resolve(service(originalConfig));
            } else {
              resolve(Promise.reject(error));
            }
          });
        });
      }

      // 首个 401：置位单飞标志并发起刷新
      isRefreshing = true;
      const newToken = await requestNewToken();
      isRefreshing = false;

      if (newToken) {
        pendingQueue.forEach((callback) => callback(newToken));
        pendingQueue = [];
        originalConfig._retry = true;
        originalConfig.headers.set('Authorization', `Bearer ${newToken}`);
        return service(originalConfig);
      }

      // 刷新失败：清空队列并登出
      pendingQueue.forEach((callback) => callback(null));
      pendingQueue = [];
      handleAuthFailure();
      return Promise.reject(error);
    }

    notifyError(originalConfig, response.data?.message || `请求失败（${status}）`);
    return Promise.reject(error);
  },
);

/**
 * 通用请求方法（拦截器已解包，直接返回业务 data）。
 *
 * @param config axios 请求配置
 */
export function request<T = unknown>(config: RequestConfig): Promise<T> {
  return service.request(config) as unknown as Promise<T>;
}

/** GET 请求 */
export function get<T = unknown>(url: string, params?: object, config?: RequestConfig): Promise<T> {
  return request<T>({ url, method: 'GET', params, ...config });
}

/** POST 请求 */
export function post<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...config });
}

/** PUT 请求 */
export function put<T = unknown>(url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...config });
}

/** DELETE 请求 */
export function del<T = unknown>(url: string, params?: object, config?: RequestConfig): Promise<T> {
  return request<T>({ url, method: 'DELETE', params, ...config });
}

export { service };
export default service;
