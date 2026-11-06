import { t } from './i18n';

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
/** touch-first devices (phones, tablets) have no paste shortcut to offer */
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;

/** "PDF, JPG, … · or paste with ⌘V", without the paste part on touch devices */
export function dropHint() {
  const formats = t('drop.sub');
  return TOUCH ? formats : `${formats} · ${t('drop.paste', { key: IS_MAC ? '⌘V' : 'Ctrl+V' })}`;
}
