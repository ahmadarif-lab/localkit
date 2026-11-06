import type { CompressLevel, Settings } from '../types';

export interface CompressParams {
  /** longest side in pixels for any image that gets re-encoded */
  maxDim: number;
  /** JPEG/WebP quality 0..1 */
  quality: number;
  /** render resolution when a PDF page is turned into an image */
  dpi: number;
}

export const LEVELS: Record<Exclude<CompressLevel, 'none' | 'custom'>, CompressParams> = {
  light: { maxDim: 2400, quality: 0.85, dpi: 150 },
  medium: { maxDim: 1700, quality: 0.72, dpi: 120 },
  strong: { maxDim: 1200, quality: 0.6, dpi: 96 },
};

/** Re-encoding parameters for the chosen level, or null when compression is off. */
export function compressParams(s: Settings): CompressParams | null {
  if (s.compress === 'none') return null;
  if (s.compress === 'custom') {
    // an A4 page is ~11.7 in tall, so this keeps raster pages consistent with images
    const dpi = Math.round(Math.min(300, Math.max(72, s.maxDim / 11.7)));
    return { maxDim: s.maxDim, quality: s.quality / 100, dpi };
  }
  return LEVELS[s.compress];
}

/** Used for pages that must be rasterised even with compression off (e.g. encrypted PDFs). */
export const LOSSLESS_RASTER: CompressParams = { maxDim: 4000, quality: 0.92, dpi: 200 };
