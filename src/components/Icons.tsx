import {
  Crop,
  FileImage,
  FileType,
  FlipHorizontal2,
  Frame,
  ImageDown,
  Images,
  ListOrdered,
  MapPinOff,
  Merge,
  Replace,
  RotateCwSquare,
  Scaling,
  Scissors,
  Shrink,
  Stamp,
  WandSparkles,
  Workflow,
} from 'lucide-preact';
import type { ToolId } from '../tools';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" class="logo">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M10 7.5h8.2L23 12.3V23a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 8.5 23V9a1.5 1.5 0 0 1 1.5-1.5Z" fill="#fff" />
      <path d="M18 7.6V11a1.4 1.4 0 0 0 1.4 1.4H23" fill="none" stroke="var(--accent)" stroke-width="1.3" stroke-opacity=".45" />
      <path d="M12 16h7M12 19h5" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="22.5" cy="22.5" r="5" fill="var(--logo-dot)" stroke="var(--accent)" stroke-width="1.6" />
      <path d="m20.4 22.6 1.4 1.4 2.8-2.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  );
}

const MAP: Record<ToolId, typeof Merge> = {
  flow: Workflow,
  img2pdf: FileImage,
  merge: Merge,
  split: Scissors,
  pdf2img: Images,
  'compress-pdf': Shrink,
  'compress-img': ImageDown,
  'rotate-pdf': RotateCwSquare,
  'watermark-pdf': Stamp,
  'page-numbers': ListOrdered,
  'resize-img': Scaling,
  'crop-img': Crop,
  'to-jpg': FileType,
  'from-jpg': Replace,
  'rotate-img': FlipHorizontal2,
  'watermark-img': Stamp,
  'border-img': Frame,
  'strip-meta': MapPinOff,
  'remove-bg': WandSparkles,
};

export function ToolIcon({ id, size = 22 }: { id: ToolId; size?: number }) {
  const C = MAP[id];
  return <C size={size} strokeWidth={1.8} />;
}

export function GithubMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}
