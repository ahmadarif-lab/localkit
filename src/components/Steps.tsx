import type { ComponentChildren } from 'preact';
import { FileStack, FileText, Files, Images, LoaderCircle, Play } from 'lucide-preact';
import { t } from '../i18n';
import {
  activeTool,
  hasImages,
  hasPdfs,
  outputCount,
  pages,
  processAll,
  progress,
  rangeCheck,
  settings,
  updateSettings,
} from '../state';
import { Choice, Segmented, Slider, Switch, TextField } from './Controls';
import {
  BorderStep,
  CropStep,
  MetadataStep,
  OpsPreview,
  PageNumbersStep,
  RemoveBgStep,
  ResizeStep,
  RotateStep,
  WatermarkStep,
} from './ImageSteps';
import type { CompressLevel, ImageFormat, OutputKind, Settings } from '../types';
import type { StepId } from '../tools';

function Step(props: { id: string; title: string; children: ComponentChildren }) {
  return (
    <section class="step" id={`step-${props.id}`}>
      <header class="step-head">
        <h3>{props.title}</h3>
      </header>
      <div class="step-body">{props.children}</div>
    </section>
  );
}

const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => updateSettings({ [k]: v } as Partial<Settings>);

function PageSizeStep() {
  const s = settings.value;
  return (
    <Step id="pagesize" title={t('pagesize.title')}>
      <Segmented
        label={t('pagesize.size')}
        value={s.pageSize}
        onChange={set('pageSize')}
        options={[
          { value: 'fit', label: t('pagesize.fit') },
          { value: 'a4', label: 'A4' },
          { value: 'letter', label: 'Letter' },
        ]}
      />
      {s.pageSize !== 'fit' && (
        <Segmented
          label={t('pagesize.orientation')}
          value={s.orientation}
          onChange={set('orientation')}
          small
          options={(['auto', 'portrait', 'landscape'] as const).map((v) => ({ value: v, label: t(`orientation.${v}`) }))}
        />
      )}
      <Segmented
        label={t('pagesize.margin')}
        value={s.margin}
        onChange={set('margin')}
        small
        options={(['none', 'small', 'large'] as const).map((v) => ({ value: v, label: t(`margin.${v}`) }))}
      />
    </Step>
  );
}

function CompressStep() {
  const s = settings.value;
  const showPdfMode = s.compress !== 'none' && hasPdfs.value && s.output !== 'images';
  return (
    <Step id="compress" title={t('compress.title')}>
      <Segmented<CompressLevel>
        value={s.compress}
        onChange={set('compress')}
        options={(['none', 'light', 'medium', 'strong', 'custom'] as const).map((v) => ({
          value: v,
          label: t(`compress.${v}`),
        }))}
      />
      <p class="hint">{t(`compress.hint.${s.compress}`)}</p>
      {s.compress === 'custom' && (
        <div class="custom">
          <Slider label={t('compress.quality')} value={s.quality} min={20} max={95} format={(v) => `${v}%`} onChange={set('quality')} />
          <Slider
            label={t('compress.maxDim')}
            value={s.maxDim}
            min={600}
            max={4000}
            step={100}
            format={(v) => `${v} px`}
            onChange={set('maxDim')}
          />
        </div>
      )}
      {showPdfMode && (
        <>
          <Segmented
            label={t('compress.pdfMode')}
            value={s.pdfMode}
            onChange={set('pdfMode')}
            small
            options={[
              { value: 'smart', label: t('pdfMode.smart') },
              { value: 'raster', label: t('pdfMode.raster') },
            ]}
          />
          <p class="hint">{t(`pdfMode.hint.${s.pdfMode}`)}</p>
        </>
      )}
    </Step>
  );
}

const OUTPUT_ICONS: Record<OutputKind, ComponentChildren> = {
  pdf: <FileText size={18} />,
  split: <Files size={18} />,
  'per-source': <FileStack size={18} />,
  images: <Images size={18} />,
};

const FORMAT_LABEL: Partial<Record<ImageFormat, string>> = { jpeg: 'JPG', png: 'PNG', webp: 'WebP', gif: 'GIF' };

function OutputStep() {
  const s = settings.value;
  const tool = activeTool.value;
  const formats = (tool.formats ?? ['auto', 'jpeg', 'png', 'webp']).filter((f) => f !== 'auto' || hasImages.value);
  const range = rangeCheck.value;
  return (
    <Step id="output" title={t('output.title')}>
      {tool.outputs.length > 1 && (
        <div class="choices" role="radiogroup">
          {tool.outputs.map((o) => (
            <Choice
              key={o}
              on={s.output === o}
              icon={OUTPUT_ICONS[o]}
              title={t(`output.${o}`)}
              desc={t(`output.${o}.desc`)}
              onClick={() => updateSettings({ output: o })}
            />
          ))}
        </div>
      )}

      {s.output === 'split' && (
        <>
          <Segmented
            value={s.splitMode}
            onChange={set('splitMode')}
            small
            options={[
              { value: 'ranges', label: t('split.ranges') },
              { value: 'each', label: t('split.each') },
              { value: 'chunk', label: t('split.chunk') },
            ]}
          />
          {s.splitMode === 'ranges' && (
            <TextField
              label={t('split.rangesLabel')}
              value={s.ranges}
              placeholder={t('split.rangesPlaceholder')}
              onInput={set('ranges')}
              error={range && pages.value.length ? t(range.key, range.vars) : null}
              hint={t('split.rangesHint')}
            />
          )}
          {s.splitMode === 'chunk' && (
            <TextField
              label={t('split.chunkLabel')}
              type="number"
              min={1}
              value={String(s.chunk)}
              onInput={(v) => updateSettings({ chunk: Math.max(1, parseInt(v, 10) || 1) })}
            />
          )}
        </>
      )}

      {s.output === 'images' && (
        <>
          {formats.length > 1 && (
            <Segmented<ImageFormat>
              label={t('images.format')}
              value={s.imageFormat}
              onChange={(imageFormat) => updateSettings({ imageFormat, animate: imageFormat === 'gif' ? s.animate : null })}
              small
              options={formats.map((f) => ({ value: f, label: FORMAT_LABEL[f] ?? t('format.auto') }))}
            />
          )}
          {s.imageFormat === 'gif' && (
            <>
              <Switch
                label={t('gif.animate')}
                desc={t('gif.animateDesc')}
                checked={!!s.animate}
                onChange={(on) => updateSettings({ animate: on ? { delay: 500 } : null })}
              />
              {s.animate && (
                <Slider
                  label={t('gif.delay')}
                  value={s.animate.delay}
                  min={100}
                  max={3000}
                  step={100}
                  format={(v) => `${(v / 1000).toFixed(1)} s`}
                  onChange={(delay) => updateSettings({ animate: { delay } })}
                />
              )}
            </>
          )}
          {s.imageFormat === 'png' && s.compress !== 'none' && <p class="hint">{t('images.pngNote')}</p>}
          {hasPdfs.value && (
            <Segmented
              label={t('images.dpi')}
              value={s.dpi}
              onChange={set('dpi')}
              small
              options={[72, 150, 200, 300].map((v) => ({ value: v, label: `${v} dpi` }))}
            />
          )}
        </>
      )}

      {s.output !== 'per-source' && (
        <TextField
          label={t('output.fileName')}
          value={s.fileName}
          placeholder={t('output.fileName.auto')}
          onInput={set('fileName')}
        />
      )}
    </Step>
  );
}

export function Steps() {
  const tool = activeTool.value;
  const s = settings.value;
  const visible = tool.steps.filter(
    (id: StepId) =>
      (id !== 'pagesize' || (hasImages.value && s.output !== 'images')) &&
      // the output step only has something to show for some tools
      (id !== 'output' || tool.outputs.length > 1 || s.output !== 'images' || (tool.formats?.length ?? 2) > 1 || pages.value.length > 0),
  );
  const pixelTool = tool.category === 'image' || tool.id === 'watermark-pdf' || tool.id === 'page-numbers';
  const p = progress.value;
  const blocked = !pages.value.length || !!rangeCheck.value;
  const count = outputCount.value;
  return (
    <aside class="steps">
      {pixelTool && <OpsPreview />}
      {visible.map((id) => {
        switch (id) {
          case 'pagesize':
            return <PageSizeStep key={id} />;
          case 'compress':
            return <CompressStep key={id} />;
          case 'resize':
            return <ResizeStep key={id} />;
          case 'crop':
            return <CropStep key={id} />;
          case 'watermark':
            return <WatermarkStep key={id} />;
          case 'border':
            return <BorderStep key={id} />;
          case 'metadata':
            return <MetadataStep key={id} />;
          case 'removebg':
            return <RemoveBgStep key={id} />;
          case 'pagenumbers':
            return <PageNumbersStep key={id} />;
          case 'rotate':
            return <RotateStep key={id} />;
          default:
            return <OutputStep key={id} />;
        }
      })}

      <div class="run">
        <button class="btn primary big block" disabled={blocked || !!p} onClick={processAll}>
          {p ? (
            <>
              <LoaderCircle size={18} class="spin" /> {t('processing')}
            </>
          ) : (
            <>
              <Play size={17} /> {t('process')}
            </>
          )}
        </button>
        {p ? (
          <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done}>
            <span style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} />
            <small>{t(p.key, p.vars)}</small>
          </div>
        ) : (
          count > 0 && <p class="run-note">{t('output.willMake', { n: count })}</p>
        )}
      </div>
    </aside>
  );
}
