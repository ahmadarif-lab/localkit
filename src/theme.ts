import { signal } from '@preact/signals';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'localkit:theme';

function initial(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {}
  // light by default; "system" (follow the OS) is opt-in in Settings
  return 'light';
}

export const themePref = signal<ThemePref>(initial());

const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
export const isDark = () => (themePref.value === 'system' ? prefersDark() : themePref.value === 'dark');

function apply() {
  const v = themePref.value;
  if (v === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = v;
}
apply();

export function setTheme(v: ThemePref) {
  themePref.value = v;
  apply();
  try {
    localStorage.setItem(KEY, v);
  } catch {}
}

export const toggleTheme = () => setTheme(isDark() ? 'light' : 'dark');
