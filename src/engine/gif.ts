import { GIFEncoder, applyPalette, quantize } from 'gifenc';

function frame(enc: ReturnType<typeof GIFEncoder>, c: HTMLCanvasElement, delay: number) {
  const { data } = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  const palette = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: true });
  const index = applyPalette(data, palette, 'rgba4444');
  const transparent = palette.findIndex((p: number[]) => p[3] === 0);
  enc.writeFrame(index, c.width, c.height, {
    palette,
    delay,
    transparent: transparent >= 0,
    transparentIndex: Math.max(0, transparent),
  });
}

export function encodeGif(c: HTMLCanvasElement): Blob {
  const enc = GIFEncoder();
  frame(enc, c, 0);
  enc.finish();
  return new Blob([enc.bytes() as BlobPart], { type: 'image/gif' });
}

/** Animated GIF; every frame is fitted (centred, white background) to the first frame's size. */
export function encodeAnimatedGif(frames: HTMLCanvasElement[], delay: number): Blob {
  const enc = GIFEncoder();
  const w = frames[0].width;
  const h = frames[0].height;
  for (const f of frames) {
    let c = f;
    if (f.width !== w || f.height !== h) {
      c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = '#ffffff';
      x.fillRect(0, 0, w, h);
      const k = Math.min(w / f.width, h / f.height);
      x.drawImage(f, (w - f.width * k) / 2, (h - f.height * k) / 2, f.width * k, f.height * k);
    }
    frame(enc, c, delay);
  }
  enc.finish();
  return new Blob([enc.bytes() as BlobPart], { type: 'image/gif' });
}
