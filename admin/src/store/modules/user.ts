import { defineStore } from 'pinia';
import { getMenusApi, getProfileApi, loginApi, logoutApi } from '@/api/auth';
import type { LoginParams, MenuNode, UserDetail } from '@/types/api';
import { getAccessToken, getRefreshToken, removeToken, setToken } from '@/utils/auth';

interface UserState {
  /** 访问令牌 */
  accessToken: string;
  /** 刷新令牌 */
  refreshToken: string;
  /** 当前用户信息 */
  userInfo: UserDetail | null;
  /** 角色编码集合 */
  roles: string[];
  /** 按钮权限码集合 */
  permissions: string[];
  /** 菜单树 */
  menus: MenuNode[];
  /** 是否已加载用户信息（profile + menus） */
  loaded: boolean;
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
    userInfo: null,
    roles: [],
    permissions: [],
    menus: [],
    loaded: false,
  }),

  getters: {
    isLogin: (state): boolean => Boolean(state.accessToken),
    nickname: (state): string => state.userInfo?.nickname || state.userInfo?.username || '',
    avatar: (state): string => state.userInfo?.avatar ?? '',
  },

  actions: {
    /**
     * 登录：调用接口并写入 Token 与用户信息。
     *
     * @param params 账号密码
     */
    async login(params: LoginParams): Promise<void> {
      const res = await loginApi(params);
      this.accessToken = res.accessToken;
      this.refreshToken = res.refreshToken;
      setToken(res.accessToken, res.refreshToken);
      this.userInfo = res.user as UserDetail;
      this.loaded = false;
    },

    /** 拉取当前用户信息（含角色、权限码） */
    async fetchProfile(): Promise<void> {
      const res = await getProfileApi();
      this.userInfo = res.user;
      this.roles = res.roles ?? [];
      this.permissions = res.permissions ?? [];
    },

    /** 拉取当前用户菜单树 */
    async fetchMenus(): Promise<MenuNode[]> {
      const menus = await getMenusApi();
      this.menus = Array.isArray(menus) ? menus : [];
      return this.menus;
    },

    /** 加载用户信息 + 菜单树（路由守卫调用） */
    async loadUserInfo(): Promise<void> {
      await this.fetchProfile();
      await this.fetchMenus();
      this.loaded = true;
    },

    /** 覆盖设置权限码 */
    setPermissions(permissions: string[]): void {
      this.permissions = Array.from(new Set(permissions));
    },

    /** 覆盖设置角色 */
    setRoles(roles: string[]): void {
      this.roles = roles;
    },

    /** 登出：调用接口并清空本地状态 */
    async logout(): Promise<void> {
      try {
        await logoutApi();
      } catch {
        // 忽略登出接口异常，仍清空本地状态
      }
      this.resetState();
    },

    /** 重置用户状态并清空 Token */
    resetState(): void {
      this.accessToken = '';
      this.refreshToken = '';
      this.userInfo = null;
      this.roles = [];
      this.permissions = [];
      this.menus = [];
      this.loaded = false;
      removeToken();
    },
  },

  persist: {
    key: 'ly_admin_user',
    pick: ['accessToken', 'refreshToken'],
  },
});
