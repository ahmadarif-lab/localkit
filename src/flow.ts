import type {
  BorderOpts,
  CompressLevel,
  ImageFormat,
  Margin,
  Orientation,
  PageItem,
  PageNumberOpts,
  PageSize,
  PdfMode,
  RemoveBgOpts,
  ResizeOpts,
  Rotation,
  Settings,
  Source,
  WatermarkOpts,
} from './types';
import { BASE_SETTINGS, DEFAULT_PAGE_NUMBERS, DEFAULT_RESIZE, DEFAULT_WATERMARK } from './tools';
import { extFor, outputType, pad, safeName, stripExt } from './engine/names';
import { parseRanges, chunk, pickPages } from './engine/ranges';
import type { Group } from './engine/build';

/**
 * A custom flow is an ordered list of steps applied to a list of documents.
 * The input gives one document per uploaded file; steps reshape documents
 * (merge, split), edit pages (rotate, remove, keep, order) or set how the
 * result is encoded (page layout, compression, convert to images, naming).
 */
export type NodeType =
  | 'rotate'
  | 'flip'
  | 'remove'
  | 'keep'
  | 'order'
  | 'layout'
  | 'merge'
  | 'split'
  | 'pageNumbers'
  | 'resize'
  | 'crop'
  | 'border'
  | 'watermark'
  | 'removeBg'
  | 'compress'
  | 'images'
  | 'rename';

export interface NodeParams {
  rotate: { angle: 90 | 180 | 270; ranges: string };
  remove: { ranges: string };
  keep: { ranges: string };
  order: { mode: 'name' | 'reverse-pages' | 'reverse-files' };
  layout: { pageSize: PageSize; orientation: Orientation; margin: Margin };
  merge: Record<string, never>;
  split: { mode: 'each' | 'ranges' | 'chunk'; ranges: string; chunk: number };
  compress: { level: Exclude<CompressLevel, 'none'>; quality: number; maxDim: number; pdfMode: PdfMode };
  images: { format: ImageFormat; dpi: number };
  rename: { pattern: string };
  flip: { h: boolean; v: boolean };
  pageNumbers: PageNumberOpts;
  resize: ResizeOpts;
  crop: { ratio: string };
  border: BorderOpts;
  watermark: WatermarkOpts;
  removeBg: RemoveBgOpts;
}

export type FlowNode = { [K in NodeType]: { id: string; type: K; p: NodeParams[K] } }[NodeType];

export const NODE_DEFAULTS: { [K in NodeType]: () => NodeParams[K] } = {
  rotate: () => ({ angle: 90, ranges: '' }),
  remove: () => ({ ranges: '' }),
  keep: () => ({ ranges: '' }),
  order: () => ({ mode: 'name' }),
  layout: () => ({ pageSize: 'a4', orientation: 'auto', margin: 'small' }),
  merge: () => ({}),
  split: () => ({ mode: 'each', ranges: '', chunk: 2 }),
  compress: () => ({ level: 'medium', quality: 75, maxDim: 1600, pdfMode: 'smart' }),
  images: () => ({ format: 'jpeg', dpi: 150 }),
  rename: () => ({ pattern: '{name}' }),
  flip: () => ({ h: true, v: false }),
  pageNumbers: () => ({ ...DEFAULT_PAGE_NUMBERS }),
  resize: () => ({ ...DEFAULT_RESIZE }),
  crop: () => ({ ratio: '1:1' }),
  border: () => ({ size: 40, unit: 'px', color: '#ffffff' }),
  watermark: () => ({ ...DEFAULT_WATERMARK }),
  removeBg: () => ({ bg: 'transparent', color: '#ffffff' }),
};

export const PALETTE: { group: string; types: NodeType[] }[] = [
  { group: 'flow.group.pages', types: ['rotate', 'flip', 'remove', 'keep', 'order'] },
  { group: 'flow.group.docs', types: ['merge', 'split', 'pageNumbers'] },
  { group: 'flow.group.image', types: ['resize', 'crop', 'border', 'watermark', 'removeBg'] },
  { group: 'flow.group.format', types: ['compress', 'layout', 'images', 'rename'] },
];

export const newNode = (type: NodeType): FlowNode =>
  ({ id: Math.random().toString(36).slice(2, 10), type, p: NODE_DEFAULTS[type]() }) as FlowNode;

export interface Doc {
  name: string;
  pages: PageItem[];
}

export interface Issue {
  key: string;
  vars?: Record<string, string | number>;
}

export interface NodeResult {
  docs: number;
  pages: number;
  error?: Issue;
  warn?: Issue;
}

export interface FlowEval {
  docs: Doc[];
  images: boolean;
  settings: Settings;
  input: { docs: number; pages: number };
  nodes: NodeResult[];
  groups: Group[];
  ok: boolean;
}

const countPages = (docs: Doc[]) => docs.reduce((n, d) => n + d.pages.length, 0);

/** Pure: computes what the flow will produce, without touching any file data. */
export function evaluate(nodes: FlowNode[], pages: PageItem[], sources: Map<string, Source>): FlowEval {
  let docs: Doc[] = [];
  const bySource = new Map<string, Doc>();
  for (const p of pages) {
    const src = sources.get(p.sourceId);
    if (!src) continue;
    let d = bySource.get(src.id);
    if (!d) {
      d = { name: stripExt(src.name), pages: [] };
      bySource.set(src.id, d);
      docs.push(d);
    }
    d.pages.push(p);
  }
  const input = { docs: docs.length, pages: countPages(docs) };
  const s: Settings = { ...BASE_SETTINGS, compress: 'none', output: 'pdf' };
  let images = false;
  const hasImagePages = () => docs.some((d) => d.pages.some((p) => sources.get(p.sourceId)?.kind === 'image'));
  const results: NodeResult[] = [];

  for (const node of nodes) {
    let error: Issue | undefined;
    let warn: Issue | undefined;
    const badRange = (token: string) => (error = { key: 'flow.err.range', vars: { token } });

    switch (node.type) {
      case 'rotate': {
        const { angle, ranges } = node.p;
        docs = docs.map((d) => {
          const pick = ranges.trim() ? pickPages(ranges, d.pages.length) : null;
          if (pick?.error) badRange(pick.error);
          return {
            ...d,
            pages: d.pages.map((p, i) =>
              !pick || pick.indices.has(i) ? { ...p, rotation: ((p.rotation + angle) % 360) as Rotation } : p,
            ),
          };
        });
        break;
      }
      case 'remove':
      case 'keep': {
        const { ranges } = node.p;
        if (!ranges.trim()) {
          error = { key: 'flow.err.needPages' };
          break;
        }
        const keep = node.type === 'keep';
        docs = docs
          .map((d) => {
            const pick = pickPages(ranges, d.pages.length);
            if (pick.error) badRange(pick.error);
            return { ...d, pages: d.pages.filter((_, i) => pick.indices.has(i) === keep) };
          })
          .filter((d) => d.pages.length);
        if (!error && !docs.length) error = { key: 'flow.err.allRemoved' };
        break;
      }
      case 'order': {
        const m = node.p.mode;
        if (m === 'name')
          docs = [...docs].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        else if (m === 'reverse-files') docs = [...docs].reverse();
        else docs = docs.map((d) => ({ ...d, pages: [...d.pages].reverse() }));
        break;
      }
      case 'layout':
        Object.assign(s, node.p);
        if (images) warn = { key: 'flow.warn.afterImages' };
        else if (docs.length && !hasImagePages()) warn = { key: 'flow.warn.noImages' };
        break;
      case 'merge':
        if (images) warn = { key: 'flow.warn.afterImages' };
        if (docs.length > 1) docs = [{ name: docs[0].name, pages: docs.flatMap((d) => d.pages) }];
        else if (docs.length) warn ??= { key: 'flow.warn.oneDoc' };
        break;
      case 'split': {
        if (images) warn = { key: 'flow.warn.afterImages' };
        const { mode } = node.p;
        const next: Doc[] = [];
        for (const d of docs) {
          const n = d.pages.length;
          if (mode === 'each') d.pages.forEach((p, i) => next.push({ name: `${d.name}-${pad(i + 1, n)}`, pages: [p] }));
          else if (mode === 'chunk') {
            let start = 1;
            for (const part of chunk(d.pages, node.p.chunk)) {
              next.push({ name: `${d.name}-${start}-${start + part.length - 1}`, pages: part });
              start += part.length;
            }
          } else {
            if (!node.p.ranges.trim()) {
              error = { key: 'flow.err.needPages' };
              break;
            }
            const r = parseRanges(node.p.ranges, n);
            if (r.error) {
              error = r.error.reason === 'bounds'
                ? { key: 'flow.err.bounds', vars: { token: r.error.token, name: d.name, total: n } }
                : { key: 'flow.err.range', vars: { token: r.error.token } };
              break;
            }
            r.groups.forEach((g, i) => next.push({ name: `${d.name}-${r.labels[i]}`, pages: g.map((k) => d.pages[k]) }));
          }
        }
        if (!error) docs = next;
        break;
      }
      case 'flip': {
        const { h, v } = node.p;
        docs = docs.map((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, flipH: h ? !p.flipH : p.flipH, flipV: v ? !p.flipV : p.flipV })) }));
        if (!images && docs.length && !hasImagePages()) warn = { key: 'flow.warn.rasterOnly' };
        break;
      }
      case 'resize':
      case 'crop':
      case 'border':
      case 'removeBg': {
        if (node.type === 'resize') s.resize = { ...node.p };
        if (node.type === 'crop') s.cropRatio = node.p.ratio;
        if (node.type === 'border') s.border = { ...node.p };
        if (node.type === 'removeBg') s.removeBg = { ...node.p };
        // pixel operations only touch rasters: image pages, or everything once converted to images
        if (!images && docs.length && !hasImagePages()) warn = { key: 'flow.warn.rasterOnly' };
        break;
      }
      case 'watermark':
        s.watermark = { ...node.p };
        break;
      case 'pageNumbers':
        s.pageNumbers = { ...node.p };
        if (images) warn = { key: 'flow.warn.afterImages' };
        break;
      case 'compress': {
        const c = node.p;
        Object.assign(s, { compress: c.level, quality: c.quality, maxDim: c.maxDim, pdfMode: c.pdfMode });
        break;
      }
      case 'images':
        if (images) warn = { key: 'flow.warn.twice' };
        images = true;
        Object.assign(s, { output: 'images', imageFormat: node.p.format, dpi: node.p.dpi });
        break;
      case 'rename': {
        const pattern = node.p.pattern.trim();
        if (!pattern) {
          error = { key: 'flow.err.needName' };
          break;
        }
        const date = new Date().toISOString().slice(0, 10);
        docs = docs.map((d, i) => ({
          ...d,
          name: safeName(
            pattern
              .replace(/\{name\}/g, d.name)
              .replace(/\{n\}/g, pad(i + 1, docs.length))
              .replace(/\{date\}/g, date),
          ),
        }));
        break;
      }
    }
    results.push({ docs: docs.length, pages: countPages(docs), error, warn });
  }

  const groups: Group[] = images
    ? docs.flatMap((d) =>
        d.pages.map((p, i) => {
          const ext = extFor(outputType(s, sources.get(p.sourceId)!));
          const name = d.pages.length > 1 ? `${d.name}-${pad(i + 1, d.pages.length)}` : d.name;
          return { pages: [p], name: `${safeName(name)}.${ext}` };
        }),
      )
    : docs.map((d) => ({ pages: d.pages, name: `${safeName(d.name)}.pdf` }));

  return {
    docs,
    images,
    settings: s,
    input,
    nodes: results,
    groups,
    ok: nodes.length > 0 && groups.length > 0 && results.every((r) => !r.error),
  };
}
