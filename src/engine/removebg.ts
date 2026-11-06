import { signal } from '@preact/signals';
import type { InferenceSession } from 'onnxruntime-web';

/**
 * Background removal with ISNet (general use) running in onnxruntime-web.
 * The model is served by this site in parts (see scripts/prepare-model.py),
 * downloaded only when the tool is first used and cached by the service worker.
 */

const BASE = `${import.meta.env.BASE_URL}models/isnet/`;
const MEAN = [0.485, 0.456, 0.406];

interface Manifest {
  size: number;
  sha256: string;
  parts: string[];
  input: number;
}

/** model download progress (bytes), null when idle */
export const modelProgress = signal<{ loaded: number; total: number } | null>(null);
export const modelReady = signal(false);

let session: Promise<{ s: InferenceSession; ort: typeof import('onnxruntime-web'); size: number }> | null = null;

async function download(m: Manifest) {
  const buf = new Uint8Array(m.size);
  let off = 0;
  modelProgress.value = { loaded: 0, total: m.size };
  for (const part of m.parts) {
    const res = await fetch(BASE + part);
    if (!res.ok || !res.body) throw new Error(`model ${part}: ${res.status}`);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf.set(value, off);
      off += value.length;
      modelProgress.value = { loaded: off, total: m.size };
    }
  }
  if (off !== m.size) throw new Error('model download incomplete');
  return buf;
}

function getSession() {
  if (!session) {
    session = (async () => {
      const [ort, manifest] = await Promise.all([
        import('onnxruntime-web/wasm'),
        fetch(BASE + 'manifest.json').then((r) => {
          if (!r.ok) throw new Error('model manifest missing');
          return r.json() as Promise<Manifest>;
        }),
      ]);
      ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 2) : 1;
      // run inference in a worker so the page stays responsive
      ort.env.wasm.proxy = true;
      const bytes = await download(manifest);
      const s = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
      modelProgress.value = null;
      modelReady.value = true;
      return { s, ort, size: manifest.input };
    })();
    session.catch(() => {
      session = null;
      modelProgress.value = null;
    });
  }
  return session;
}

export const preloadModel = () => getSession().then(() => undefined);

/** Returns a new canvas with the background made transparent. */
export async function removeBackground(input: HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const { s, ort, size } = await getSession();

  const small = document.createElement('canvas');
  small.width = small.height = size;
  const sctx = small.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(input, 0, 0, size, size);
  const px = sctx.getImageData(0, 0, size, size).data;
  const plane = size * size;
  const data = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    data[i] = px[i * 4] / 255 - MEAN[0];
    data[plane + i] = px[i * 4 + 1] / 255 - MEAN[1];
    data[2 * plane + i] = px[i * 4 + 2] / 255 - MEAN[2];
  }
  const feeds = { [s.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, size, size]) };
  const out = await s.run(feeds);
  const pred = out[s.outputNames[0]].data as Float32Array;

  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < plane; i++) {
    if (pred[i] < lo) lo = pred[i];
    if (pred[i] > hi) hi = pred[i];
  }
  const range = hi - lo || 1;
  const mask = sctx.createImageData(size, size);
  for (let i = 0; i < plane; i++) mask.data[i * 4 + 3] = Math.round(((pred[i] - lo) / range) * 255);
  sctx.clearRect(0, 0, size, size);
  sctx.putImageData(mask, 0, 0);

  const result = document.createElement('canvas');
  result.width = input.width;
  result.height = input.height;
  const rctx = result.getContext('2d')!;
  rctx.drawImage(input, 0, 0);
  rctx.globalCompositeOperation = 'destination-in';
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(small, 0, 0, input.width, input.height);
  small.width = small.height = 0;
  return result;
}
