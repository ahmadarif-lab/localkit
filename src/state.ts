import { batch, computed, signal } from '@preact/signals';
import type { Crop, PageItem, Rotation, RunOutput, Settings, Source } from './types';
import { BASE_SETTINGS, toolById, toolBySlug, type ToolId } from './tools';
import { forgetSource, openPdf, PasswordError } from './engine/pdfjs';
import { decodeImage, isImageFile, isPdfFile, normalizeImage } from './engine/images';
import type { Progress } from './engine/build';
import { parseRanges } from './engine/ranges';
import { forgetThumbs } from './thumbs';
import { t } from './i18n';
import { record } from './history';
import { evaluate, newNode, type FlowNode, type NodeType } from './flow';

const COLORS = ['#e5483b', '#2f7de1', '#16a37f', '#c77d0a', '#8b5cf6', '#db2777', '#0891b2', '#65a30d'];
let colorIdx = 0;
const uid = () => Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------- routing

export type Page = 'history' | 'settings' | 'privacy' | 'terms';
export type Route = { view: 'home' } | { view: 'work'; tool: ToolId } | { view: Page };

function parseRoute(): Route {
  // path routes (/merge-pdf); old #/merge-pdf links still work
  const slug = location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '') || location.hash.replace(/^#\/?/, '');
  if (slug === 'history' || slug === 'settings' || slug === 'privacy' || slug === 'terms') return { view: slug };
  const tool = toolBySlug(slug);
  return tool ? { view: 'work', tool: tool.id } : { view: 'home' };
}

export const route = signal<Route>(parseRoute());
window.addEventListener('popstate', () => {
  const r = parseRoute();
  if (r.view === 'work' && (route.value.view !== 'work' || route.value.tool !== r.tool)) applyTool(r.tool);
  route.value = r;
});

export const activeTool = computed(() => toolById(route.value.view === 'work' ? route.value.tool : 'flow'));

// ---------------------------------------------------------------- state

export const sources = signal<Source[]>([]);
export const pages = signal<PageItem[]>([]);
export const settings = signal<Settings>({ ...BASE_SETTINGS });
export const selection = signal<Set<string>>(new Set());
export const progress = signal<Progress | null>(null);
export const output = signal<RunOutput | null>(null);
export const runError = signal<string | null>(null);

export const sourceMap = computed(() => new Map(sources.value.map((s) => [s.id, s])));
export const hasImages = computed(() => pages.value.some((p) => sourceMap.value.get(p.sourceId)?.kind === 'image'));
export const hasPdfs = computed(() => pages.value.some((p) => sourceMap.value.get(p.sourceId)?.kind === 'pdf'));

export const rangeCheck = computed(() => {
  const s = settings.value;
  if (s.output !== 'split' || s.splitMode !== 'ranges') return null;
  if (!s.ranges.trim()) return { key: 'split.err.empty', vars: {} as Record<string, string | number> };
  const r = parseRanges(s.ranges, pages.value.length);
  if (!r.error) return null;
  return { key: `split.err.${r.error.reason}`, vars: { token: r.error.token, total: pages.value.length } };
});

/** How many files the current settings will produce. */
export const outputCount = computed(() => {
  const s = settings.value;
  const n = pages.value.length;
  if (!n) return 0;
  switch (s.output) {
    case 'pdf':
      return 1;
    case 'images':
      return n;
    case 'per-source':
      return new Set(pages.value.map((p) => p.sourceId)).size;
    case 'split':
      if (s.splitMode === 'each') return n;
      if (s.splitMode === 'chunk') return Math.ceil(n / Math.max(1, s.chunk));
      return parseRanges(s.ranges, n).groups.length;
  }
});

export function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch };
}

export function applyTool(id: ToolId, extra?: Partial<Settings>) {
  const tool = toolById(id);
  const keepName = settings.value.fileName;
  settings.value = { ...BASE_SETTINGS, ...tool.defaults, ...extra, fileName: extra?.fileName ?? keepName };
}

export function openTool(id: ToolId, extra?: Partial<Settings>) {
  applyTool(id, extra);
  const slug = toolById(id).slug;
  route.value = { view: 'work', tool: id };
  if (location.pathname !== `/${slug}`) history.pushState(null, '', `/${slug}`);
  scrollTo(0, 0);
}

export function goHome() {
  route.value = { view: 'home' };
  if (location.pathname !== '/' || location.hash) history.pushState(null, '', '/');
}

export function goPage(page: Page) {
  route.value = { view: page };
  if (location.pathname !== `/${page}`) history.pushState(null, '', `/${page}`);
  scrollTo(0, 0);
}

// ---------------------------------------------------------------- toasts

export interface Toast {
  id: string;
  text: string;
  tone: 'info' | 'error';
}
export const toasts = signal<Toast[]>([]);
export function toast(text: string, tone: Toast['tone'] = 'info') {
  const item = { id: uid(), text, tone };
  toasts.value = [...toasts.value, item];
  setTimeout(() => (toasts.value = toasts.value.filter((x) => x !== item)), 4500);
}

// ---------------------------------------------------------------- sources

function patchSource(id: string, patch: Partial<Source>) {
  sources.value = sources.value.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function appendPages(src: Source, count: number) {
  const items: PageItem[] = Array.from({ length: count }, (_, i) => ({
    id: uid(),
    sourceId: src.id,
    index: i,
    rotation: 0,
  }));
  pages.value = [...pages.value, ...items];
}

async function loadPdf(src: Source) {
  try {
    const doc = await openPdf(src);
    const first = await doc.getPage(1);
    const vp = first.getViewport({ scale: 1 });
    const ready = { ...src, status: 'ready' as const, pageCount: doc.numPages, width: vp.width, height: vp.height };
    patchSource(src.id, ready);
    appendPages(ready, doc.numPages);
  } catch (e) {
    if (e instanceof PasswordError) {
      patchSource(src.id, { status: 'locked', error: e.incorrect ? 'source.wrong' : undefined });
    } else {
      patchSource(src.id, { status: 'error', error: 'source.error' });
      toast(t('toast.readFail', { name: src.name }), 'error');
    }
  }
}

async function loadImage(src: Source) {
  try {
    const file = await normalizeImage(src.file);
    const bmp = await decodeImage(file);
    const ready: Source = { ...src, file, status: 'ready', pageCount: 1, width: bmp.width, height: bmp.height };
    bmp.close();
    patchSource(src.id, ready);
    appendPages(ready, 1);
  } catch {
    patchSource(src.id, { status: 'error', error: 'source.error' });
    toast(t('toast.readFail', { name: src.name }), 'error');
  }
}

let loadChain: Promise<void> = Promise.resolve();

export async function addFiles(list: FileList | File[]) {
  const files = [...list];
  const added: Source[] = [];
  for (const file of files) {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const kind = isPdfFile(file, head) ? 'pdf' : isImageFile(file) ? 'image' : null;
    if (!kind) {
      toast(t('toast.unsupported', { name: file.name }), 'error');
      continue;
    }
    added.push({
      id: uid(),
      file,
      name: file.name || (kind === 'pdf' ? 'dokumen.pdf' : 'gambar.png'),
      size: file.size,
      kind,
      color: COLORS[colorIdx++ % COLORS.length],
      status: 'loading',
      pageCount: 0,
    });
  }
  if (!added.length) return;
  sources.value = [...sources.value, ...added];
  output.value = null;
  // load sequentially so pages land in the order the files were given
  loadChain = loadChain.then(async () => {
    for (const src of added) {
      if (!sourceMap.value.has(src.id)) continue;
      await (src.kind === 'pdf' ? loadPdf(src) : loadImage(src));
    }
  });
  await loadChain;
}

export async function unlockSource(id: string, password: string) {
  forgetSource(id);
  patchSource(id, { password, status: 'loading', error: undefined });
  await loadPdf(sourceMap.value.get(id)!);
}

export function removeSource(id: string) {
  batch(() => {
    sources.value = sources.value.filter((s) => s.id !== id);
    pages.value = pages.value.filter((p) => p.sourceId !== id);
    output.value = null;
  });
  forgetSource(id);
  forgetThumbs(id);
}

export function clearAll() {
  for (const s of sources.value) {
    forgetSource(s.id);
    forgetThumbs(s.id);
  }
  batch(() => {
    sources.value = [];
    pages.value = [];
    selection.value = new Set();
    output.value = null;
  });
}

// ---------------------------------------------------------------- pages

export function movePage(from: number, to: number) {
  const list = [...pages.value];
  const [item] = list.splice(from, 1);
  list.splice(to, 0, item);
  pages.value = list;
}

export function rotatePages(ids: Iterable<string>, delta: 90 | -90) {
  const set = new Set(ids);
  pages.value = pages.value.map((p) =>
    set.has(p.id) ? { ...p, rotation: (((p.rotation + delta) % 360) + 360) % 360 as Rotation } : p,
  );
}

export function deletePages(ids: Iterable<string>) {
  const set = new Set(ids);
  batch(() => {
    pages.value = pages.value.filter((p) => !set.has(p.id));
    selection.value = new Set([...selection.value].filter((id) => !set.has(id)));
    // drop sources that no longer contribute any page
    const used = new Set(pages.value.map((p) => p.sourceId));
    for (const s of sources.value) {
      if (!used.has(s.id) && s.status === 'ready') {
        sources.value = sources.value.filter((x) => x.id !== s.id);
        forgetSource(s.id);
        forgetThumbs(s.id);
      }
    }
  });
}

export function duplicatePages(ids: Iterable<string>) {
  const set = new Set(ids);
  const list: PageItem[] = [];
  for (const p of pages.value) {
    list.push(p);
    if (set.has(p.id)) list.push({ ...p, id: uid() });
  }
  pages.value = list;
}

export function sortByName() {
  const order = [...sources.value].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
  );
  const rank = new Map(order.map((s, i) => [s.id, i]));
  pages.value = [...pages.value].sort(
    (a, b) => rank.get(a.sourceId)! - rank.get(b.sourceId)! || a.index - b.index,
  );
}

export function flipPages(ids: Iterable<string>, axis: 'h' | 'v') {
  const set = new Set(ids);
  pages.value = pages.value.map((p) =>
    set.has(p.id) ? (axis === 'h' ? { ...p, flipH: !p.flipH } : { ...p, flipV: !p.flipV }) : p,
  );
}

export function setCrop(id: string, crop: Crop | undefined) {
  pages.value = pages.value.map((p) => (p.id === id ? { ...p, crop } : p));
}

export function setCropAll(crop: Crop | undefined) {
  pages.value = pages.value.map((p) => ({ ...p, crop }));
}

/** Selects pages whose displayed orientation matches. */
export function selectOrientation(which: 'portrait' | 'landscape') {
  const ids = pages.value
    .filter((p) => {
      const s = sourceMap.value.get(p.sourceId);
      if (!s?.width || !s.height) return false;
      const wide = (p.rotation % 180 === 0 ? s.width / s.height : s.height / s.width) > 1;
      return which === 'landscape' ? wide : !wide;
    })
    .map((p) => p.id);
  selection.value = new Set(ids);
  return ids.length;
}

/** logo for image watermarks; kept in memory only */
export const watermarkLogo = signal<File | null>(null);

export function reversePages() {
  pages.value = [...pages.value].reverse();
}

export function toggleSelect(id: string, additive: boolean) {
  const next = new Set(additive ? selection.value : []);
  if (selection.value.has(id) && (additive || selection.value.size === 1)) next.delete(id);
  else next.add(id);
  selection.value = next;
}

// ---------------------------------------------------------------- processing

export async function processAll() {
  if (!pages.value.length || progress.value) return;
  runError.value = null;
  progress.value = { done: 0, total: pages.value.length, key: 'progress-start' };
  try {
    const engine = await import('./engine/build');
    const onProgress = (p: Progress) => (progress.value = p);
    const tool = activeTool.value.id;
    if (tool === 'flow') {
      const ev = flowEval.value;
      output.value = await engine.runGroups(ev.groups, sourceMap.value, ev.settings, onProgress, { logo: watermarkLogo.value });
    } else {
      output.value = await engine.run(pages.value, sourceMap.value, settings.value, onProgress, { logo: watermarkLogo.value });
    }
    record(tool, output.value, new Set(pages.value.map((p) => p.sourceId)).size);
  } catch (e: any) {
    console.error(e);
    runError.value = String(e?.message ?? e);
    toast(t('error.process', { msg: runError.value }), 'error');
  } finally {
    progress.value = null;
  }
}

// ---------------------------------------------------------------- recipes

export interface Recipe {
  id: string;
  name: string;
  nodes: FlowNode[];
  /** last edit (ms), used to merge with other devices */
  updatedAt?: number;
}
const RECIPE_KEY = 'localkit:recipes';
const RECIPE_DEL_KEY = 'localkit:recipes-deleted';

/** id → deletion time, so a delete on one device also wins on the others */
export const recipeTombstones = signal<Record<string, number>>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(RECIPE_DEL_KEY) ?? '{}');
    } catch {
      return {};
    }
  })(),
);

function loadRecipes(): Recipe[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECIPE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((r) => Array.isArray(r?.nodes)) : [];
  } catch {
    return [];
  }
}
export const recipes = signal<Recipe[]>(loadRecipes());
function persistRecipes() {
  try {
    localStorage.setItem(RECIPE_KEY, JSON.stringify(recipes.value));
    localStorage.setItem(RECIPE_DEL_KEY, JSON.stringify(recipeTombstones.value));
  } catch {}
}

/** Replaces saved flows with a merged copy from the cloud. */
export function applyRecipes(items: Recipe[], deleted: Record<string, number>) {
  batch(() => {
    recipes.value = items;
    recipeTombstones.value = deleted;
    if (activeRecipe.value && !items.some((r) => r.id === activeRecipe.value)) activeRecipe.value = null;
  });
  persistRecipes();
}
const cloneNodes = (nodes: FlowNode[], freshIds = false) =>
  nodes.map((n) => ({ ...n, id: freshIds ? uid() : n.id, p: { ...n.p } }) as FlowNode);

/** Saves the current flow. An existing flow with the same name is overwritten. Returns true when it updated one. */
export function saveRecipe(name: string): boolean {
  const existing = recipes.value.find((r) => r.name.trim().toLowerCase() === name.trim().toLowerCase());
  const nodes = cloneNodes(flowNodes.value);
  if (existing) {
    recipes.value = recipes.value.map((r) => (r.id === existing.id ? { ...r, name, nodes, updatedAt: Date.now() } : r));
    activeRecipe.value = existing.id;
  } else {
    const id = uid();
    recipes.value = [...recipes.value, { id, name, nodes, updatedAt: Date.now() }];
    activeRecipe.value = id;
  }
  persistRecipes();
  return !!existing;
}
export function deleteRecipe(id: string) {
  recipes.value = recipes.value.filter((r) => r.id !== id);
  recipeTombstones.value = { ...recipeTombstones.value, [id]: Date.now() };
  if (activeRecipe.value === id) activeRecipe.value = null;
  persistRecipes();
}

/** Loads a saved flow into the builder without leaving the page. */
export function loadRecipe(r: Recipe) {
  setFlow(cloneNodes(r.nodes, true));
  activeRecipe.value = r.id;
}
export function openRecipe(r: Recipe) {
  loadRecipe(r);
  openTool('flow');
}

// ---------------------------------------------------------------- custom flow

const FLOW_KEY = 'localkit:flow-draft';

function loadDraft(): FlowNode[] {
  try {
    const v = JSON.parse(localStorage.getItem(FLOW_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export const flowNodes = signal<FlowNode[]>(loadDraft());
const ACTIVE_KEY = 'localkit:flow-active';
function loadActive() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}
/** saved flow currently loaded in the builder */
export const activeRecipe = signal<string | null>(loadActive());
activeRecipe.subscribe((v) => {
  try {
    if (v) localStorage.setItem(ACTIVE_KEY, v);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
});
const shape = (nodes: FlowNode[]) => JSON.stringify(nodes.map((n) => [n.type, n.p]));
/** true when the builder differs from the loaded saved flow */
export const recipeDirty = computed(() => {
  const r = recipes.value.find((x) => x.id === activeRecipe.value);
  return !!r && shape(r.nodes) !== shape(flowNodes.value);
});
export const flowEval = computed(() => evaluate(flowNodes.value, pages.value, sourceMap.value));

function setFlow(nodes: FlowNode[]) {
  flowNodes.value = nodes;
  output.value = null;
  try {
    localStorage.setItem(FLOW_KEY, JSON.stringify(nodes));
  } catch {}
}

export function addNode(type: NodeType, at = flowNodes.value.length) {
  const list = [...flowNodes.value];
  const node = newNode(type);
  list.splice(at, 0, node);
  setFlow(list);
  return node.id;
}

export function updateNode(id: string, patch: object) {
  setFlow(flowNodes.value.map((n) => (n.id === id ? ({ ...n, p: { ...n.p, ...patch } } as FlowNode) : n)));
}

export function removeNode(id: string) {
  setFlow(flowNodes.value.filter((n) => n.id !== id));
}

export function moveNode(from: number, to: number) {
  const list = [...flowNodes.value];
  const [n] = list.splice(from, 1);
  list.splice(to, 0, n);
  setFlow(list);
}

export function clearFlow() {
  setFlow([]);
  activeRecipe.value = null;
}

/** Reorders input files; their pages follow in the new order. */
export function moveSource(from: number, to: number) {
  const list = [...sources.value];
  const [src] = list.splice(from, 1);
  list.splice(to, 0, src);
  const rank = new Map(list.map((x, i) => [x.id, i]));
  batch(() => {
    sources.value = list;
    pages.value = [...pages.value].sort((a, b) => rank.get(a.sourceId)! - rank.get(b.sourceId)!);
  });
}

// initial tool from a deep link
if (route.value.view === 'work') applyTool(route.value.tool);
