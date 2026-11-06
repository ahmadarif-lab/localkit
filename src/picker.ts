import { addFiles, route } from './state';
import type { Tool } from './tools';

export const ACCEPT: Record<Tool['accept'], string> = {
  pdf: 'application/pdf,.pdf',
  image: 'image/*,.heic,.heif',
  any: 'application/pdf,.pdf,image/*,.heic,.heif',
};

export function pickFiles(accept: Tool['accept'], onPicked?: (files: File[]) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = ACCEPT[accept];
  input.onchange = () => {
    const files = [...(input.files ?? [])];
    if (files.length) (onPicked ?? ((f) => addFiles(f)))(files);
  };
  input.click();
}

/** Files dropped anywhere are loaded; on the home screen the user then picks a tool. */
export function startWithFiles(files: File[]) {
  addFiles(files);
  if (route.value.view === 'home') {
    requestAnimationFrame(() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
