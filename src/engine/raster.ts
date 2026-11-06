import type { BorderOpts, Crop, PageItem, Position, ResizeOpts, Settings, Source, WatermarkOpts } from '../types';
import { renderPage } from './pdfjs';
import { decodeImage, drawBitmap } from './images';
import { removeBackground } from './removebg';

/** name → [width, height, fit] */
export const RESIZE_PRESETS: Record<string, [number, number, ResizeOpts['fit']]> = {
  'ig-square': [1080, 1080, 'cover'],
  'ig-portrait': [1080, 1350, 'cover'],
  story: [1080, 1920, 'cover'],
  'yt-thumb': [1280, 720, 'cover'],
  'x-post': [1600, 900, 'cover'],
  'fb-cover': [1640, 624, 'cover'],
  'wa-profile': [640, 640, 'cover'],
  'pas-2x3': [236, 354, 'cover'],
  'pas-3x4': [354, 472, 'cover'],
  'pas-4x6': [472, 709, 'cover'],
  hd: [1920, 1080, 'contain'],
  '4k': [3840, 2160, 'contain'],
};

const FONT = '"Plus Jakarta Sans Variable", ui-sans-serif, system-ui, sans-serif';

export function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

const ctx2d = (c: HTMLCanvasElement) => {
  const x = c.getContext('2d')!;
  x.imageSmoothingQuality = 'high';
  return x;
};

export function parseRatio(r: string | null | undefined): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*[:x/]\s*(\d+(?:\.\d+)?)$/.exec(r ?? '');
  return m ? Number(m[1]) / Number(m[2]) : null;
}

/** Largest centred box of the given ratio, as fractions. */
export function centerCrop(w: number, h: number, ratio: number): Crop {
  if (w / h > ratio) {
    const cw = (h * ratio) / w;
    return { x: (1 - cw) / 2, y: 0, w: cw, h: 1 };
  }
  const ch = w / ratio / h;
  return { x: 0, y: (1 - ch) / 2, w: 1, h: ch };
}

function crop(c: HTMLCanvasElement, r: Crop) {
  const sx = Math.round(r.x * c.width);
  const sy = Math.round(r.y * c.height);
  const sw = Math.max(1, Math.round(r.w * c.width));
  const sh = Math.max(1, Math.round(r.h * c.height));
  const out = newCanvas(sw, sh);
  ctx2d(out).drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Final pixel size for a resize, based on the ORIGINAL image size. */
export function resizeTarget(w: number, h: number, r: ResizeOpts): { w: number; h: number; fit: ResizeOpts['fit'] } {
  let tw: number;
  let th: number;
  let fit = r.fit;
  if (r.mode === 'preset' && RESIZE_PRESETS[r.preset]) {
    [tw, th, fit] = RESIZE_PRESETS[r.preset];
  } else if (r.mode === 'pct') {
    tw = (w * r.pct) / 100;
    th = (h * r.pct) / 100;
    fit = 'stretch';
  } else {
    tw = r.width || 0;
    th = r.height || 0;
    if (!tw && !th) return { w, h, fit: 'stretch' };
    if (!tw) (tw = (w * th) / h), (fit = 'stretch');
    else if (!th) (th = (h * tw) / w), (fit = 'stretch');
  }
  if (fit === 'contain') {
    let k = Math.min(tw / w, th / h);
    if (r.noUpscale) k = Math.min(1, k);
    return { w: Math.round(w * k), h: Math.round(h * k), fit: 'stretch' };
  }
  if (r.noUpscale && fit === 'stretch' && tw > w && th > h) return { w, h, fit };
  return { w: Math.max(1, Math.round(tw)), h: Math.max(1, Math.round(th)), fit };
}

function resize(c: HTMLCanvasElement, tw: number, th: number, fit: ResizeOpts['fit']) {
  const out = newCanvas(tw, th);
  const x = ctx2d(out);
  if (fit === 'cover') {
    const k = Math.max(tw / c.width, th / c.height);
    const sw = tw / k;
    const sh = th / k;
    x.drawImage(c, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh, 0, 0, tw, th);
  } else {
    x.drawImage(c, 0, 0, tw, th);
  }
  return out;
}

function border(c: HTMLCanvasElement, b: BorderOpts, k: number) {
  const pad = b.unit === 'pct' ? (Math.min(c.width, c.height) * b.size) / 100 : b.size * k;
  if (pad <= 0) return c;
  const out = newCanvas(c.width + 2 * pad, c.height + 2 * pad);
  const x = ctx2d(out);
  x.fillStyle = b.color;
  x.fillRect(0, 0, out.width, out.height);
  x.drawImage(c, Math.round(pad), Math.round(pad));
  return out;
}

/** Anchor point (centre of the stamp) for a 3×3 position, in a w×h box. */
export function anchor(pos: Position, w: number, h: number, iw: number, ih: number, margin: number) {
  const col = pos[1] === 'l' ? 0 : pos[1] === 'c' ? 1 : 2;
  const row = pos[0] === 't' ? 0 : pos[0] === 'm' ? 1 : 2;
  const x = col === 0 ? margin + iw / 2 : col === 1 ? w / 2 : w - margin - iw / 2;
  const y = row === 0 ? margin + ih / 2 : row === 1 ? h / 2 : h - margin - ih / 2;
  return { x, y };
}

export function drawWatermark(c: HTMLCanvasElement, wm: WatermarkOpts, logo?: ImageBitmap | null) {
  const x = ctx2d(c);
  const short = Math.min(c.width, c.height);
  let iw: number;
  let ih: number;
  let paint: () => void;
  if (wm.kind === 'image') {
    if (!logo) return;
    iw = (c.width * wm.size) / 100;
    ih = (iw * logo.height) / logo.width;
    paint = () => x.drawImage(logo, -iw / 2, -ih / 2, iw, ih);
  } else {
    const text = wm.text.trim();
    if (!text) return;
    const px = Math.max(8, (short * wm.size) / 100);
    x.font = `700 ${px}px ${FONT}`;
    iw = x.measureText(text).width;
    ih = px;
    paint = () => {
      x.font = `700 ${px}px ${FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = wm.color;
      x.fillText(text, 0, 0);
    };
  }
  x.save();
  x.globalAlpha = Math.max(0, Math.min(1, wm.opacity / 100));
  const rad = (-wm.rotation * Math.PI) / 180;
  if (wm.tile) {
    const stepX = iw * 1.6 + short * 0.04;
    const stepY = ih * 3.2 + short * 0.04;
    const diag = Math.hypot(c.width, c.height);
    x.translate(c.width / 2, c.height / 2);
    x.rotate(rad);
    for (let yy = -diag / 2; yy <= diag / 2; yy += stepY) {
      const shift = (Math.round(yy / stepY) % 2) * (stepX / 2);
      for (let xx = -diag / 2 - shift; xx <= diag / 2; xx += stepX) {
        x.save();
        x.translate(xx, yy);
        paint();
        x.restore();
      }
    }
  } else {
    const p = anchor(wm.position, c.width, c.height, iw, ih, short * 0.04);
    x.translate(p.x, p.y);
    x.rotate(rad);
    paint();
  }
  x.restore();
}

export const hasPixelOps = (s: Settings, p: PageItem) =>
  !!(p.flipH || p.flipV || p.crop || s.cropRatio || s.removeBg || s.resize || s.border);

export interface RasterOpts {
  /** render resolution for PDF pages */
  dpi: number;
  /** cap on the longest side after resizing (compression) */
  maxDim?: number;
  /** skip the raster watermark (the PDF path stamps vectors instead) */
  noWatermark?: boolean;
  logo?: ImageBitmap | null;
  /** preview: decode at most this size; pixel-based options are scaled to match */
  preview?: number;
}

/**
 * Renders one page to a canvas with every image operation applied, in order:
 * rotate/flip → crop → remove background → resize → size cap → border → watermark.
 */
export async function renderRaster(src: Source, page: PageItem, s: Settings, o: RasterOpts): Promise<HTMLCanvasElement> {
  let c: HTMLCanvasElement;
  let fullW: number;
  if (src.kind === 'pdf') {
    const r = await renderPage(src, page.index, { scale: o.dpi / 72, rotation: page.rotation, maxDim: o.preview });
    c = r.canvas;
    const swap = page.rotation % 180 !== 0;
    fullW = ((swap ? src.height : src.width) ?? r.pointWidth) * (o.dpi / 72);
    if (page.flipH || page.flipV) {
      const f = newCanvas(c.width, c.height);
      const fx = ctx2d(f);
      fx.translate(page.flipH ? c.width : 0, page.flipV ? c.height : 0);
      fx.scale(page.flipH ? -1 : 1, page.flipV ? -1 : 1);
      fx.drawImage(c, 0, 0);
      c.width = 0;
      c = f;
    }
  } else {
    const bmp = await decodeImage(src.file);
    c = drawBitmap(bmp, { rotation: page.rotation, flipH: page.flipH, flipV: page.flipV, maxDim: o.preview });
    fullW = page.rotation % 180 ? bmp.height : bmp.width;
    bmp.close();
  }
  // k < 1 in previews: scales pixel-based settings down to the preview size
  const k = c.width / fullW;

  const ratio = parseRatio(s.cropRatio);
  const box = page.crop ?? (ratio ? centerCrop(c.width, c.height, ratio) : null);
  let origW = fullW;
  let origH = (fullW * c.height) / c.width;
  if (box) {
    origW *= box.w;
    origH *= box.h;
    c = crop(c, box);
  }

  if (s.removeBg) {
    c = await removeBackground(c);
    if (s.removeBg.bg !== 'transparent') {
      const f = newCanvas(c.width, c.height);
      const fx = ctx2d(f);
      fx.fillStyle = s.removeBg.bg === 'white' ? '#ffffff' : s.removeBg.color;
      fx.fillRect(0, 0, f.width, f.height);
      fx.drawImage(c, 0, 0);
      c = f;
    }
  }

  if (s.resize) {
    const t = resizeTarget(origW, origH, s.resize);
    c = resize(c, t.w * k, t.h * k, t.fit);
  }

  if (o.maxDim && !o.preview && Math.max(c.width, c.height) > o.maxDim) {
    const m = o.maxDim / Math.max(c.width, c.height);
    c = resize(c, c.width * m, c.height * m, 'stretch');
  }

  if (s.border) c = border(c, s.border, k);
  if (s.watermark && !o.noWatermark) drawWatermark(c, s.watermark, o.logo);

  if (o.preview && Math.max(c.width, c.height) > o.preview) {
    const m = o.preview / Math.max(c.width, c.height);
    c = resize(c, c.width * m, c.height * m, 'stretch');
  }
  return c;
}

/** True when any pixel in the canvas is not fully opaque. */
export function hasAlpha(c: HTMLCanvasElement) {
  const step = Math.max(1, Math.floor((c.width * c.height) / 40000));
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4 * step) if (d[i] < 255) return true;
  return false;
}
