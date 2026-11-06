import type { ImageFormat, OutputKind, PageNumberOpts, ResizeOpts, Settings, WatermarkOpts } from './types';

export type ToolId =
  | 'flow'
  | 'img2pdf'
  | 'merge'
  | 'split'
  | 'pdf2img'
  | 'compress-pdf'
  | 'rotate-pdf'
  | 'watermark-pdf'
  | 'page-numbers'
  | 'compress-img'
  | 'resize-img'
  | 'crop-img'
  | 'to-jpg'
  | 'from-jpg'
  | 'rotate-img'
  | 'watermark-img'
  | 'border-img'
  | 'strip-meta'
  | 'remove-bg';

export type StepId =
  | 'pagesize'
  | 'compress'
  | 'output'
  | 'resize'
  | 'crop'
  | 'watermark'
  | 'border'
  | 'metadata'
  | 'removebg'
  | 'pagenumbers'
  | 'rotate';

export type Category = 'flow' | 'pdf' | 'image';

export interface Tool {
  id: ToolId;
  slug: string;
  category: Category;
  accept: 'pdf' | 'image' | 'any';
  outputs: OutputKind[];
  /** image formats offered in the output step (images output only) */
  formats?: ImageFormat[];
  /** sidebar steps, in pipeline order */
  steps: StepId[];
  defaults: Partial<Settings>;
}

export const BASE_SETTINGS: Settings = {
  output: 'pdf',
  splitMode: 'each',
  ranges: '',
  chunk: 2,
  imageFormat: 'jpeg',
  dpi: 150,
  compress: 'none',
  quality: 75,
  maxDim: 1600,
  pdfMode: 'smart',
  pageSize: 'fit',
  orientation: 'auto',
  margin: 'none',
  fileName: '',
  resize: null,
  border: null,
  watermark: null,
  removeBg: null,
  pageNumbers: null,
  cropRatio: null,
  stripMeta: true,
  animate: null,
};

export const DEFAULT_WATERMARK: WatermarkOpts = {
  kind: 'text',
  text: 'DRAFT',
  color: '#8a8a8a',
  opacity: 35,
  size: 9,
  position: 'mc',
  tile: false,
  rotation: 30,
};

export const DEFAULT_RESIZE: ResizeOpts = {
  mode: 'px',
  width: 1280,
  height: 0,
  pct: 50,
  preset: 'ig-square',
  fit: 'contain',
  noUpscale: true,
};

export const DEFAULT_PAGE_NUMBERS: PageNumberOpts = { position: 'bc', format: 'n-of-total', start: 1, size: 11 };

const IMG_FORMATS: ImageFormat[] = ['auto', 'jpeg', 'png', 'webp'];

export const TOOLS: Tool[] = [
  {
    id: 'flow',
    category: 'flow',
    slug: 'flow',
    accept: 'any',
    outputs: ['pdf', 'split', 'per-source', 'images'],
    steps: ['pagesize', 'compress', 'output'],
    defaults: {},
  },
  {
    id: 'img2pdf',
    category: 'pdf',
    slug: 'images-to-pdf',
    accept: 'image',
    outputs: ['pdf', 'per-source'],
    steps: ['pagesize', 'compress', 'output'],
    defaults: { output: 'pdf', compress: 'medium' },
  },
  {
    id: 'merge',
    category: 'pdf',
    slug: 'merge-pdf',
    accept: 'pdf',
    outputs: ['pdf'],
    steps: ['output'],
    defaults: { output: 'pdf', compress: 'none' },
  },
  {
    id: 'split',
    category: 'pdf',
    slug: 'split-pdf',
    accept: 'pdf',
    outputs: ['split'],
    steps: ['output'],
    defaults: { output: 'split', splitMode: 'ranges', compress: 'none' },
  },
  {
    id: 'pdf2img',
    category: 'pdf',
    slug: 'pdf-to-images',
    accept: 'pdf',
    outputs: ['images'],
    steps: ['output'],
    defaults: { output: 'images', imageFormat: 'jpeg', dpi: 150, compress: 'none' },
  },
  {
    id: 'compress-pdf',
    category: 'pdf',
    slug: 'compress-pdf',
    accept: 'pdf',
    outputs: ['per-source', 'pdf'],
    steps: ['compress', 'output'],
    defaults: { output: 'per-source', compress: 'medium', pdfMode: 'smart' },
  },
  {
    id: 'compress-img',
    category: 'image',
    formats: IMG_FORMATS,
    slug: 'compress-images',
    accept: 'image',
    outputs: ['images'],
    steps: ['compress', 'output'],
    defaults: { output: 'images', imageFormat: 'auto', compress: 'medium' },
  },
  {
    id: 'rotate-pdf',
    category: 'pdf',
    slug: 'rotate-pdf',
    accept: 'pdf',
    outputs: ['per-source', 'pdf'],
    steps: ['rotate', 'output'],
    defaults: { output: 'per-source' },
  },
  {
    id: 'watermark-pdf',
    category: 'pdf',
    slug: 'watermark-pdf',
    accept: 'pdf',
    outputs: ['per-source', 'pdf'],
    steps: ['watermark', 'output'],
    defaults: { output: 'per-source', watermark: DEFAULT_WATERMARK },
  },
  {
    id: 'page-numbers',
    category: 'pdf',
    slug: 'page-numbers',
    accept: 'pdf',
    outputs: ['per-source', 'pdf'],
    steps: ['pagenumbers', 'output'],
    defaults: { output: 'per-source', pageNumbers: DEFAULT_PAGE_NUMBERS },
  },
  {
    id: 'resize-img',
    category: 'image',
    slug: 'resize-image',
    accept: 'image',
    outputs: ['images'],
    formats: IMG_FORMATS,
    steps: ['resize', 'output'],
    defaults: { output: 'images', imageFormat: 'auto', resize: DEFAULT_RESIZE },
  },
  {
    id: 'crop-img',
    category: 'image',
    slug: 'crop-image',
    accept: 'image',
    outputs: ['images'],
    formats: IMG_FORMATS,
    steps: ['crop', 'output'],
    defaults: { output: 'images', imageFormat: 'auto', cropRatio: null },
  },
  {
    id: 'to-jpg',
    category: 'image',
    slug: 'convert-to-jpg',
    accept: 'image',
    outputs: ['images'],
    formats: ['jpeg'],
    steps: ['compress', 'output'],
    defaults: { output: 'images', imageFormat: 'jpeg', compress: 'none' },
  },
  {
    id: 'from-jpg',
    category: 'image',
    slug: 'convert-from-jpg',
    accept: 'image',
    outputs: ['images'],
    formats: ['png', 'webp', 'gif'],
    steps: ['output'],
    defaults: { output: 'images', imageFormat: 'png' },
  },
  {
    id: 'rotate-img',
    category: 'image',
    slug: 'rotate-image',
    accept: 'image',
    outputs: ['images'],
    formats: IMG_FORMATS,
    steps: ['rotate', 'output'],
    defaults: { output: 'images', imageFormat: 'auto' },
  },
  {
    id: 'watermark-img',
    category: 'image',
    slug: 'watermark-image',
    accept: 'image',
    outputs: ['images'],
    formats: IMG_FORMATS,
    steps: ['watermark', 'output'],
    defaults: { output: 'images', imageFormat: 'auto', watermark: DEFAULT_WATERMARK },
  },
  {
    id: 'border-img',
    category: 'image',
    slug: 'add-border',
    accept: 'image',
    outputs: ['images'],
    formats: IMG_FORMATS,
    steps: ['border', 'output'],
    defaults: { output: 'images', imageFormat: 'auto', border: { size: 40, unit: 'px', color: '#ffffff' } },
  },
  {
    id: 'strip-meta',
    category: 'image',
    slug: 'remove-metadata',
    accept: 'image',
    outputs: ['images'],
    formats: ['auto'],
    steps: ['metadata'],
    defaults: { output: 'images', imageFormat: 'auto', stripMeta: true },
  },
  {
    id: 'remove-bg',
    category: 'image',
    slug: 'remove-background',
    accept: 'image',
    outputs: ['images'],
    formats: ['png', 'webp', 'jpeg'],
    steps: ['removebg', 'output'],
    defaults: { output: 'images', imageFormat: 'png', removeBg: { bg: 'transparent', color: '#ffffff' } },
  },
];

export const toolsIn = (c: Category) => TOOLS.filter((t) => t.category === c);

export const toolById = (id: ToolId) => TOOLS.find((t) => t.id === id)!;
export const toolBySlug = (slug: string) => TOOLS.find((t) => t.slug === slug);

/** Extra search words (English + Indonesian) for the tool search and command palette. */
export const TOOL_KEYWORDS: Record<ToolId, string> = {
  flow: 'custom flow alur kustom workflow pipeline builder',
  img2pdf: 'images to pdf gambar ke pdf jpg png heic photo foto scan convert ubah',
  merge: 'merge pdf gabung combine join satukan',
  split: 'split pdf pisah extract ambil halaman pages range',
  pdf2img: 'pdf to images jpg png webp gambar convert ubah export',
  'compress-pdf': 'compress pdf kompres reduce perkecil size ukuran shrink',
  'compress-img': 'compress images kompres gambar foto photo reduce perkecil shrink',
  'rotate-pdf': 'rotate pdf putar halaman orientation',
  'watermark-pdf': 'watermark pdf stamp cap logo text teks',
  'page-numbers': 'page numbers nomor halaman pdf penomoran',
  'resize-img': 'resize image ubah ukuran gambar foto pixel instagram pas foto 3x4 4x6 dimension',
  'crop-img': 'crop image potong gambar foto ratio rasio square',
  'to-jpg': 'convert to jpg ubah ke jpg png heic webp gif jpeg',
  'from-jpg': 'convert from jpg ubah jpg ke png webp gif animasi animated',
  'rotate-img': 'rotate image putar gambar flip balik mirror cermin',
  'watermark-img': 'watermark image gambar foto stamp logo teks',
  'border-img': 'border frame bingkai padding gambar foto',
  'strip-meta': 'remove metadata exif gps lokasi location privacy hapus',
  'remove-bg': 'remove background hapus latar belakang ai transparan png cutout',
};
