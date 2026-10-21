import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearMenuCache, getMenuCache, setMenuCache } from '@/utils/menuCache';
import type { MenuNode } from '@/types/api';

const fakeMenus = [{ id: 1, menuName: '系统管理', menuType: 'M' }] as unknown as MenuNode[];

describe('menuCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    clearMenuCache();
  });

  it('returns null when nothing cached', () => {
    expect(getMenuCache()).toBeNull();
  });

  it('stores and retrieves the same data', () => {
    setMenuCache(fakeMenus);
    expect(getMenuCache()).toEqual(fakeMenus);
  });

  it('clears the cache', () => {
    setMenuCache(fakeMenus);
    clearMenuCache();
    expect(getMenuCache()).toBeNull();
  });

  it('expires after the 5-minute TTL', () => {
    setMenuCache(fakeMenus);
    // 4 分钟仍在有效期内
    vi.advanceTimersByTime(4 * 60 * 1000);
    expect(getMenuCache()).toEqual(fakeMenus);
    // 再推进 1 分钟 + 1ms → 超过 5 分钟，缓存失效
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(getMenuCache()).toBeNull();
  });
});
