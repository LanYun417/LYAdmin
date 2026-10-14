/**
 * 用户 Store：登录 / 登出、Token 与当前用户信息（角色、权限码、菜单树）。
 */

import { getMenusApi, getProfileApi, loginApi, logoutApi } from '@/api/auth';
import type { LoginParams, MenuNode, UserDetail } from '@/types/api';
import { getAccessToken, getRefreshToken, removeToken, setToken } from '@/utils/auth';
import { clearMenuCache, getMenuCache, setMenuCache } from '@/utils/menuCache';

export const useUserStore = defineStore(
  'user',
  () => {
    /** 访问令牌 */
    const accessToken = ref<string>(getAccessToken());
    /** 刷新令牌 */
    const refreshToken = ref<string>(getRefreshToken());
    /** 当前用户信息 */
    const userInfo = ref<UserDetail | null>(null);
    /** 角色编码集合 */
    const roles = ref<string[]>([]);
    /** 按钮权限码集合 */
    const permissions = ref<string[]>([]);
    /** 菜单树 */
    const menus = ref<MenuNode[]>([]);
    /** 是否已加载用户信息（profile + menus） */
    const loaded = ref<boolean>(false);

    /** 是否已登录 */
    const isLogin = computed<boolean>(() => Boolean(accessToken.value));
    /** 展示昵称（回退用户名） */
    const nickname = computed<string>(() => userInfo.value?.nickname || userInfo.value?.username || '');
    /** 头像地址 */
    const avatar = computed<string>(() => userInfo.value?.avatar ?? '');

    /**
     * 登录：调用接口并写入 Token 与用户信息。
     *
     * @param params 账号密码
     */
    async function login(params: LoginParams): Promise<void> {
      const res = await loginApi(params);
      accessToken.value = res.accessToken;
      refreshToken.value = res.refreshToken;
      setToken(res.accessToken, res.refreshToken);
      userInfo.value = res.user as UserDetail;
      loaded.value = false;
      // 重新登录应拉取新用户的菜单，清掉上一用户的缓存
      clearMenuCache();
    }

    /** 拉取当前用户信息（含角色、权限码） */
    async function fetchProfile(): Promise<void> {
      const res = await getProfileApi();
      userInfo.value = res.user;
      roles.value = res.roles ?? [];
      permissions.value = res.permissions ?? [];
    }

    /** 拉取当前用户菜单树（命中短 TTL 缓存则跳过网络请求） */
    async function fetchMenus(force = false): Promise<MenuNode[]> {
      if (!force) {
        const cached = getMenuCache();
        if (cached) {
          menus.value = cached;
          return cached;
        }
      }
      const menuTree = await getMenusApi();
      const list = Array.isArray(menuTree) ? menuTree : [];
      menus.value = list;
      setMenuCache(list);
      return list;
    }

    /** 加载用户信息 + 菜单树（路由守卫调用）。profile 与 menus 互不依赖，并行拉取减少首屏 RTT。 */
    async function loadUserInfo(): Promise<void> {
      await Promise.all([fetchProfile(), fetchMenus()]);
      loaded.value = true;
    }

    /** 覆盖设置权限码 */
    function setPermissions(codes: string[]): void {
      permissions.value = Array.from(new Set(codes));
    }

    /** 覆盖设置角色 */
    function setRoles(value: string[]): void {
      roles.value = value;
    }

    /** 重置用户状态并清空 Token */
    function resetState(): void {
      accessToken.value = '';
      refreshToken.value = '';
      userInfo.value = null;
      roles.value = [];
      permissions.value = [];
      menus.value = [];
      loaded.value = false;
      clearMenuCache();
      removeToken();
    }

    /** 登出：调用接口并清空本地状态 */
    async function logout(): Promise<void> {
      try {
        await logoutApi();
      } catch {
        // 忽略登出接口异常，仍清空本地状态
      }
      resetState();
    }

    return {
      accessToken,
      refreshToken,
      userInfo,
      roles,
      permissions,
      menus,
      loaded,
      isLogin,
      nickname,
      avatar,
      login,
      fetchProfile,
      fetchMenus,
      loadUserInfo,
      setPermissions,
      setRoles,
      resetState,
      logout,
    };
  },
  {
    persist: {
      key: 'ly_admin_user',
      pick: ['accessToken', 'refreshToken'],
    },
  },
);
