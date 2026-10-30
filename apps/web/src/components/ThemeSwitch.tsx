import { useEffect, useId, useRef } from 'react';
import { Icon } from './Icon';
import { useTheme, type ThemeChoice } from '../lib/theme';

const OPTIONS: { value: ThemeChoice; label: string; icon: 'sun' | 'moon' | 'monitor' }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
];

/** Native radios, so arrow keys and screen readers work without extra code. */
export function ThemeChoices() {
  const [choice, setChoice] = useTheme();
  const name = useId();
  return <fieldset className="theme-choice"><legend>Appearance</legend>
    {OPTIONS.map(option => <label key={option.value}>
      <input type="radio" name={name} checked={choice === option.value} onChange={() => setChoice(option.value)}/>
      <Icon name={option.icon} size={17}/><span>{option.label}</span>
    </label>)}
  </fieldset>;
}

/** Header control on wider screens. On phones the same choices sit in the menu. */
export function ThemeMenu() {
  const [choice] = useTheme();
  const menu = useRef<HTMLDetailsElement>(null);
  const current = OPTIONS.find(option => option.value === choice)!;
  useEffect(() => {
    const away = (event: PointerEvent) => { if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && menu.current?.open) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, []);
  return <details ref={menu} className="theme-menu"><summary aria-label={`Appearance: ${current.label}`} title={`Appearance: ${current.label}`}><Icon name={current.icon} size={19}/></summary><div><ThemeChoices/></div></details>;
}
