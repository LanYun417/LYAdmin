import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { ElMessage } from 'element-plus';
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
 * 使用 window.location 而非 router，避免 request → router 的循环依赖。
 */
function handleAuthFailure(): void {
  isRefreshing = false;
  pendingQueue = [];
  removeToken();
  localStorage.removeItem(USER_PERSIST_KEY);
  const { pathname, search } = window.location;
  if (!pathname.startsWith('/login')) {
    ElMessage.error('登录状态已失效，请重新登录');
    const redirect = encodeURIComponent(pathname + search);
    window.location.href = `/login?redirect=${redirect}`;
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
      ElMessage.error(res.message || '无访问权限');
      if (!window.location.pathname.startsWith('/403')) {
        window.location.href = '/403';
      }
      return Promise.reject(new Error(res.message || '无访问权限'));
    }
    ElMessage.error(res.message || '请求失败');
    return Promise.reject(new Error(res.message || '请求失败'));
  },
  async (error: AxiosError<ApiResponse>) => {
    const { response, config } = error;
    const originalConfig = config as RetryableConfig | undefined;

    // 无响应（网络异常 / 超时）
    if (!response) {
      ElMessage.error(error.message || '网络异常，请稍后重试');
      return Promise.reject(error);
    }

    const status = response.status;
    const businessCode = response.data?.code;

    // 403：跳转无权限页
    if (status === FORBIDDEN_CODE || businessCode === FORBIDDEN_CODE) {
      ElMessage.error(response.data?.message || '无访问权限');
      if (!window.location.pathname.startsWith('/403')) {
        window.location.href = '/403';
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

    ElMessage.error(response.data?.message || `请求失败（${status}）`);
    return Promise.reject(error);
  },
);

/**
 * 通用请求方法（拦截器已解包，直接返回业务 data）。
 *
 * @param config axios 请求配置
 */
export function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
  return service.request(config) as unknown as Promise<T>;
}

/** GET 请求 */
export function get<T = unknown>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ url, method: 'GET', params, ...config });
}

/** POST 请求 */
export function post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ url, method: 'POST', data, ...config });
}

/** PUT 请求 */
export function put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ url, method: 'PUT', data, ...config });
}

/** DELETE 请求 */
export function del<T = unknown>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
  return request<T>({ url, method: 'DELETE', params, ...config });
}

export { service };
export default service;
