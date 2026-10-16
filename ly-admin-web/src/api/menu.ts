/**
 * 菜单接口：菜单列表 / 树、详情与增删改。
 */
import { del, get, post, put } from './request';
import type { Menu, MenuNode, MenuQuery, MenuUpsert } from '@/types/api';

/** 菜单列表（tree=1 时返回树） */
export function getMenuListApi(params?: MenuQuery): Promise<MenuNode[]> {
  return get<MenuNode[]>('/menus', params);
}

/** 菜单树（授权 / 上级选择） */
export function getMenuTreeApi(): Promise<MenuNode[]> {
  return get<MenuNode[]>('/menus/tree');
}

/** 菜单详情 */
export function getMenuDetailApi(id: number): Promise<Menu> {
  return get<Menu>(`/menus/${id}`);
}

/** 新增菜单 */
export function createMenuApi(data: MenuUpsert): Promise<Menu> {
  return post<Menu>('/menus', data);
}

/** 编辑菜单 */
export function updateMenuApi(id: number, data: MenuUpsert): Promise<Menu> {
  return put<Menu>(`/menus/${id}`, data);
}

/** 删除菜单 */
export function deleteMenuApi(id: number): Promise<null> {
  return del<null>(`/menus/${id}`);
}
