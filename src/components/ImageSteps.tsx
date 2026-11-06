import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { signal } from '@preact/signals';
import {
  Crop as CropIcon,
  Eye,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  LoaderCircle,
  MapPin,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  X,
} from 'lucide-preact';
import { formatBytes, t } from '../i18n';
import {
  activeTool,
  flipPages,
  pages,
  rotatePages,
  selectOrientation,
  selection,
  setCropAll,
  settings,
  sourceMap,
  toast,
  updateSettings,
  watermarkLogo,
} from '../state';
import { ColorField, NumberField, PositionPicker, Segmented, Slider, Switch, TextField } from './Controls';
import { RESIZE_PRESETS, renderRaster, resizeTarget } from '../engine/raster';
import { readMeta, type MetaSummary } from '../engine/exif';
import { sourceBytes } from '../engine/pdfjs';
import { modelProgress, modelReady, preloadModel } from '../engine/removebg';
import { DEFAULT_PAGE_NUMBERS, DEFAULT_RESIZE, DEFAULT_WATERMARK } from '../tools';
import type { BorderOpts, PageNumberOpts, Position, ResizeOpts, WatermarkOpts } from '../types';
import { pickFiles } from '../picker';

export const cropEditing = signal<string | null>(null);

export function Section(props: { id: string; title: string; children: ComponentChildren }) {
  return (
    <section class="step" id={`step-${props.id}`}>
      <header class="step-head">
        <h3>{props.title}</h3>
      </header>
      <div class="step-body">{props.children}</div>
    </section>
  );
}

const POS9: Position[] = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

// ---------------------------------------------------------------- resize

export function ResizeStep() {
  return (
    <Section id="resize" title={t('resize.title')}>
      <ResizeFields value={settings.value.resize ?? DEFAULT_RESIZE} onChange={(resize) => updateSettings({ resize })} />
    </Section>
  );
}

export function ResizeFields(props: { value: ResizeOpts; onChange: (r: ResizeOpts) => void }) {
  const r = props.value;
  const set = (patch: Partial<ResizeOpts>) => props.onChange({ ...r, ...patch });
  const first = pages.value[0];
  const src = first && sourceMap.value.get(first.sourceId);
  let preview = '';
  if (src?.width && src.height) {
    const w = first.rotation % 180 ? src.height : src.width;
    const h = first.rotation % 180 ? src.width : src.height;
    const out = resizeTarget(w, h, r);
    preview = `${w} × ${h} → ${out.w} × ${out.h} px`;
  }
  return (
    <>
      <Segmented
        value={r.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: 'px', label: t('resize.px') },
          { value: 'pct', label: t('resize.pct') },
          { value: 'preset', label: t('resize.preset') },
        ]}
      />
      {r.mode === 'px' && (
        <>
          <div class="row2">
            <NumberField label={t('resize.width')} value={r.width} min={0} max={20000} suffix="px" placeholder={t('resize.auto')} onChange={(width) => set({ width })} />
            <NumberField label={t('resize.height')} value={r.height} min={0} max={20000} suffix="px" placeholder={t('resize.auto')} onChange={(height) => set({ height })} />
          </div>
          {r.width > 0 && r.height > 0 && (
            <Segmented
              label={t('resize.fit')}
              value={r.fit}
              onChange={(fit) => set({ fit })}
              small
              options={(['contain', 'cover', 'stretch'] as const).map((v) => ({ value: v, label: t(`resize.fit.${v}`) }))}
            />
          )}
          <p class="hint">{t('resize.autoHint')}</p>
        </>
      )}
      {r.mode === 'pct' && <Slider label={t('resize.scale')} value={r.pct} min={5} max={300} step={5} format={(v) => `${v}%`} onChange={(pct) => set({ pct })} />}
      {r.mode === 'preset' && (
        <div class="presets" role="radiogroup">
          {Object.entries(RESIZE_PRESETS).map(([id, [w, h]]) => (
            <button key={id} type="button" role="radio" aria-checked={r.preset === id} class={r.preset === id ? 'on' : ''} onClick={() => set({ preset: id })}>
              <b>{t(`preset.${id}`)}</b>
              <small>
                {w} × {h}
              </small>
            </button>
          ))}
        </div>
      )}
      {r.mode !== 'pct' && <Switch label={t('resize.noUpscale')} checked={r.noUpscale} onChange={(noUpscale) => set({ noUpscale })} />}
      {preview && <p class="readout">{preview}</p>}
    </>
  );
}

// ---------------------------------------------------------------- crop

const RATIOS = ['free', '1:1', '4:5', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3'];

export function CropStep() {
  const s = settings.value;
  const manual = pages.value.filter((p) => p.crop).length;
  return (
    <Section id="crop" title={t('crop.title')}>
      <div class="field">
        <span class="field-label">{t('crop.ratio')}</span>
        <div class="chips" role="radiogroup">
          {RATIOS.map((r) => {
            const on = (s.cropRatio ?? 'free') === r;
            return (
              <button key={r} type="button" role="radio" aria-checked={on} class={on ? 'on' : ''} onClick={() => updateSettings({ cropRatio: r === 'free' ? null : r })}>
                {r === 'free' ? t('crop.free') : r}
              </button>
            );
          })}
        </div>
      </div>
      <p class="hint">{s.cropRatio ? t('crop.hintRatio') : t('crop.hintFree')}</p>
      <button class="btn" disabled={!pages.value.length} onClick={() => (cropEditing.value = (pages.value.find((p) => selection.value.has(p.id)) ?? pages.value[0]).id)}>
        <CropIcon size={16} /> {t('crop.edit')}
      </button>
      {manual > 0 && (
        <p class="readout">
          {t('crop.manual', { n: manual })}{' '}
          <button class="link-btn" onClick={() => setCropAll(undefined)}>
            {t('crop.reset')}
          </button>
        </p>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- watermark

export function WatermarkFields(props: { value: WatermarkOpts; onChange: (w: WatermarkOpts) => void }) {
  const w = props.value;
  const set = (patch: Partial<WatermarkOpts>) => props.onChange({ ...w, ...patch });
  const logo = watermarkLogo.value;
  return (
    <>
      <Segmented
        value={w.kind}
        onChange={(kind) => set({ kind })}
        options={[
          { value: 'text', label: t('wm.text') },
          { value: 'image', label: t('wm.image') },
        ]}
      />
      {w.kind === 'text' ? (
        <>
          <TextField label={t('wm.textLabel')} value={w.text} placeholder="DRAFT" onInput={(text) => set({ text })} />
          <ColorField label={t('wm.color')} value={w.color} onChange={(color) => set({ color })} />
        </>
      ) : (
        <div class="field">
          <span class="field-label">{t('wm.logo')}</span>
          {logo ? (
            <span class="logo-chip">
              <ImagePlus size={15} />
              <span>{logo.name}</span>
              <button class="icon-btn small" onClick={() => (watermarkLogo.value = null)} aria-label={t('source.remove')}>
                <X size={14} />
              </button>
            </span>
          ) : (
            <button
              class="btn"
              onClick={() =>
                pickFiles('image', (files) => {
                  watermarkLogo.value = files[0];
                })
              }
            >
              <ImagePlus size={16} /> {t('wm.pickLogo')}
            </button>
          )}
          <span class="field-hint">{t('wm.logoHint')}</span>
        </div>
      )}
      <Slider label={t('wm.size')} value={w.size} min={2} max={w.kind === 'image' ? 80 : 40} format={(v) => `${v}%`} onChange={(size) => set({ size })} />
      <Slider label={t('wm.opacity')} value={w.opacity} min={5} max={100} format={(v) => `${v}%`} onChange={(opacity) => set({ opacity })} />
      <Slider label={t('wm.rotation')} value={w.rotation} min={-90} max={90} step={5} format={(v) => `${v}°`} onChange={(rotation) => set({ rotation })} />
      <Switch label={t('wm.tile')} desc={t('wm.tileDesc')} checked={w.tile} onChange={(tile) => set({ tile })} />
      {!w.tile && <PositionPicker label={t('wm.position')} value={w.position} options={POS9} onChange={(position) => set({ position })} />}
    </>
  );
}

export function WatermarkStep() {
  return (
    <Section id="watermark" title={t('wm.title')}>
      <WatermarkFields value={settings.value.watermark ?? DEFAULT_WATERMARK} onChange={(watermark) => updateSettings({ watermark })} />
    </Section>
  );
}

// ---------------------------------------------------------------- border

export function BorderFields(props: { value: BorderOpts; onChange: (b: BorderOpts) => void }) {
  const b = props.value;
  const set = (patch: Partial<BorderOpts>) => props.onChange({ ...b, ...patch });
  return (
    <>
      <Segmented
        value={b.unit}
        onChange={(unit) => set({ unit, size: unit === 'pct' ? Math.min(b.size, 20) : b.size })}
        small
        options={[
          { value: 'px', label: 'px' },
          { value: 'pct', label: t('border.pct') },
        ]}
      />
      <Slider
        label={t('border.size')}
        value={b.size}
        min={0}
        max={b.unit === 'pct' ? 30 : 300}
        format={(v) => (b.unit === 'pct' ? `${v}%` : `${v} px`)}
        onChange={(size) => set({ size })}
      />
      <ColorField label={t('border.color')} value={b.color} onChange={(color) => set({ color })} />
    </>
  );
}

export function BorderStep() {
  return (
    <Section id="border" title={t('border.title')}>
      <BorderFields value={settings.value.border ?? { size: 40, unit: 'px', color: '#ffffff' }} onChange={(border) => updateSettings({ border })} />
    </Section>
  );
}

// ---------------------------------------------------------------- metadata

const metaCache = new Map<string, Promise<MetaSummary>>();
function useMeta(id: string) {
  const [m, setM] = useState<MetaSummary | null>(null);
  useEffect(() => {
    const src = sourceMap.value.get(id);
    if (!src) return;
    let p = metaCache.get(id);
    if (!p) metaCache.set(id, (p = sourceBytes(src).then(readMeta)));
    p.then(setM);
  }, [id]);
  return m;
}

function MetaRow({ id }: { id: string }) {
  const src = sourceMap.value.get(id);
  const m = useMeta(id);
  if (!src) return null;
  return (
    <li>
      <b title={src.name}>{src.name}</b>
      {!m ? (
        <LoaderCircle size={14} class="spin" />
      ) : !m.any ? (
        <span class="meta-clean">
          <ShieldCheck size={14} /> {t('meta.clean')}
        </span>
      ) : (
        <span class="meta-tags">
          {m.gps && (
            <span class="meta-tag danger">
              <MapPin size={13} /> {t('meta.gps')} {m.gps.lat}, {m.gps.lon}
            </span>
          )}
          {m.camera && <span class="meta-tag">{m.camera}</span>}
          {m.date && <span class="meta-tag">{m.date}</span>}
          {m.software && <span class="meta-tag">{m.software}</span>}
          {m.extra
            .filter((x) => x !== 'EXIF')
            .map((x) => (
              <span key={x} class="meta-tag">
                {x}
              </span>
            ))}
        </span>
      )}
    </li>
  );
}

export function MetadataStep() {
  const ids = [...new Set(pages.value.map((p) => p.sourceId))];
  return (
    <Section id="metadata" title={t('meta.title')}>
      <p class="hint">{t('meta.hint')}</p>
      {ids.length > 0 && (
        <ul class="meta-list">
          {ids.map((id) => (
            <MetaRow key={id} id={id} />
          ))}
        </ul>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- remove background

export function RemoveBgStep() {
  const r = settings.value.removeBg ?? { bg: 'transparent' as const, color: '#ffffff' };
  const set = (patch: Partial<typeof r>) => updateSettings({ removeBg: { ...r, ...patch } });
  const prog = modelProgress.value;
  return (
    <Section id="removebg" title={t('rbg.title')}>
      <Segmented
        label={t('rbg.bg')}
        value={r.bg}
        onChange={(bg) => {
          set({ bg });
          if (bg === 'transparent' && settings.value.imageFormat === 'jpeg') updateSettings({ imageFormat: 'png' });
        }}
        small
        options={[
          { value: 'transparent', label: t('rbg.transparent') },
          { value: 'white', label: t('rbg.white') },
          { value: 'color', label: t('rbg.color') },
        ]}
      />
      {r.bg === 'color' && <ColorField label={t('rbg.color')} value={r.color} onChange={(color) => set({ color })} />}
      {prog ? (
        <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={prog.total} aria-valuenow={prog.loaded}>
          <span style={{ width: `${(prog.loaded / prog.total) * 100}%` }} />
          <small>{t('rbg.downloading', { done: formatBytes(prog.loaded), total: formatBytes(prog.total) })}</small>
        </div>
      ) : modelReady.value ? (
        <p class="readout ok">
          <ShieldCheck size={14} /> {t('rbg.ready')}
        </p>
      ) : (
        <>
          <p class="hint">{t('rbg.hint')}</p>
          <button class="btn" onClick={() => preloadModel().catch((e) => toast(String(e?.message ?? e), 'error'))}>
            {t('rbg.prepare')}
          </button>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- page numbers

export function PageNumberFields(props: { value: PageNumberOpts; onChange: (o: PageNumberOpts) => void }) {
  const o = props.value;
  const set = (patch: Partial<PageNumberOpts>) => props.onChange({ ...o, ...patch });
  return (
    <>
      <PositionPicker label={t('pn.position')} value={o.position} options={['tl', 'tc', 'tr', 'bl', 'bc', 'br']} onChange={(position) => set({ position })} />
      <Segmented
        label={t('pn.format')}
        value={o.format}
        onChange={(format) => set({ format })}
        small
        options={[
          { value: 'n', label: '3' },
          { value: 'n-of-total', label: '3 / 10' },
          { value: 'page-n', label: t('pn.label', { n: 3 }) },
        ]}
      />
      <div class="row2">
        <NumberField label={t('pn.start')} value={o.start} min={1} max={9999} onChange={(start) => set({ start: start || 1 })} />
        <NumberField label={t('pn.size')} value={o.size} min={6} max={48} suffix="pt" onChange={(size) => set({ size: size || 11 })} />
      </div>
    </>
  );
}

export function PageNumbersStep() {
  return (
    <Section id="pagenumbers" title={t('pn.title')}>
      <PageNumberFields value={settings.value.pageNumbers ?? DEFAULT_PAGE_NUMBERS} onChange={(pageNumbers) => updateSettings({ pageNumbers })} />
    </Section>
  );
}

// ---------------------------------------------------------------- rotate

export function RotateStep() {
  const all = pages.value.map((p) => p.id);
  const target = () => (selection.value.size ? [...selection.value] : all);
  const isImg = activeTool.value.category === 'image';
  return (
    <Section id="rotate" title={t('rot.title')}>
      <p class="hint">{selection.value.size ? t('rot.selected', { n: selection.value.size }) : t('rot.all')}</p>
      <div class="btn-grid">
        <button class="btn" disabled={!all.length} onClick={() => rotatePages(target(), -90)}>
          <RotateCcw size={16} /> {t('board.rotateL')}
        </button>
        <button class="btn" disabled={!all.length} onClick={() => rotatePages(target(), 90)}>
          <RotateCw size={16} /> {t('board.rotateR')}
        </button>
        {isImg && (
          <>
            <button class="btn" disabled={!all.length} onClick={() => flipPages(target(), 'h')}>
              <FlipHorizontal2 size={16} /> {t('rot.flipH')}
            </button>
            <button class="btn" disabled={!all.length} onClick={() => flipPages(target(), 'v')}>
              <FlipVertical2 size={16} /> {t('rot.flipV')}
            </button>
          </>
        )}
      </div>
      <div class="field">
        <span class="field-label">{t('rot.pick')}</span>
        <div class="chips">
          <button onClick={() => toast(t('rot.picked', { n: selectOrientation('portrait') }))}>{t('orientation.portrait')}</button>
          <button onClick={() => toast(t('rot.picked', { n: selectOrientation('landscape') }))}>{t('orientation.landscape')}</button>
          {selection.value.size > 0 && <button onClick={() => (selection.value = new Set())}>{t('board.clearSel')}</button>}
        </div>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------- live preview

/** Small rendered preview of the first (or first selected) page with the current settings. */
export function OpsPreview() {
  const tool = activeTool.value;
  const s = settings.value;
  const list = pages.value;
  const page = list.find((p) => selection.value.has(p.id)) ?? list[0];
  const src = page && sourceMap.value.get(page.sourceId);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wantBg, setWantBg] = useState(false);
  const seq = useRef(0);
  const heavy = !!s.removeBg && !wantBg;
  const logo = watermarkLogo.value;

  useEffect(() => {
    if (!page || !src || heavy) return;
    const my = ++seq.current;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const logoBmp = s.watermark?.kind === 'image' && logo ? await createImageBitmap(logo) : null;
        const c = await renderRaster(src, page, s, { dpi: 72, logo: logoBmp, preview: 560 });
        if (s.pageNumbers) drawPageNumberPreview(c, s.pageNumbers);
        const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
        if (my !== seq.current) return;
        setUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
      } catch (e) {
        console.error(e);
      } finally {
        if (my === seq.current) setBusy(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [page, src, s, heavy, logo]);

  useEffect(() => () => url && URL.revokeObjectURL(url), []);
  if (!page || !src || tool.category === 'flow') return null;

  return (
    <section class="ops-preview">
      <header>
        <Eye size={15} /> {t('preview.title')}
        {busy && <LoaderCircle size={14} class="spin" />}
      </header>
      <div class="ops-canvas checker">
        {heavy ? (
          <button class="btn small" onClick={() => setWantBg(true)}>
            <Eye size={15} /> {t('rbg.previewBtn')}
          </button>
        ) : url ? (
          <img src={url} alt="" />
        ) : (
          <span class="page-skeleton" />
        )}
      </div>
    </section>
  );
}

function drawPageNumberPreview(c: HTMLCanvasElement, o: PageNumberOpts) {
  const x = c.getContext('2d')!;
  const px = Math.max(9, (o.size / 72) * 72 * (c.width / 595));
  const text = o.format === 'n' ? `${o.start}` : o.format === 'n-of-total' ? `${o.start} / ${o.start + pages.value.length - 1}` : t('pn.label', { n: o.start });
  x.font = `${px}px Helvetica, Arial, sans-serif`;
  x.fillStyle = '#404040';
  x.textBaseline = 'middle';
  const w = x.measureText(text).width;
  const m = Math.max(18 * (c.width / 595), Math.min(c.width, c.height) * 0.045);
  const cx = o.position[1] === 'l' ? m : o.position[1] === 'c' ? (c.width - w) / 2 : c.width - m - w;
  const cy = o.position[0] === 't' ? m + px / 2 : c.height - m - px / 2;
  x.fillText(text, cx, cy);
}
