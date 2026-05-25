import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../store/theme-store';

interface ThemeContextValue {
  theme: 'light' | 'dark';
  actualTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const { resolvedTheme } = useThemeStore();

  useEffect(() => {
    // Apply theme on mount and when resolved theme changes
    const root = document.documentElement;
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme: resolvedTheme, actualTheme: resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}