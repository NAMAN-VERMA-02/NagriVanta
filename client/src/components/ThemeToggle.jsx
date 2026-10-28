import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

// Single button: switches between light and dark.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn-ghost h-10 w-10 rounded-full p-0"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
    >
      {dark ? <Sun className="h-5 w-5 text-amber-300" aria-hidden /> : <Moon className="h-5 w-5" aria-hidden />}
    </button>
  );
}
