import { useState } from 'preact/hooks';
import { ArrowRight, Download, FileArchive, History as HistoryIcon, Info, LoaderCircle, Trash, X } from 'lucide-preact';
import { formatBytes, lang, t } from '../i18n';
import { clearHistory, history, historyEnabled, removeEntry, sessionFiles, type HistoryEntry } from '../history';
import { goHome, goPage, openTool } from '../state';
import { ToolIcon } from './Icons';
import { download } from './Results';

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86_400_000);
  if (diff === 0) return t('history.today');
  if (diff === 1) return t('history.yesterday');
  return d.toLocaleDateString(lang.value === 'id' ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const time = (ts: number) => new Date(ts).toLocaleTimeString(lang.value === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' });

function Entry({ e }: { e: HistoryEntry }) {
  const [busy, setBusy] = useState(false);
  const files = sessionFiles.get(e.id);
  const total = e.outputs.reduce((n, o) => n + o.size, 0);
  const pct = e.inputs.bytes ? Math.round((1 - total / e.inputs.bytes) * 100) : 0;

  const downloadAll = async () => {
    if (!files) return;
    if (files.length === 1) return download(files[0].blob, files[0].name);
    setBusy(true);
    try {
      const { zipResults } = await import('../engine/build');
      download(await zipResults(files), `${e.outputs[0].name.replace(/\.[^.]+$/, '').replace(/-\d+$/, '')}.zip`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li class="h-entry">
      <span class="h-icon">
        <ToolIcon id={e.tool} size={22} />
      </span>
      <div class="h-main">
        <div class="h-title">
          <b>{t(`tool.${e.tool}`)}</b>
          <span class="muted">{time(e.at)}</span>
        </div>
        <p class="h-sum">
          {t('history.inputs', { n: e.inputs.count })} · {formatBytes(e.inputs.bytes)}
          <ArrowRight size={13} />
          {t('history.outputs', { n: e.outputs.length })} · {formatBytes(total)}
          {pct >= 1 && <span class="delta good">{t('results.saved', { pct: `${pct}%` })}</span>}
        </p>
        <ul class="h-files">
          {e.outputs.slice(0, 4).map((o, i) => (
            <li key={i} title={o.name}>
              {o.name}
            </li>
          ))}
          {e.outputs.length > 4 && <li class="more">+{e.outputs.length - 4}</li>}
        </ul>
      </div>
      <div class="h-actions">
        {files ? (
          <button class="btn small" onClick={downloadAll} disabled={busy}>
            {busy ? <LoaderCircle size={15} class="spin" /> : files.length > 1 ? <FileArchive size={15} /> : <Download size={15} />}
            {files.length > 1 ? t('history.downloadZip') : t('results.download')}
          </button>
        ) : (
          <button class="btn small ghost" onClick={() => openTool(e.tool)} title={t('history.gone')}>
            {t('history.again')}
          </button>
        )}
        <button class="icon-btn small" onClick={() => removeEntry(e.id)} aria-label={t('history.remove')} title={t('history.remove')}>
          <X size={15} />
        </button>
      </div>
    </li>
  );
}

export function HistoryPage() {
  const list = history.value;
  const groups: [string, HistoryEntry[]][] = [];
  for (const e of list) {
    const label = dayLabel(e.at);
    const g = groups.at(-1);
    if (g && g[0] === label) g[1].push(e);
    else groups.push([label, [e]]);
  }

  return (
    <main class="subpage">
      <div class="page-head">
        <div>
          <h1>{t('history.title')}</h1>
          <p>{t('history.desc')}</p>
        </div>
        {list.length > 0 && (
          <button class="btn ghost" onClick={clearHistory}>
            <Trash size={16} /> {t('history.clear')}
          </button>
        )}
      </div>

      {!historyEnabled.value && (
        <p class="notice">
          <Info size={16} />
          <span>
            {t('history.off')}{' '}
            <a
              href="/settings"
              onClick={(ev) => {
                ev.preventDefault();
                goPage('settings');
              }}
            >
              {t('nav.settings')}
            </a>
          </span>
        </p>
      )}

      {!list.length ? (
        <div class="empty-state">
          <span class="empty-icon">
            <HistoryIcon size={28} />
          </span>
          <b>{t('history.empty')}</b>
          <small>{t('history.empty.sub')}</small>
          <button class="btn primary" onClick={goHome}>
            {t('history.start')}
          </button>
        </div>
      ) : (
        groups.map(([label, entries]) => (
          <section key={label} class="h-group">
            <h2>{label}</h2>
            <ul>
              {entries.map((e) => (
                <Entry key={e.id} e={e} />
              ))}
            </ul>
          </section>
        ))
      )}
      {list.length > 0 && <p class="hint center">{t('history.note')}</p>}
    </main>
  );
}
