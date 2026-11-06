import type { Settings, Source } from '../types';

export const stripExt = (n: string) => n.replace(/\.[a-z0-9]{1,5}$/i, '');
export const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').trim() || 'localkit';
export const pad = (n: number, total: number) => String(n).padStart(String(total).length, '0');

/** Image type a page is exported as. "auto" keeps PNG/WebP sources, everything else becomes JPEG. */
export type OutType = 'jpeg' | 'png' | 'webp' | 'gif';

export function outputType(s: Settings, src: Source): OutType {
  if (s.imageFormat !== 'auto') return s.imageFormat;
  // a transparent cut-out must not end up as JPEG
  if (s.removeBg?.bg === 'transparent') return /webp/.test(src.file.type) ? 'webp' : 'png';
  if (src.kind === 'image') {
    if (/png/.test(src.file.type)) return 'png';
    if (/webp/.test(src.file.type)) return 'webp';
    if (/gif/.test(src.file.type)) return 'gif';
  }
  return 'jpeg';
}

export const extFor = (t: OutType) => (t === 'jpeg' ? 'jpg' : t);
