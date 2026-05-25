import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const resolveTheme = (theme: Theme): 'light' | 'dark' => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

const applyThemeToDocument = (theme: 'light' | 'dark') => {
  if (typeof document === 'undefined') return;
  
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      resolvedTheme: resolveTheme('system'),
      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyThemeToDocument(resolvedTheme);
        set({ theme, resolvedTheme });
      },
    }),
    {
      name: 'sf-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemeToDocument(state.resolvedTheme);
          
          // Listen for system theme changes
          if (typeof window !== 'undefined') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
              if (state.theme === 'system') {
                const newResolved = e.matches ? 'dark' : 'light';
                applyThemeToDocument(newResolved);
                state.resolvedTheme = newResolved;
              }
            });
          }
        }
      },
    }
  )
);

// Initialize theme on app load
if (typeof window !== 'undefined') {
  const { resolvedTheme } = useThemeStore.getState();
  applyThemeToDocument(resolvedTheme);
}