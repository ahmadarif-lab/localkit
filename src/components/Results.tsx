import { useEffect, useMemo, useState } from 'preact/hooks';
import { CircleAlert, Download, ExternalLink, FileArchive, FileText, Image as ImageIcon, LoaderCircle, PartyPopper, X } from 'lucide-preact';
import { formatBytes, t } from '../i18n';
import { clearAll, goHome, output, settings } from '../state';
import { stripExt } from '../engine/names';

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Delta({ before, after }: { before: number; after: number }) {
  if (!before) return null;
  const ratio = after / before;
  const pct = `${Math.round(Math.abs(1 - ratio) * 100)}%`;
  if (Math.abs(1 - ratio) < 0.005) return null;
  return ratio < 1 ? (
    <span class="delta good">{t('results.saved', { pct })}</span>
  ) : (
    <span class="delta bad">{t('results.bigger', { pct })}</span>
  );
}

export function Results() {
  const out = output.value!;
  const [zipping, setZipping] = useState(false);
  const urls = useMemo(() => out.results.map((r) => URL.createObjectURL(r.blob)), [out]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);

  const total = out.results.reduce((n, r) => n + r.blob.size, 0);
  const compare = settings.value.compress !== 'none' || out.results.every((r) => r.kind === 'pdf');
  const close = () => (output.value = null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const zipAll = async () => {
    setZipping(true);
    try {
      const first = out.results[0];
      const base = settings.value.fileName.trim() || stripExt(first.name).replace(/-\d+$/, '') || 'localkit';
      const { zipResults } = await import('../engine/build');
      download(await zipResults(out.results), `${base}.zip`);
    } finally {
      setZipping(false);
    }
  };

  return (
    <div class="overlay" onClick={close}>
      <div class="dialog results" role="dialog" aria-modal="true" aria-labelledby="results-title" onClick={(e) => e.stopPropagation()}>
        <button class="icon-btn dialog-close" onClick={close} aria-label={t('results.back')}>
          <X size={18} />
        </button>
        <header class="results-head">
          <span class="results-icon">
            <PartyPopper size={24} />
          </span>
          <div>
            <h2 id="results-title">{t('results.title')}</h2>
            <p>
              {t('results.sub', { n: out.results.length })} · <b>{formatBytes(total)}</b>
              {compare && (
                <>
                  {' '}
                  <span class="muted">{t('results.from', { size: formatBytes(out.inputBytes) })}</span>{' '}
                  <Delta before={out.inputBytes} after={total} />
                </>
              )}
            </p>
          </div>
        </header>

        {out.warnings.length > 0 && (
          <ul class="warnings">
            {out.warnings.map((w) => (
              <li key={w}>
                <CircleAlert size={16} /> {t(w)}
              </li>
            ))}
          </ul>
        )}

        <ul class="result-list">
          {out.results.map((r, i) => (
            <li key={r.name}>
              <span class={`result-icon ${r.kind}`}>{r.kind === 'pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}</span>
              <span class="result-text">
                <b title={r.name}>{r.name}</b>
                <small>
                  {formatBytes(r.blob.size)}
                  {r.kind === 'pdf' && ` · ${t('sum.pages', { n: r.pages })}`}
                  {r.unchanged && ` · ${t('results.unchanged')}`}
                </small>
              </span>
              <a class="icon-btn" href={urls[i]} target="_blank" rel="noopener" title={t('results.open')} aria-label={t('results.open')}>
                <ExternalLink size={17} />
              </a>
              <button class="btn small" onClick={() => download(r.blob, r.name)}>
                <Download size={15} /> {t('results.download')}
              </button>
            </li>
          ))}
        </ul>

        <footer class="results-foot">
          {out.results.length > 1 && (
            <button class="btn primary" onClick={zipAll} disabled={zipping}>
              {zipping ? <LoaderCircle size={16} class="spin" /> : <FileArchive size={16} />} {t('results.downloadAll')}
            </button>
          )}
          {out.results.length === 1 && (
            <button class="btn primary" onClick={() => download(out.results[0].blob, out.results[0].name)}>
              <Download size={16} /> {t('results.download')}
            </button>
          )}
          <button class="btn ghost" onClick={close}>
            {t('results.back')}
          </button>
          <button
            class="btn ghost"
            onClick={() => {
              clearAll();
              goHome();
            }}
          >
            {t('results.newJob')}
          </button>
        </footer>
      </div>
    </div>
  );
}
