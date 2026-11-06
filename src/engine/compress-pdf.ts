import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  type PDFObject,
} from 'pdf-lib';
import { unzlibSync, zlibSync } from 'fflate';
import type { CompressParams } from './levels';
import { canvasToBlob, blobBytes, tick } from './images';

const N = PDFName.of;
const MIN_IMAGE_BYTES = 12 * 1024;

function nameOf(o: PDFObject | undefined) {
  return o instanceof PDFName ? o.decodeText() : undefined;
}

function filterList(dict: PDFDict): string[] | null {
  const f = dict.lookup(N('Filter'));
  if (!f) return [];
  if (f instanceof PDFName) return [f.decodeText()];
  if (f instanceof PDFArray) {
    const out: string[] = [];
    for (let i = 0; i < f.size(); i++) {
      const n = nameOf(f.lookup(i));
      if (!n) return null;
      out.push(n);
    }
    return out;
  }
  return null;
}

/** 1 (gray) or 3 (RGB) for colour spaces we can safely re-encode, otherwise null. */
function channelCount(dict: PDFDict): 1 | 3 | null {
  const cs = dict.lookup(N('ColorSpace'));
  const simple = nameOf(cs);
  if (simple === 'DeviceRGB') return 3;
  if (simple === 'DeviceGray') return 1;
  if (cs instanceof PDFArray && cs.size() >= 2) {
    const kind = nameOf(cs.lookup(0));
    if (kind === 'CalRGB') return 3;
    if (kind === 'CalGray') return 1;
    if (kind === 'ICCBased') {
      const profile = cs.lookup(1);
      if (profile instanceof PDFRawStream) {
        const n = profile.dict.lookup(N('N'));
        if (n instanceof PDFNumber && (n.asNumber() === 3 || n.asNumber() === 1)) return n.asNumber() as 1 | 3;
      }
    }
  }
  return null;
}

function num(dict: PDFDict | undefined, key: string, fallback: number) {
  const v = dict?.lookup(N(key));
  return v instanceof PDFNumber ? v.asNumber() : fallback;
}

/** Reverses PNG row predictors (DecodeParms /Predictor >= 10). */
function unpredictPng(data: Uint8Array, columns: number, bpp: number): Uint8Array | null {
  const rowLen = columns * bpp;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = r * (rowLen + 1) + 1;
    const dst = r * rowLen;
    const prev = dst - rowLen;
    for (let i = 0; i < rowLen; i++) {
      const x = data[src + i];
      const a = i >= bpp ? out[dst + i - bpp] : 0;
      const b = r > 0 ? out[prev + i] : 0;
      const c = r > 0 && i >= bpp ? out[prev + i - bpp] : 0;
      let v: number;
      switch (type) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: return null;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

function ascii85(input: Uint8Array): Uint8Array {
  // every "z" expands one character into four zero bytes
  let zeros = 0;
  for (let k = 0; k < input.length; k++) if (input[k] === 0x7a) zeros++;
  const out = new Uint8Array(Math.ceil((input.length * 4) / 5) + zeros * 4 + 4);
  let n = 0;
  let tuple = 0;
  let count = 0;
  let i = input[0] === 0x3c && input[1] === 0x7e ? 2 : 0; // optional "<~"
  for (; i < input.length; i++) {
    const c = input[i];
    if (c === 0x7e) break; // "~>"
    if (c === 0x7a && count === 0) {
      out[n++] = 0; out[n++] = 0; out[n++] = 0; out[n++] = 0;
      continue;
    }
    if (c < 0x21 || c > 0x75) continue; // whitespace
    tuple = tuple * 85 + (c - 33);
    if (++count === 5) {
      out[n++] = (tuple >>> 24) & 255; out[n++] = (tuple >>> 16) & 255;
      out[n++] = (tuple >>> 8) & 255; out[n++] = tuple & 255;
      tuple = count = 0;
    }
  }
  if (count > 1) {
    for (let k = count; k < 5; k++) tuple = tuple * 85 + 84;
    const tail = [(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255];
    for (let k = 0; k < count - 1; k++) out[n++] = tail[k];
  }
  return out.subarray(0, n);
}

function asciiHex(input: Uint8Array): Uint8Array {
  const hex = new TextDecoder().decode(input).replace(/>.*$/s, '').replace(/[^0-9a-f]/gi, '');
  const out = new Uint8Array(Math.ceil(hex.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2).padEnd(2, '0'), 16);
  return out;
}

/** Runs the filter chain. Ends either with JPEG bytes or with raw samples. */
function decodeChain(data: Uint8Array, filters: string[], parms: PDFDict | undefined, ch: number, w: number) {
  let b = data;
  for (let i = 0; i < filters.length; i++) {
    const f = filters[i];
    if (f === 'ASCII85Decode' || f === 'A85') b = ascii85(b);
    else if (f === 'ASCIIHexDecode' || f === 'AHx') b = asciiHex(b);
    else if (f === 'FlateDecode' || f === 'Fl') {
      b = unzlibSync(b);
      const predictor = num(parms, 'Predictor', 1);
      if (predictor >= 10) {
        const un = unpredictPng(b, num(parms, 'Columns', w), num(parms, 'Colors', ch));
        if (!un) return null;
        b = un;
      } else if (predictor !== 1) return null;
    } else if ((f === 'DCTDecode' || f === 'DCT') && i === filters.length - 1) {
      return { bytes: b, jpeg: true };
    } else return null;
  }
  return { bytes: b, jpeg: false };
}

async function decodeImageStream(stream: PDFRawStream, filters: string[], w: number, h: number) {
  const dict = stream.dict;
  const ch = channelCount(dict)!;
  const p = dict.lookup(N('DecodeParms'));
  // DecodeParms may be an array aligned with the filters; only the Flate entry matters
  let parms: PDFDict | undefined = p instanceof PDFDict ? p : undefined;
  if (p instanceof PDFArray) {
    const idx = filters.findIndex((f) => f === 'FlateDecode' || f === 'Fl');
    const entry = idx >= 0 ? p.lookup(idx) : undefined;
    parms = entry instanceof PDFDict ? entry : undefined;
  }
  const decoded = decodeChain(stream.contents, filters, parms, ch, w);
  if (!decoded) return null;
  if (decoded.jpeg) {
    return createImageBitmap(new Blob([decoded.bytes as BlobPart], { type: 'image/jpeg' }), { imageOrientation: 'none' });
  }
  const raw = decoded.bytes;
  if (raw.length < w * h * ch) return null;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += ch) {
    const o = i * 4;
    if (ch === 1) rgba[o] = rgba[o + 1] = rgba[o + 2] = raw[j];
    else { rgba[o] = raw[j]; rgba[o + 1] = raw[j + 1]; rgba[o + 2] = raw[j + 2]; }
    rgba[o + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, w, h));
}

export interface CompressStats {
  images: number;
  replaced: number;
}

/**
 * Lossy pass that keeps text and vectors intact: every sizeable raster image
 * is downscaled to `maxDim` and re-encoded as JPEG, but only when that is
 * actually smaller. Uncompressed content streams get deflated losslessly.
 */
export async function recompressPdf(
  doc: PDFDocument,
  params: CompressParams,
  onImage?: (done: number, total: number) => void,
): Promise<CompressStats> {
  const ctx = doc.context;
  const objects = ctx.enumerateIndirectObjects();

  // soft masks are images too, but must stay lossless
  const masks = new Set<PDFRef>();
  for (const [, obj] of objects) {
    if (!(obj instanceof PDFRawStream)) continue;
    const sm = obj.dict.get(N('SMask'));
    if (sm instanceof PDFRef) masks.add(sm);
  }

  const candidates: [PDFRef, PDFRawStream][] = [];
  for (const [ref, obj] of objects) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    const subtype = nameOf(d.lookup(N('Subtype')));
    const type = nameOf(d.lookup(N('Type')));
    if (subtype === 'Image') {
      if (!masks.has(ref)) candidates.push([ref, obj]);
      continue;
    }
    // lossless: deflate streams that were stored uncompressed
    if (type === 'XRef' || type === 'ObjStm' || type === 'Metadata') continue;
    if (d.has(N('Filter')) || obj.contents.length < 512) continue;
    const packed = zlibSync(obj.contents, { level: 9 });
    if (packed.length < obj.contents.length) {
      const entries: Record<string, PDFObject> = {};
      for (const [k, v] of d.entries()) entries[k.decodeText()] = v;
      delete entries.Length;
      ctx.assign(ref, ctx.stream(packed, { ...entries, Filter: 'FlateDecode' }));
    }
  }

  const stats: CompressStats = { images: candidates.length, replaced: 0 };
  let done = 0;
  for (const [ref, stream] of candidates) {
    onImage?.(done++, candidates.length);
    try {
      const d = stream.dict;
      if (stream.contents.length < MIN_IMAGE_BYTES) continue;
      if (d.lookup(N('ImageMask'))?.toString() === 'true') continue;
      if (d.has(N('Decode'))) continue;
      if (d.lookup(N('Mask')) instanceof PDFArray) continue; // colour-key masking breaks with lossy colours
      if (num(d, 'BitsPerComponent', 8) !== 8) continue;
      if (!channelCount(d)) continue;
      const filters = filterList(d);
      if (!filters) continue;
      const w = num(d, 'Width', 0);
      const h = num(d, 'Height', 0);
      if (!w || !h) continue;
      const bmp = await decodeImageStream(stream, filters, w, h);
      if (!bmp) continue;

      const scale = Math.min(1, params.maxDim / Math.max(w, h));
      const nw = Math.max(1, Math.round(w * scale));
      const nh = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const c2d = canvas.getContext('2d')!;
      c2d.imageSmoothingQuality = 'high';
      c2d.drawImage(bmp, 0, 0, nw, nh);
      bmp.close();
      const jpeg = await blobBytes(await canvasToBlob(canvas, 'image/jpeg', params.quality));
      canvas.width = canvas.height = 0;
      if (jpeg.length >= stream.contents.length * 0.92) continue;

      const keep: Record<string, PDFObject> = {};
      for (const key of ['SMask', 'Mask', 'Intent', 'Interpolate', 'Alternates', 'OC', 'Metadata', 'Name', 'StructParent']) {
        const v = d.get(N(key));
        if (v) keep[key] = v;
      }
      ctx.assign(
        ref,
        ctx.stream(jpeg, {
          ...keep,
          Type: 'XObject',
          Subtype: 'Image',
          Width: nw,
          Height: nh,
          BitsPerComponent: 8,
          ColorSpace: 'DeviceRGB',
          Filter: 'DCTDecode',
        }),
      );
      stats.replaced++;
    } catch {
      // leave images we cannot decode untouched
    }
    if (done % 4 === 0) await tick();
  }
  onImage?.(candidates.length, candidates.length);
  return stats;
}
