import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

const STORAGE_KEY = 'nearme-theme';

function resolveEffectiveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function applyTheme(theme: ThemePreference): void {
  document.documentElement.setAttribute('data-theme', resolveEffectiveTheme(theme));
}

function getInitialTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage unavailable (privacy mode, sandboxed context, etc.) — fall back to default.
  }
  return 'system';
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Persistence failed — theme still applies for this session, just won't survive a reload.
    }
    applyTheme(theme);
    set({ theme });
  },
}));

applyTheme(useThemeStore.getState().theme);

if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (useThemeStore.getState().theme === 'system') applyTheme('system');
  };
  systemTheme.addEventListener?.('change', handleSystemThemeChange);
  import.meta.hot?.dispose(() => systemTheme.removeEventListener?.('change', handleSystemThemeChange));
}
