import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { Rotation, Source } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const DATA = `${import.meta.env.BASE_URL}pdfjs/`;

/** Largest canvas area that every mainstream browser (incl. iOS Safari) accepts. */
export const MAX_CANVAS_PIXELS = 16_000_000;

export class PasswordError extends Error {
  constructor(public incorrect: boolean) {
    super(incorrect ? 'incorrect-password' : 'password-required');
  }
}

const bytesCache = new Map<string, Promise<Uint8Array>>();
const docCache = new Map<string, Promise<PDFDocumentProxy>>();

export function sourceBytes(src: Source): Promise<Uint8Array> {
  let p = bytesCache.get(src.id);
  if (!p) {
    p = src.file.arrayBuffer().then((b) => new Uint8Array(b));
    bytesCache.set(src.id, p);
  }
  return p;
}

export function forgetSource(id: string) {
  bytesCache.delete(id);
  const doc = docCache.get(id);
  docCache.delete(id);
  doc?.then((d) => d.loadingTask.destroy()).catch(() => {});
}

export function openPdf(src: Source): Promise<PDFDocumentProxy> {
  let p = docCache.get(src.id);
  if (!p) {
    p = (async () => {
      const bytes = await sourceBytes(src);
      // pdf.js transfers the buffer to its worker, so hand it a copy.
      const task = pdfjs.getDocument({
        data: bytes.slice(),
        password: src.password,
        cMapUrl: `${DATA}cmaps/`,
        standardFontDataUrl: `${DATA}standard_fonts/`,
        wasmUrl: `${DATA}wasm/`,
        iccUrl: `${DATA}iccs/`,
        disableWorkerRendering: true,
        enableXfa: false,
      });
      try {
        return await task.promise;
      } catch (e: any) {
        if (e?.name === 'PasswordException') {
          throw new PasswordError(e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
        }
        throw e;
      }
    })();
    p.catch(() => docCache.delete(src.id));
    docCache.set(src.id, p);
  }
  return p;
}

export interface RenderOpts {
  /** pixels per PDF point (1 = 72 dpi) */
  scale: number;
  rotation?: Rotation;
  /** cap on the longest side in pixels */
  maxDim?: number;
}

/** Renders one page onto a fresh canvas with a white background. */
export async function renderPage(src: Source, index: number, opts: RenderOpts) {
  const doc = await openPdf(src);
  const page = await doc.getPage(index + 1);
  const rotation = (page.rotate + (opts.rotation ?? 0)) % 360;
  const base = page.getViewport({ scale: 1, rotation });
  let scale = opts.scale;
  if (opts.maxDim) scale = Math.min(scale, opts.maxDim / Math.max(base.width, base.height));
  const area = base.width * base.height * scale * scale;
  if (area > MAX_CANVAS_PIXELS) scale *= Math.sqrt(MAX_CANVAS_PIXELS / area);
  const viewport = page.getViewport({ scale, rotation });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  await page.render({ canvas, viewport, background: '#ffffff' }).promise;
  page.cleanup();
  return { canvas, pointWidth: base.width, pointHeight: base.height };
}
