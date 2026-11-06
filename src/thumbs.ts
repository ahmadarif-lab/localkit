import { signal } from '@preact/signals';
import type { Source } from './types';
import { renderPage } from './engine/pdfjs';
import { canvasToBlob, decodeImage, drawBitmap } from './engine/images';

export interface Thumb {
  url: string;
  w: number;
  h: number;
}

const SIZE = 360;
const CONCURRENCY = 3;

export const thumbs = signal<Record<string, Thumb>>({});
const pending = new Set<string>();
const queue: (() => Promise<void>)[] = [];
let running = 0;

export const thumbKey = (sourceId: string, index: number) => `${sourceId}:${index}`;

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const job = queue.shift()!;
    running++;
    job().finally(() => {
      running--;
      pump();
    });
  }
}

export function requestThumb(src: Source, index: number) {
  const key = thumbKey(src.id, index);
  if (pending.has(key) || thumbs.value[key]) return;
  pending.add(key);
  queue.push(async () => {
    try {
      let canvas: HTMLCanvasElement;
      if (src.kind === 'pdf') {
        ({ canvas } = await renderPage(src, index, { scale: 2, maxDim: SIZE }));
      } else {
        const bmp = await decodeImage(src.file);
        canvas = drawBitmap(bmp, { maxDim: SIZE });
        bmp.close();
      }
      const blob = await canvasToBlob(canvas, 'image/webp', 0.8).catch(() => canvasToBlob(canvas, 'image/jpeg', 0.8));
      const thumb = { url: URL.createObjectURL(blob), w: canvas.width, h: canvas.height };
      canvas.width = canvas.height = 0;
      if (pending.has(key)) thumbs.value = { ...thumbs.value, [key]: thumb };
      else URL.revokeObjectURL(thumb.url);
    } catch {
      // the card keeps its placeholder
    } finally {
      pending.delete(key);
    }
  });
  pump();
}

export function forgetThumbs(sourceId: string) {
  const next = { ...thumbs.value };
  for (const key of Object.keys(next)) {
    if (key.startsWith(`${sourceId}:`)) {
      URL.revokeObjectURL(next[key].url);
      delete next[key];
    }
  }
  for (const key of pending) if (key.startsWith(`${sourceId}:`)) pending.delete(key);
  thumbs.value = next;
}
