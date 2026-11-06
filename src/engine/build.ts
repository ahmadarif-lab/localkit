import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';
import { zipSync } from 'fflate';
import type { PageItem, Result, RunOutput, Settings, Source } from '../types';
import { compressParams, LOSSLESS_RASTER, type CompressParams } from './levels';
import { renderPage, sourceBytes } from './pdfjs';
import { blobBytes, canvasToBlob, decodeImage, drawBitmap, jpegOrientation, tick } from './images';
import { recompressPdf } from './compress-pdf';
import { chunk, parseRanges } from './ranges';
import { extFor, outputType, pad, safeName, stripExt } from './names';
import { hasAlpha, hasPixelOps, renderRaster } from './raster';
import { stripMeta } from './exif';
import { stampPageNumbers, stampWatermark } from './pdf-stamp';
import { encodeAnimatedGif, encodeGif } from './gif';
import { t } from '../i18n';

export interface Progress {
  done: number;
  total: number;
  key: string;
  vars?: Record<string, string | number>;
}

export interface Group {
  pages: PageItem[];
  /** file name including extension */
  name: string;
}

interface Ctx {
  s: Settings;
  sources: Map<string, Source>;
  params: CompressParams | null;
  rasterAll: boolean;
  libDocs: Map<string, Promise<PDFDocument | null>>;
  prepared: Map<string, Promise<Prepared>>;
  warnings: Set<string>;
  /** sources whose pages were rasterised */
  rastered: Set<string>;
  logo: ImageBitmap | null;
  logoBytes: { bytes: Uint8Array; png: boolean } | null;
  report: (key: string, vars?: Progress['vars']) => void;
  step: () => void;
}

interface Prepared {
  bytes: Uint8Array<ArrayBufferLike>;
  type: 'jpg' | 'png';
  w: number;
  h: number;
  /** rotation/flip are already baked into the pixels */
  baked?: boolean;
}

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGINS = { none: 0, small: 18, large: 36 } as const;


const isJpegBytes = (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8;
const isPngBytes = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

function libDoc(ctx: Ctx, src: Source) {
  let p = ctx.libDocs.get(src.id);
  if (!p) {
    p = (async () => {
      if (src.password) {
        ctx.warnings.add('warn-encrypted');
        return null;
      }
      try {
        return await PDFDocument.load(await sourceBytes(src), { updateMetadata: false });
      } catch (e: any) {
        ctx.warnings.add(/encrypt/i.test(String(e?.message ?? e)) ? 'warn-encrypted' : 'warn-broken');
        return null;
      }
    })();
    ctx.libDocs.set(src.id, p);
  }
  return p;
}

/** Image → bytes pdf-lib can embed, honouring EXIF rotation, image operations and compression. */
function prepareImage(ctx: Ctx, src: Source, pg: PageItem) {
  const ops = hasPixelOps(ctx.s, pg);
  const key = ops ? `${src.id}|${pg.rotation}|${pg.flipH}|${pg.flipV}|${JSON.stringify(pg.crop ?? null)}` : src.id;
  let p = ctx.prepared.get(key);
  if (!p) {
    p = (async (): Promise<Prepared> => {
      if (ops) {
        const c = await renderRaster(src, pg, ctx.s, { dpi: 150, maxDim: ctx.params?.maxDim, noWatermark: true });
        const png = hasAlpha(c);
        const bytes = await blobBytes(await canvasToBlob(c, png ? 'image/png' : 'image/jpeg', ctx.params?.quality ?? 0.92));
        const r = { bytes, type: png ? 'png' : 'jpg', w: c.width, h: c.height, baked: true } as Prepared;
        c.width = c.height = 0;
        return r;
      }
      const bytes = await sourceBytes(src);
      const w0 = src.width ?? 0;
      const h0 = src.height ?? 0;
      const upright = isJpegBytes(bytes) && jpegOrientation(bytes) === 1;
      const params = ctx.params;
      if (!params) {
        // embedded JPEGs keep their EXIF otherwise (camera, GPS …)
        if (upright) return { bytes: (ctx.s.stripMeta && stripMeta(bytes)) || bytes, type: 'jpg', w: w0, h: h0 };
        if (isPngBytes(bytes)) return { bytes, type: 'png', w: w0, h: h0 };
      }
      const bmp = await decodeImage(src.file);
      const lossyOk = params || isJpegBytes(bytes) || /webp|avif|hei[cf]/i.test(src.file.type + src.name);
      const canvas = drawBitmap(bmp, { maxDim: params?.maxDim, background: lossyOk ? '#ffffff' : undefined });
      bmp.close();
      const type = lossyOk ? 'jpg' : 'png';
      let out: Uint8Array = await blobBytes(
        await canvasToBlob(canvas, type === 'jpg' ? 'image/jpeg' : 'image/png', params?.quality ?? 0.92),
      );
      const w = canvas.width;
      const h = canvas.height;
      canvas.width = canvas.height = 0;
      // re-encoding a small, already-compressed JPEG can make it bigger
      if (upright && out.length >= bytes.length && w === w0 && h === h0) out = bytes;
      return { bytes: out, type, w, h };
    })();
    ctx.prepared.set(key, p);
  }
  return p;
}

function imageLayout(w: number, h: number, s: Settings) {
  const m = MARGINS[s.margin];
  if (s.pageSize === 'fit') {
    const k = 842 / Math.max(w, h);
    const dw = w * k;
    const dh = h * k;
    return { pw: dw + 2 * m, ph: dh + 2 * m, x: m, y: m, dw, dh };
  }
  let [pw, ph]: number[] = [...PAGE_SIZES[s.pageSize]];
  const landscape = s.orientation === 'landscape' || (s.orientation === 'auto' && w > h);
  if (landscape) [pw, ph] = [ph, pw];
  const k = Math.min((pw - 2 * m) / w, (ph - 2 * m) / h);
  const dw = w * k;
  const dh = h * k;
  return { pw, ph, x: (pw - dw) / 2, y: (ph - dh) / 2, dw, dh };
}

async function rasterPage(ctx: Ctx, out: PDFDocument, src: Source, page: PageItem) {
  ctx.rastered.add(src.id);
  const p = ctx.params ?? LOSSLESS_RASTER;
  const { canvas, pointWidth, pointHeight } = await renderPage(src, page.index, {
    scale: p.dpi / 72,
    rotation: page.rotation,
    maxDim: p.maxDim,
  });
  const jpeg = await blobBytes(await canvasToBlob(canvas, 'image/jpeg', p.quality));
  canvas.width = canvas.height = 0;
  const img = await out.embedJpg(jpeg);
  const pg = out.addPage([pointWidth, pointHeight]);
  pg.drawImage(img, { x: 0, y: 0, width: pointWidth, height: pointHeight });
}

async function buildPdf(ctx: Ctx, pages: PageItem[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.setProducer('Localkit');
  out.setCreator('Localkit');

  // Copy all vector pages of one source in a single call so shared fonts and
  // images are copied once instead of once per page.
  const wanted = new Map<string, number[]>();
  for (const pg of pages) {
    const src = ctx.sources.get(pg.sourceId)!;
    if (src.kind !== 'pdf' || ctx.rasterAll) continue;
    const doc = await libDoc(ctx, src);
    if (!doc) continue;
    let list = wanted.get(src.id);
    if (!list) wanted.set(src.id, (list = []));
    list.push(pg.index);
  }
  const copied = new Map<string, PDFPage[]>();
  for (const [id, idx] of wanted) {
    const doc = (await libDoc(ctx, ctx.sources.get(id)!))!;
    copied.set(id, await out.copyPages(doc, idx));
  }

  for (const pg of pages) {
    const src = ctx.sources.get(pg.sourceId)!;
    ctx.report('progress-page', { name: src.name });
    if (src.kind === 'pdf') {
      const list = copied.get(src.id);
      if (list?.length) {
        const page = out.addPage(list.shift()!);
        if (pg.rotation) page.setRotation(degrees((page.getRotation().angle + pg.rotation) % 360));
      } else {
        await rasterPage(ctx, out, src, pg);
      }
    } else {
      const prep = await prepareImage(ctx, src, pg);
      const img = prep.type === 'jpg' ? await out.embedJpg(prep.bytes) : await out.embedPng(prep.bytes);
      const L = imageLayout(img.width, img.height, ctx.s);
      const page = out.addPage([L.pw, L.ph]);
      page.drawImage(img, { x: L.x, y: L.y, width: L.dw, height: L.dh });
      if (pg.rotation && !prep.baked) page.setRotation(degrees(pg.rotation));
    }
    ctx.step();
    await tick();
  }

  if (ctx.params && !ctx.rasterAll) {
    await recompressPdf(out, ctx.params, (d, t) => ctx.report('progress-images', { done: d, total: t }));
  }
  if (ctx.s.watermark) await stampWatermark(out, ctx.s.watermark, ctx.logoBytes);
  if (ctx.s.pageNumbers) {
    const f = ctx.s.pageNumbers.format;
    await stampPageNumbers(out, ctx.s.pageNumbers, (n, total) =>
      f === 'n' ? `${n}` : f === 'n-of-total' ? `${n} / ${total}` : t('pn.label', { n }),
    );
  }
  ctx.report('progress-save');
  return out.save({ useObjectStreams: true });
}

async function encode(ctx: Ctx, c: HTMLCanvasElement, type: ReturnType<typeof outputType>): Promise<Blob> {
  if (type === 'gif') return encodeGif(c);
  if (type === 'jpeg' && hasAlpha(c)) {
    // JPEG has no transparency: put it on white instead of black
    const f = document.createElement('canvas');
    f.width = c.width;
    f.height = c.height;
    const x = f.getContext('2d')!;
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, f.width, f.height);
    x.drawImage(c, 0, 0);
    c = f;
  }
  const mime = `image/${type}`;
  const q = ctx.params?.quality ?? 0.92;
  let blob = await canvasToBlob(c, mime, q);
  if (blob.type !== mime) {
    // Safari cannot encode WebP and silently returns PNG
    ctx.warnings.add('warn-webp');
    blob = await canvasToBlob(c, 'image/jpeg', q);
  }
  return blob;
}

async function buildImage(ctx: Ctx, pg: PageItem): Promise<{ blob: Blob; unchanged?: boolean }> {
  const src = ctx.sources.get(pg.sourceId)!;
  const type = outputType(ctx.s, src);
  const params = ctx.params;
  ctx.report('progress-page', { name: src.name });

  let original: Blob | null = null;
  if (src.kind === 'image' && src.file.type === `image/${type}` && !hasPixelOps(ctx.s, pg) && !ctx.s.watermark && !pg.rotation) {
    const bytes = await sourceBytes(src);
    const orientation = type === 'jpeg' ? jpegOrientation(bytes) : 1;
    const stripped = ctx.s.stripMeta ? stripMeta(bytes, orientation) : null;
    original = stripped ? new Blob([stripped as BlobPart], { type: src.file.type }) : src.file;
    if (!params && orientation === 1) return { blob: original, unchanged: !stripped || stripped.length === bytes.length };
  }

  const c = await renderRaster(src, pg, ctx.s, { dpi: ctx.s.dpi, maxDim: params?.maxDim, logo: ctx.logo });
  const blob = await encode(ctx, c, type);
  c.width = c.height = 0;
  // re-encoding can make an already small file bigger
  if (original && blob.size >= original.size) return { blob: original, unchanged: true };
  return { blob };
}

export function plan(pages: PageItem[], s: Settings, sources: Map<string, Source>): Group[] {
  const first = sources.get(pages[0]?.sourceId);
  const base = safeName(s.fileName.trim() || (first ? stripExt(first.name) : 'localkit'));
  switch (s.output) {
    case 'pdf':
      return [{ pages, name: `${base}.pdf` }];
    case 'per-source': {
      const by = new Map<string, PageItem[]>();
      for (const p of pages) {
        if (!by.has(p.sourceId)) by.set(p.sourceId, []);
        by.get(p.sourceId)!.push(p);
      }
      return [...by].map(([id, ps]) => ({ pages: ps, name: `${safeName(stripExt(sources.get(id)!.name))}.pdf` }));
    }
    case 'split': {
      if (s.splitMode === 'each') return pages.map((p, i) => ({ pages: [p], name: `${base}-${pad(i + 1, pages.length)}.pdf` }));
      if (s.splitMode === 'chunk') {
        let start = 1;
        return chunk(pages, s.chunk).map((ps) => {
          const name = `${base}-${start}-${start + ps.length - 1}.pdf`;
          start += ps.length;
          return { pages: ps, name };
        });
      }
      const r = parseRanges(s.ranges, pages.length);
      if (r.error) throw new Error('ranges');
      return r.groups.map((g, i) => ({ pages: g.map((n) => pages[n]), name: `${base}-${r.labels[i]}.pdf` }));
    }
    case 'images':
      return pages.map((p, i) => {
        const src = sources.get(p.sourceId)!;
        const ext = extFor(outputType(s, src));
        const name = s.fileName.trim()
          ? `${base}-${pad(i + 1, pages.length)}`
          : `${safeName(stripExt(src.name))}${src.pageCount > 1 ? `-${pad(p.index + 1, src.pageCount)}` : ''}`;
        return { pages: [p], name: `${name}.${ext}` };
      });
  }
}

function dedupe(results: Result[]) {
  const seen = new Map<string, number>();
  for (const r of results) {
    const n = seen.get(r.name) ?? 0;
    seen.set(r.name, n + 1);
    if (n) r.name = r.name.replace(/(\.[a-z0-9]+)$/i, `-${n + 1}$1`);
  }
}

/** True when the group is a whole source, untouched and in its natural order. */
function isWholeSource(g: PageItem[], sources: Map<string, Source>) {
  const src = sources.get(g[0]?.sourceId);
  return (
    !!src &&
    src.kind === 'pdf' &&
    g.length === src.pageCount &&
    g.every((p, i) => p.sourceId === src.id && p.index === i && p.rotation === 0)
  );
}

export function run(
  pages: PageItem[],
  sources: Map<string, Source>,
  s: Settings,
  onProgress: (p: Progress) => void,
  extra: { logo?: File | null } = {},
) {
  return runGroups(plan(pages, s, sources), sources, s, onProgress, extra);
}

/** Produces one file per group. `s.output === 'images'` turns each group's single page into an image. */
export async function runGroups(
  groups: Group[],
  sources: Map<string, Source>,
  s: Settings,
  onProgress: (p: Progress) => void,
  extra: { logo?: File | null } = {},
): Promise<RunOutput> {
  const params = compressParams(s);
  let logo: ImageBitmap | null = null;
  let logoBytes: Ctx['logoBytes'] = null;
  if (s.watermark?.kind === 'image' && extra.logo) {
    logo = await decodeImage(extra.logo);
    const raw = new Uint8Array(await extra.logo.arrayBuffer());
    if (isPngBytes(raw) || isJpegBytes(raw)) logoBytes = { bytes: raw, png: isPngBytes(raw) };
    else {
      const c = drawBitmap(logo);
      logoBytes = { bytes: await blobBytes(await canvasToBlob(c, 'image/png')), png: true };
    }
  }
  const pages = groups.flatMap((g) => g.pages);
  const total = groups.reduce((n, g) => n + g.pages.length, 0);
  let done = 0;
  let current: Pick<Progress, 'key' | 'vars'> = { key: 'progress-start' };
  const ctx: Ctx = {
    s,
    sources,
    params,
    rasterAll: !!params && s.pdfMode === 'raster',
    libDocs: new Map(),
    prepared: new Map(),
    warnings: new Set(),
    rastered: new Set(),
    logo,
    logoBytes,
    report: (key, vars) => {
      current = { key, vars };
      onProgress({ done, total, ...current });
    },
    step: () => {
      done++;
      onProgress({ done, total, ...current });
    },
  };

  const results: Result[] = [];
  if (s.output === 'images' && s.imageFormat === 'gif' && s.animate && groups.length) {
    const frames: HTMLCanvasElement[] = [];
    for (const g of groups) {
      const src = sources.get(g.pages[0].sourceId)!;
      ctx.report('progress-page', { name: src.name });
      frames.push(await renderRaster(src, g.pages[0], s, { dpi: s.dpi, maxDim: params?.maxDim ?? 800, logo }));
      ctx.step();
      await tick();
    }
    ctx.report('progress-save');
    const blob = encodeAnimatedGif(frames, s.animate.delay);
    frames.forEach((f) => (f.width = f.height = 0));
    const base = safeName(s.fileName.trim() || stripExt(groups[0].name).replace(/-\d+$/, '') || 'animation');
    results.push({ name: `${base}.gif`, blob, kind: 'image', pages: groups.length });
    groups = [];
  }
  for (const g of groups) {
    if (s.output === 'images') {
      const { blob, unchanged } = await buildImage(ctx, g.pages[0]);
      ctx.step();
      results.push({ name: g.name, blob, kind: 'image', pages: 1, unchanged });
      await tick();
      continue;
    }
    const bytes = await buildPdf(ctx, g.pages);
    const whole = isWholeSource(g.pages, sources) ? sources.get(g.pages[0].sourceId)! : null;
    const stamped = !!(s.watermark || s.pageNumbers);
    if (whole && !stamped && !ctx.rastered.has(whole.id) && !whole.password && bytes.length >= whole.size) {
      results.push({ name: g.name, blob: whole.file, kind: 'pdf', pages: g.pages.length, unchanged: true });
    } else {
      results.push({
        name: g.name,
        blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        kind: 'pdf',
        pages: g.pages.length,
      });
    }
  }
  dedupe(results);

  const used = new Set(pages.map((p) => p.sourceId));
  const inputBytes = [...used].reduce((n, id) => n + (sources.get(id)?.size ?? 0), 0);
  return { results, inputBytes, warnings: [...ctx.warnings] };
}

export async function zipResults(results: Result[]): Promise<Blob> {
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const r of results) files[r.name] = [await blobBytes(r.blob), { level: 0 }];
  return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}
