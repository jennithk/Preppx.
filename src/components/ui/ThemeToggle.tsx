import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../providers/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button className="icon-button" type="button" onClick={toggleTheme} aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`} title={`Switch to ${isDark ? 'light' : 'dark'} mode`}>
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
