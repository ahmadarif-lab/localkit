import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { PageNumberOpts, Position, WatermarkOpts } from '../types';
import { anchor } from './raster';

/**
 * Vector stamps for PDF output: watermark (text or logo) and page numbers.
 * Positions are computed in the page as it is DISPLAYED (after /Rotate), then
 * mapped back to the page's own coordinate system.
 */

function hexToRgb(hex: string) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  const [r, g, b] = m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) : [0.5, 0.5, 0.5];
  return rgb(r, g, b);
}

/** The standard PDF fonts only cover WinAnsi; replace anything else. */
const winAnsi = (s: string) => s.replace(/[^\x20-\x7e -ÿ–—‘’“”•…€]/g, '?');

interface View {
  w: number;
  h: number;
  /** display point → page point */
  map: (x: number, y: number) => { x: number; y: number };
  rot: number;
}

function view(page: PDFPage): View {
  const { width: W, height: H } = page.getSize();
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  switch (rot) {
    case 90:
      return { w: H, h: W, rot, map: (x, y) => ({ x: W - y, y: x }) };
    case 180:
      return { w: W, h: H, rot, map: (x, y) => ({ x: W - x, y: H - y }) };
    case 270:
      return { w: H, h: W, rot, map: (x, y) => ({ x: y, y: H - x }) };
    default:
      return { w: W, h: H, rot: 0, map: (x, y) => ({ x, y }) };
  }
}

/** pdf-lib draws from the bottom-left corner and rotates around it. */
function originFor(cx: number, cy: number, w: number, h: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  const dx = (w / 2) * Math.cos(a) - (h / 2) * Math.sin(a);
  const dy = (w / 2) * Math.sin(a) + (h / 2) * Math.cos(a);
  return { x: cx - dx, y: cy - dy };
}

/** top-left based 3×3 position → bottom-left based display coordinates */
function place(pos: Position, v: View, iw: number, ih: number, margin: number) {
  const p = anchor(pos, v.w, v.h, iw, ih, margin);
  return { x: p.x, y: v.h - p.y };
}

function stamp(v: View, cx: number, cy: number, w: number, h: number, angle: number, draw: (x: number, y: number, rot: number) => void) {
  const o = originFor(cx, cy, w, h, angle);
  const p = v.map(o.x, o.y);
  draw(p.x, p.y, angle + v.rot);
}

export async function stampWatermark(doc: PDFDocument, wm: WatermarkOpts, logoBytes?: { bytes: Uint8Array; png: boolean } | null) {
  let font: PDFFont | null = null;
  let img: PDFImage | null = null;
  const text = winAnsi(wm.text.trim());
  if (wm.kind === 'image') {
    if (!logoBytes) return;
    img = logoBytes.png ? await doc.embedPng(logoBytes.bytes) : await doc.embedJpg(logoBytes.bytes);
  } else {
    if (!text) return;
    font = await doc.embedFont(StandardFonts.HelveticaBold);
  }
  const color = hexToRgb(wm.color);
  const opacity = Math.max(0, Math.min(1, wm.opacity / 100));

  for (const page of doc.getPages()) {
    const v = view(page);
    const short = Math.min(v.w, v.h);
    let iw: number;
    let ih: number;
    let size = 0;
    if (img) {
      iw = (v.w * wm.size) / 100;
      ih = (iw * img.height) / img.width;
    } else {
      size = Math.max(6, (short * wm.size) / 100);
      iw = font!.widthOfTextAtSize(text, size);
      ih = font!.heightAtSize(size, { descender: false });
    }
    const draw = (x: number, y: number, rot: number) =>
      img
        ? page.drawImage(img, { x, y, width: iw, height: ih, rotate: degrees(rot), opacity })
        : page.drawText(text, { x, y, size, font: font!, color, opacity, rotate: degrees(rot) });

    if (wm.tile) {
      const stepX = iw * 1.6 + short * 0.04;
      const stepY = ih * 3.2 + short * 0.04;
      const diag = Math.hypot(v.w, v.h);
      const a = (wm.rotation * Math.PI) / 180;
      for (let yy = -diag / 2; yy <= diag / 2; yy += stepY) {
        const shift = (Math.round(yy / stepY) % 2) * (stepX / 2);
        for (let xx = -diag / 2 - shift; xx <= diag / 2; xx += stepX) {
          // grid rotated around the page centre
          const cx = v.w / 2 + xx * Math.cos(a) - yy * Math.sin(a);
          const cy = v.h / 2 + xx * Math.sin(a) + yy * Math.cos(a);
          stamp(v, cx, cy, iw, ih, wm.rotation, draw);
        }
      }
    } else {
      const c = place(wm.position, v, iw, ih, short * 0.04);
      stamp(v, c.x, c.y, iw, ih, wm.rotation, draw);
    }
  }
}

export async function stampPageNumbers(doc: PDFDocument, o: PageNumberOpts, label: (n: number, total: number) => string) {
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length + o.start - 1;
  pages.forEach((page, i) => {
    const v = view(page);
    const text = winAnsi(label(i + o.start, total));
    const w = font.widthOfTextAtSize(text, o.size);
    const h = font.heightAtSize(o.size, { descender: false });
    const margin = Math.max(18, Math.min(v.w, v.h) * 0.045);
    const pos = (o.position[0] + o.position[1]) as Position;
    const c = place(pos, v, w, h, margin);
    stamp(v, c.x, c.y, w, h, 0, (x, y, rot) =>
      page.drawText(text, { x, y, size: o.size, font, color: rgb(0.25, 0.25, 0.25), rotate: degrees(rot) }),
    );
  });
}
