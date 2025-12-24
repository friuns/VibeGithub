import { createContext, useContext, createEffect, onMount, onCleanup } from 'solid-js';
import { createMutable } from 'solid-js/store';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: any;
}

export const ThemeProvider = (props: ThemeProviderProps) => {
  const state = createMutable({
    theme: (() => {
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
      return 'system';
    })() as Theme,
    resolvedTheme: 'light' as 'light' | 'dark',
  });

  const setTheme = (newTheme: Theme) => {
    state.theme = newTheme;
    if (newTheme === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', newTheme);
    }
  };

  createEffect(() => {
    const updateResolvedTheme = () => {
      if (state.theme === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        state.resolvedTheme = isDark ? 'dark' : 'light';
      } else {
        state.resolvedTheme = state.theme;
      }
    };

    updateResolvedTheme();

    // Listen for OS preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (state.theme === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handler);
    onCleanup(() => mediaQuery.removeEventListener('change', handler));
  });

  createEffect(() => {
    // Update the DOM class
    if (state.resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  return (
    <ThemeContext.Provider value={{ theme: state.theme, resolvedTheme: state.resolvedTheme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  );
};



