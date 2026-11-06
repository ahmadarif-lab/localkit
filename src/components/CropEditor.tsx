import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { ChevronLeft, ChevronRight, X } from 'lucide-preact';
import { t } from '../i18n';
import { pages, setCrop, setCropAll, settings, sourceMap, toast } from '../state';
import { cropEditing } from './ImageSteps';
import { decodeImage, drawBitmap } from '../engine/images';
import { renderPage } from '../engine/pdfjs';
import { centerCrop, parseRatio } from '../engine/raster';
import type { Crop } from '../types';

const RATIOS = ['free', '1:1', '4:5', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3'];
const MIN = 0.04;
const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 };
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Applies a drag of (dx, dy) in fractions to a crop box, keeping it inside the image and at the ratio. */
function dragRect(r: Crop, h: Handle, dx: number, dy: number, ratio: number | null, aspect: number): Crop {
  if (h === 'move') return { ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) };
  let { x, y, w, h: hh } = r;
  const right = x + w;
  const bottom = y + hh;
  if (h.includes('w')) x = clamp(x + dx, 0, right - MIN);
  if (h.includes('e')) w = clamp(w + dx, MIN, 1 - x);
  if (h.includes('n')) y = clamp(y + dy, 0, bottom - MIN);
  if (h.includes('s')) hh = clamp(hh + dy, MIN, 1 - y);
  if (h.includes('w')) w = right - x;
  if (h.includes('n')) hh = bottom - y;
  if (ratio) {
    // ratio in pixels → in fractions of this image
    const fr = ratio / aspect;
    if (h === 'n' || h === 's') w = hh * fr;
    else hh = w / fr;
    // shrink to fit, keeping the anchored edge
    const maxW = h.includes('w') ? right : 1 - x;
    const maxH = h.includes('n') ? bottom : 1 - y;
    const k = Math.min(1, maxW / w, maxH / hh);
    w *= k;
    hh *= k;
    if (h.includes('w')) x = right - w;
    if (h.includes('n')) y = bottom - hh;
    if (h === 'n' || h === 's') x = clamp(r.x + (r.w - w) / 2, 0, 1 - w);
    if (h === 'e' || h === 'w') y = clamp(r.y + (r.h - hh) / 2, 0, 1 - hh);
  }
  return { x, y, w, h: hh };
}

export function CropEditor() {
  const id = cropEditing.value;
  const list = pages.value;
  const idx = list.findIndex((p) => p.id === id);
  const page = list[idx];
  const src = page && sourceMap.value.get(page.sourceId);
  const [url, setUrl] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 1, h: 1 });
  const [ratio, setRatio] = useState<string>(settings.value.cropRatio ?? 'free');
  const [rect, setRect] = useState<Crop>(FULL);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ h: Handle; x: number; y: number; r: Crop } | null>(null);
  const close = () => (cropEditing.value = null);

  // load a preview of the page as displayed (rotation + flip applied)
  useEffect(() => {
    if (!page || !src) return;
    let alive = true;
    (async () => {
      let c: HTMLCanvasElement;
      if (src.kind === 'pdf') ({ canvas: c } = await renderPage(src, page.index, { scale: 2, rotation: page.rotation, maxDim: 1400 }));
      else {
        const bmp = await decodeImage(src.file);
        c = drawBitmap(bmp, { rotation: page.rotation, flipH: page.flipH, flipV: page.flipV, maxDim: 1400 });
        bmp.close();
      }
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.9));
      if (!alive) return;
      const natural =
        src.kind === 'image' && src.width && src.height
          ? page.rotation % 180
            ? { w: src.height, h: src.width }
            : { w: src.width, h: src.height }
          : { w: c.width, h: c.height };
      setDims(natural);
      const r = parseRatio(ratio);
      setRect(page.crop ?? (r ? centerCrop(natural.w, natural.h, r) : FULL));
      setUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Enter') save();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (!page || !src) return null;
  const aspect = dims.w / dims.h;
  const r = parseRatio(ratio);

  const isFull = (c: Crop) => c.x < 0.001 && c.y < 0.001 && c.w > 0.999 && c.h > 0.999;
  const save = () => {
    setCrop(page.id, isFull(rect) ? undefined : rect);
    close();
  };
  const go = (d: number) => {
    setCrop(page.id, isFull(rect) ? undefined : rect);
    const next = list[(idx + d + list.length) % list.length];
    cropEditing.value = next.id;
  };

  const down = (h: Handle) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { h, x: e.clientX, y: e.clientY, r: rect };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !box.current) return;
    const b = box.current.getBoundingClientRect();
    setRect(dragRect(d.r, d.h, (e.clientX - d.x) / b.width, (e.clientY - d.y) / b.height, r, aspect));
  };
  const up = () => (drag.current = null);

  const pick = (v: string) => {
    setRatio(v);
    const rr = parseRatio(v);
    if (rr) setRect(centerCrop(dims.w, dims.h, rr));
  };

  return (
    <div class="overlay crop-overlay" onClick={close}>
      <div class="dialog crop-dialog" role="dialog" aria-modal="true" aria-label={t('crop.title')} onClick={(e) => e.stopPropagation()}>
        <header class="crop-head">
          <h2>{t('crop.title')}</h2>
          <span class="muted">
            {src.name}
            {list.length > 1 && ` · ${idx + 1}/${list.length}`}
          </span>
          <button class="icon-btn dialog-close" onClick={close} aria-label={t('recipe.cancel')}>
            <X size={18} />
          </button>
        </header>

        <div class="chips crop-ratios" role="radiogroup">
          {RATIOS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={ratio === v} class={ratio === v ? 'on' : ''} onClick={() => pick(v)}>
              {v === 'free' ? t('crop.free') : v}
            </button>
          ))}
        </div>

        <div class="crop-stage">
          {list.length > 1 && (
            <button class="icon-btn crop-nav prev" onClick={() => go(-1)} aria-label={t('crop.prev')}>
              <ChevronLeft size={20} />
            </button>
          )}
          {url ? (
            <div class="crop-box" ref={box} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
              <img src={url} alt="" draggable={false} />
              <div
                class="crop-rect"
                style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
                onPointerDown={down('move')}
              >
                <span class="crop-grid" />
                {HANDLES.map((h) => (
                  <span key={h} class={`crop-h h-${h}`} onPointerDown={down(h)} />
                ))}
              </div>
            </div>
          ) : (
            <span class="page-skeleton crop-loading" />
          )}
          {list.length > 1 && (
            <button class="icon-btn crop-nav next" onClick={() => go(1)} aria-label={t('crop.next')}>
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <footer class="crop-foot">
          <span class="readout">
            {Math.round(rect.w * dims.w)} × {Math.round(rect.h * dims.h)} px
          </span>
          <button class="btn ghost" onClick={() => setRect(r ? centerCrop(dims.w, dims.h, r) : FULL)}>
            {t('crop.resetOne')}
          </button>
          {list.length > 1 && (
            <button
              class="btn ghost"
              onClick={() => {
                setCropAll(isFull(rect) ? undefined : rect);
                toast(t('crop.appliedAll', { n: list.length }));
              }}
            >
              {t('crop.applyAll')}
            </button>
          )}
          <button class="btn primary" onClick={save}>
            {t('crop.done')}
          </button>
        </footer>
      </div>
    </div>
  );
}
