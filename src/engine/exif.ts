/**
 * Image metadata: a small reader (camera, dates, GPS, software, text chunks)
 * and lossless strippers for JPEG, PNG and WebP. Pixels are never re-encoded;
 * only metadata segments are dropped. JPEG orientation is kept in a minimal
 * EXIF block so photos do not turn sideways.
 */

export interface MetaSummary {
  camera?: string;
  date?: string;
  software?: string;
  gps?: { lat: number; lon: number };
  /** other text/metadata entries found (XMP, IPTC, PNG text, comments …) */
  extra: string[];
  /** true when there is anything worth removing */
  any: boolean;
}

const ascii = (b: Uint8Array, s: number, n: number) => {
  let out = '';
  for (let i = 0; i < n && s + i < b.length; i++) {
    const c = b[s + i];
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out.trim();
};

/** Parses a TIFF/EXIF block (starting at the "II"/"MM" byte order mark). */
function parseTiff(b: Uint8Array, t: number, out: MetaSummary) {
  const le = b[t] === 0x49;
  const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (le ? (u16(o) | (u16(o + 2) << 16)) >>> 0 : ((u16(o) << 16) | u16(o + 2)) >>> 0);
  const tags = (ifd: number) => {
    const m = new Map<number, { type: number; count: number; off: number }>();
    if (ifd <= 0 || t + ifd + 2 > b.length) return m;
    const n = u16(t + ifd);
    for (let i = 0; i < n; i++) {
      const e = t + ifd + 2 + i * 12;
      if (e + 12 > b.length) break;
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = ({ 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 } as Record<number, number>)[type] ?? 1;
      const off = size * count > 4 ? t + u32(e + 8) : e + 8;
      m.set(u16(e), { type, count, off });
    }
    return m;
  };
  const str = (m: Map<number, { count: number; off: number }>, tag: number) => {
    const v = m.get(tag);
    return v ? ascii(b, v.off, v.count) : undefined;
  };
  const rational = (o: number) => {
    const d = u32(o + 4);
    return d ? u32(o) / d : 0;
  };
  const ifd0 = tags(u32(t + 4));
  const make = str(ifd0, 0x010f);
  const model = str(ifd0, 0x0110);
  if (make || model) out.camera = model && make && model.startsWith(make) ? model : [make, model].filter(Boolean).join(' ');
  out.software = str(ifd0, 0x0131) || undefined;
  let date = str(ifd0, 0x0132);
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr) {
    const ex = tags(u32(exifPtr.off));
    date = str(ex, 0x9003) || date;
    const lens = str(ex, 0xa434);
    if (lens) out.extra.push(lens);
  }
  if (date) out.date = date.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const gpsPtr = ifd0.get(0x8825);
  if (gpsPtr) {
    const g = tags(u32(gpsPtr.off));
    const lat = g.get(2);
    const lon = g.get(4);
    if (lat && lon && lat.count >= 3 && lon.count >= 3) {
      const dms = (o: number) => rational(o) + rational(o + 8) / 60 + rational(o + 16) / 3600;
      let la = dms(lat.off);
      let lo = dms(lon.off);
      if (str(g, 1) === 'S') la = -la;
      if (str(g, 3) === 'W') lo = -lo;
      if (la || lo) out.gps = { lat: Math.round(la * 1e5) / 1e5, lon: Math.round(lo * 1e5) / 1e5 };
    }
  }
}

const isJpeg = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;
const isPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const isWebp = (b: Uint8Array) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP';

export function readMeta(b: Uint8Array): MetaSummary {
  const out: MetaSummary = { extra: [], any: false };
  try {
    if (isJpeg(b)) {
      let off = 2;
      while (off + 4 < b.length && b[off] === 0xff) {
        const marker = b[off + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const len = (b[off + 2] << 8) | b[off + 3];
        const id = ascii(b, off + 4, 30);
        if (marker === 0xe1 && id.startsWith('Exif')) parseTiff(b, off + 10, out), out.extra.push('EXIF');
        else if (marker === 0xe1) out.extra.push('XMP');
        else if (marker === 0xed) out.extra.push('IPTC');
        else if (marker === 0xfe) out.extra.push('Comment');
        off += 2 + len;
      }
    } else if (isPng(b)) {
      let off = 8;
      while (off + 12 <= b.length) {
        const len = ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
        const type = ascii(b, off + 4, 4);
        if (type === 'eXIf') parseTiff(b, off + 8, out), out.extra.push('EXIF');
        else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') out.extra.push(ascii(b, off + 8, Math.min(len, 40)) || 'Text');
        else if (type === 'tIME') out.extra.push('Time');
        if (type === 'IEND') break;
        off += 12 + len;
      }
    } else if (isWebp(b)) {
      let off = 12;
      while (off + 8 <= b.length) {
        const type = ascii(b, off, 4);
        const len = (b[off + 4] | (b[off + 5] << 8) | (b[off + 6] << 16) | (b[off + 7] << 24)) >>> 0;
        if (type === 'EXIF') {
          const start = ascii(b, off + 8, 4) === 'Exif' ? off + 14 : off + 8;
          parseTiff(b, start, out);
          out.extra.push('EXIF');
        } else if (type === 'XMP') out.extra.push('XMP');
        off += 8 + len + (len & 1);
      }
    }
  } catch {
    // malformed metadata: report what we got so far
  }
  out.extra = [...new Set(out.extra)];
  out.any = !!(out.camera || out.date || out.gps || out.software || out.extra.length);
  return out;
}

/** Minimal APP1 EXIF segment holding only the orientation tag. */
function orientationApp1(orientation: number) {
  const tiff = [0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const len = body.length + 2;
  return Uint8Array.from([0xff, 0xe1, len >> 8, len & 0xff, ...body]);
}

function stripJpeg(b: Uint8Array, orientation: number): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let off = 2;
  let insertedOrientation = orientation === 1;
  while (off + 4 <= b.length && b[off] === 0xff) {
    const marker = b[off + 1];
    if (marker === 0xda) break; // start of scan: copy the rest untouched
    const len = (b[off + 2] << 8) | b[off + 3];
    const seg = b.subarray(off, off + 2 + len);
    const id = ascii(b, off + 4, 14);
    // keep JFIF (APP0), ICC profile (APP2) and Adobe colour info (APP14); drop EXIF/XMP/IPTC/comments
    const drop = (marker === 0xe1 || marker === 0xed || marker === 0xfe || (marker >= 0xe3 && marker <= 0xef && marker !== 0xee)) && !(marker === 0xe2 && id.startsWith('ICC_PROFILE'));
    if (!drop) parts.push(seg);
    if (!insertedOrientation && (marker === 0xe0 || drop)) {
      parts.push(orientationApp1(orientation));
      insertedOrientation = true;
    }
    off += 2 + len;
  }
  if (!insertedOrientation) parts.splice(1, 0, orientationApp1(orientation));
  parts.push(b.subarray(off));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, o), (o += p.length);
  return out;
}

function stripPng(b: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let off = 8;
  while (off + 12 <= b.length) {
    const len = ((b[off] << 24) | (b[off + 1] << 16) | (b[off + 2] << 8) | b[off + 3]) >>> 0;
    const type = ascii(b, off + 4, 4);
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(type)) parts.push(b.subarray(off, off + 12 + len));
    off += 12 + len;
    if (type === 'IEND') break;
  }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) out.set(p, o), (o += p.length);
  return out;
}

function stripWebp(b: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let off = 12;
  while (off + 8 <= b.length) {
    const type = ascii(b, off, 4);
    const len = (b[off + 4] | (b[off + 5] << 8) | (b[off + 6] << 16) | (b[off + 7] << 24)) >>> 0;
    const total = 8 + len + (len & 1);
    if (type !== 'EXIF' && type !== 'XMP') {
      const c = b.slice(off, off + total);
      if (type === 'VP8X') c[8] &= ~(0x08 | 0x04); // clear EXIF + XMP flags
      chunks.push(c);
    }
    off += total;
  }
  const size = 4 + chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(8 + size);
  out.set(b.subarray(0, 4), 0);
  out[4] = size & 255;
  out[5] = (size >> 8) & 255;
  out[6] = (size >> 16) & 255;
  out[7] = (size >> 24) & 255;
  out.set(b.subarray(8, 12), 8);
  let o = 12;
  for (const c of chunks) out.set(c, o), (o += c.length);
  return out;
}

/**
 * Losslessly removes metadata. Returns null for formats it cannot handle
 * (the caller re-encodes those, which also drops metadata).
 */
export function stripMeta(b: Uint8Array, jpegOrientation = 1): Uint8Array | null {
  if (isJpeg(b)) return stripJpeg(b, jpegOrientation);
  if (isPng(b)) return stripPng(b);
  if (isWebp(b)) return stripWebp(b);
  return null;
}
