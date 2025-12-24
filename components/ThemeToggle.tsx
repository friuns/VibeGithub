import { Component } from 'solid-js';
import { Sun, Moon, Monitor } from 'lucide-solid';
import { store, setTheme } from '../store';

export const ThemeToggle: Component = () => {
  const cycleTheme = () => {
    if (store.theme === 'system') {
      setTheme('light');
    } else if (store.theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    switch (store.theme) {
      case 'light':
        return <Sun size={16} />;
      case 'dark':
        return <Moon size={16} />;
      default:
        return <Monitor size={16} />;
    }
  };

  const getLabel = () => {
    switch (store.theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      default:
        return 'System';
    }
  };

  return (
    <button
      onClick={cycleTheme}
      class="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
      title={`Current: ${getLabel()}. Click to cycle theme.`}
    >
      {getIcon()}
      <span class="hidden sm:inline">{getLabel()}</span>
    </button>
  );
};