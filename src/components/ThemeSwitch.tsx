import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme';

export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  return <div className={`theme-switch ${compact ? 'theme-switch--compact' : ''}`} role="group" aria-label="Tema de la interfaz">
    <button type="button" className={theme === 'light' ? 'is-active' : ''} aria-pressed={theme === 'light'} onClick={() => setTheme('light')} title="Usar tema claro">
      <Sun size={15} aria-hidden="true"/><span>Claro</span>
    </button>
    <button type="button" className={theme === 'dark' ? 'is-active' : ''} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')} title="Usar tema oscuro">
      <Moon size={15} aria-hidden="true"/><span>Oscuro</span>
    </button>
  </div>;
}
