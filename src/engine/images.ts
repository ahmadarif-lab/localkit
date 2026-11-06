import type { Rotation } from '../types';
import { MAX_CANVAS_PIXELS } from './pdfjs';

const HEIC_RE = /\.(heic|heif)$/i;

export const isHeic = (f: File) => /image\/hei[cf]/i.test(f.type) || HEIC_RE.test(f.name);

export function isPdfFile(f: File, head?: Uint8Array) {
  if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) return true;
  // "%PDF" magic, for files with a missing/odd extension
  return !!head && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
}

export const isImageFile = (f: File) =>
  f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i.test(f.name);

/**
 * HEIC is only decodable natively by Safari. Elsewhere we convert it once to
 * JPEG with a lazily loaded decoder so the rest of the pipeline sees a JPEG.
 */
export async function normalizeImage(file: File): Promise<File> {
  if (!isHeic(file)) return file;
  try {
    const bmp = await createImageBitmap(file);
    bmp.close();
    return file;
  } catch {
    const { default: heic2any } = await import('heic2any');
    const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    const blob = Array.isArray(out) ? out[0] : out;
    return new File([blob], file.name.replace(HEIC_RE, '.jpg'), { type: 'image/jpeg' });
  }
}

export const decodeImage = (blob: Blob) => createImageBitmap(blob, { imageOrientation: 'from-image' });

/** Reads the EXIF orientation tag of a JPEG (1 = upright, or when absent). */
export function jpegOrientation(b: Uint8Array): number {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let off = 2;
  while (off + 4 < b.length) {
    if (b[off] !== 0xff) return 1;
    const marker = b[off + 1];
    const len = (b[off + 2] << 8) | b[off + 3];
    if (marker === 0xe1 && b[off + 4] === 0x45 && b[off + 5] === 0x78) {
      const t = off + 10; // start of TIFF header
      const le = b[t] === 0x49;
      const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
      const u32 = (o: number) => (le ? u16(o) | (u16(o + 2) << 16) : (u16(o) << 16) | u16(o + 2));
      const ifd = t + u32(t + 4);
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(e) === 0x0112) return u16(e + 8) || 1;
      }
      return 1;
    }
    if (marker === 0xda) return 1; // start of scan, no EXIF before it
    off += 2 + len;
  }
  return 1;
}

export interface DrawOpts {
  rotation?: Rotation;
  /** mirror in display space (after rotation) */
  flipH?: boolean;
  flipV?: boolean;
  maxDim?: number;
  /** fill colour behind transparent pixels (needed for JPEG) */
  background?: string;
}

export function drawBitmap(bmp: CanvasImageSource & { width: number; height: number }, opts: DrawOpts = {}) {
  const rot = opts.rotation ?? 0;
  let scale = opts.maxDim ? Math.min(1, opts.maxDim / Math.max(bmp.width, bmp.height)) : 1;
  const area = bmp.width * bmp.height * scale * scale;
  if (area > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / area);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const swap = rot === 90 || rot === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d')!;
  if (opts.background) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(opts.flipH ? -1 : 1, opts.flipV ? -1 : 1);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), type, quality),
  );
}

export async function blobBytes(b: Blob) {
  return new Uint8Array(await b.arrayBuffer());
}

/** Yields to the event loop so progress updates paint during long runs. */
export const tick = () => new Promise<void>((r) => setTimeout(r, 0));
