import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from './themeStore';

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to system theme when nothing is stored', () => {
    expect(useThemeStore.getState().theme).toBe('system');
  });

  it('applies data-theme="dark" immediately when set to dark', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('applies data-theme="light" immediately when set to light', () => {
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists the choice to localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    expect(localStorage.getItem('nearme-theme')).toBe('dark');
  });

  it('defaults to system when localStorage.getItem throws during module initialization', async () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.resetModules();

    const { useThemeStore: freshUseThemeStore } = await import('./themeStore');

    expect(freshUseThemeStore.getState().theme).toBe('system');

    getItemSpy.mockRestore();
    vi.resetModules();
  });

  it('still applies theme and updates state when localStorage.setItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage blocked');
    });

    try {
      useThemeStore.getState().setTheme('dark');
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      expect(useThemeStore.getState().theme).toBe('dark');
    } finally {
      spy.mockRestore();
    }
  });
});
