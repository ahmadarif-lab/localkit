export type Kind = 'pdf' | 'image';

export interface Source {
  id: string;
  file: File;
  name: string;
  size: number;
  kind: Kind;
  color: string;
  status: 'loading' | 'ready' | 'locked' | 'error';
  pageCount: number;
  error?: string;
  password?: string;
  /** natural pixel size for images, point size of page 1 for PDFs */
  width?: number;
  height?: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** Crop box as fractions (0..1) of the displayed (rotated + flipped) image. */
export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PageItem {
  id: string;
  sourceId: string;
  /** 0-based page index inside the source (always 0 for images) */
  index: number;
  rotation: Rotation;
  flipH?: boolean;
  flipV?: boolean;
  crop?: Crop;
}

export type CompressLevel = 'none' | 'light' | 'medium' | 'strong' | 'custom';
export type OutputKind = 'pdf' | 'split' | 'per-source' | 'images';
export type SplitMode = 'each' | 'ranges' | 'chunk';
export type ImageFormat = 'auto' | 'jpeg' | 'png' | 'webp' | 'gif';
export type PdfMode = 'smart' | 'raster';
export type PageSize = 'fit' | 'a4' | 'letter';
export type Orientation = 'auto' | 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'large';

export type Position = 'tl' | 'tc' | 'tr' | 'ml' | 'mc' | 'mr' | 'bl' | 'bc' | 'br';

export interface ResizeOpts {
  mode: 'px' | 'pct' | 'preset';
  width: number;
  height: number;
  pct: number;
  preset: string;
  /** contain: fit inside the box, cover: fill and crop, stretch: exact size */
  fit: 'contain' | 'cover' | 'stretch';
  noUpscale: boolean;
}

export interface BorderOpts {
  size: number;
  unit: 'px' | 'pct';
  color: string;
}

export interface WatermarkOpts {
  kind: 'text' | 'image';
  text: string;
  color: string;
  /** 0..100 */
  opacity: number;
  /** text: height as % of the shorter side; image: width as % of the page width */
  size: number;
  position: Position;
  tile: boolean;
  /** degrees, counter-clockwise */
  rotation: number;
}

export interface RemoveBgOpts {
  bg: 'transparent' | 'white' | 'color';
  color: string;
}

export interface PageNumberOpts {
  position: 'tl' | 'tc' | 'tr' | 'bl' | 'bc' | 'br';
  format: 'n' | 'n-of-total' | 'page-n';
  start: number;
  /** points */
  size: number;
}

export interface Settings {
  output: OutputKind;
  splitMode: SplitMode;
  ranges: string;
  chunk: number;
  imageFormat: ImageFormat;
  dpi: number;
  compress: CompressLevel;
  quality: number;
  maxDim: number;
  pdfMode: PdfMode;
  pageSize: PageSize;
  orientation: Orientation;
  margin: Margin;
  fileName: string;
  /** image operations; null = off */
  resize: ResizeOpts | null;
  border: BorderOpts | null;
  watermark: WatermarkOpts | null;
  removeBg: RemoveBgOpts | null;
  pageNumbers: PageNumberOpts | null;
  /** centre-crop pages without a manual crop to this ratio ("w:h"), null = off */
  cropRatio: string | null;
  /** remove EXIF/GPS/text metadata (lossless where possible) */
  stripMeta: boolean;
  /** combine all frames into one animated GIF */
  animate: { delay: number } | null;
}

export interface Result {
  name: string;
  blob: Blob;
  kind: 'pdf' | 'image';
  pages: number;
  /** compression made it bigger, so the original was kept */
  unchanged?: boolean;
}

export interface RunOutput {
  results: Result[];
  inputBytes: number;
  warnings: string[];
}
