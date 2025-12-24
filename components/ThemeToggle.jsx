import { Sun, Moon, Monitor } from 'lucide-solid';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme() === 'system') {
      setTheme('light');
    } else if (theme() === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    switch (theme()) {
      case 'light':
        return <Sun size={16} />;
      case 'dark':
        return <Moon size={16} />;
      default:
        return <Monitor size={16} />;
    }
  };

  const getLabel = () => {
    switch (theme()) {
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
