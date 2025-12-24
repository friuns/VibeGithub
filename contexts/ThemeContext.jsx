import { createContext, useContext, createEffect, createSignal } from 'solid-js';

const ThemeContext = createContext();

export const ThemeProvider = (props) => {
  const [theme, setThemeState] = createSignal(localStorage.getItem('theme') || 'system');

  const [resolvedTheme, setResolvedTheme] = createSignal('light');

  createEffect(() => {
    const updateResolvedTheme = () => {
      if (theme() === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setResolvedTheme(isDark ? 'dark' : 'light');
      } else {
        setResolvedTheme(theme());
      }
    };

    updateResolvedTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme() === 'system') {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  });

  createEffect(() => {
    if (resolvedTheme() === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    if (newTheme === 'system') {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', newTheme);
    }
  };

  const store = {
    theme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={store}>
      {props.children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
