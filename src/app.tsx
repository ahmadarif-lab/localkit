import { useEffect, useState } from 'preact/hooks';
import { CircleAlert, Upload } from 'lucide-preact';
import { lang, t } from './i18n';
import { output, route, toasts } from './state';
import { startWithFiles } from './picker';
import { toolById } from './tools';
import { seoFor } from './seo';
import { Header, REPO_URL } from './components/Header';
import { Home } from './components/Home';
import { Workspace } from './components/Workspace';
import { Results } from './components/Results';
import { CommandPalette, paletteOpen, usePaletteShortcut } from './components/CommandPalette';
import { HistoryPage } from './components/HistoryPage';
import { SettingsPage } from './components/SettingsPage';
import { LegalPage } from './components/LegalPage';
import { goPage } from './state';

function useFileDrop() {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length) startWithFiles(files);
    };
    const paste = (e: ClipboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        startWithFiles(files.map((f, i) => (f.name && f.name !== 'image.png' ? f : new File([f], `paste-${Date.now()}-${i + 1}.${f.type.split('/')[1] || 'png'}`, { type: f.type }))));
      }
    };
    addEventListener('dragenter', enter);
    addEventListener('dragover', over);
    addEventListener('dragleave', leave);
    addEventListener('drop', drop);
    addEventListener('paste', paste);
    return () => {
      removeEventListener('dragenter', enter);
      removeEventListener('dragover', over);
      removeEventListener('dragleave', leave);
      removeEventListener('drop', drop);
      removeEventListener('paste', paste);
    };
  }, []);
  return dragging;
}

/** Files opened with the installed PWA ("Open with Localkit"). */
function useLaunchQueue() {
  useEffect(() => {
    const lq = (window as any).launchQueue;
    lq?.setConsumer(async (params: { files: FileSystemFileHandle[] }) => {
      if (!params.files?.length) return;
      const files = await Promise.all(params.files.map((h) => h.getFile()));
      startWithFiles(files);
    });
  }, []);
}

export function App() {
  const dragging = useFileDrop();
  usePaletteShortcut();
  useLaunchQueue();
  document.documentElement.lang = lang.value;
  const r = route.value;
  const slug = r.view === 'work' ? toolById(r.tool).slug : '';
  document.title =
    r.view === 'privacy' || r.view === 'terms'
      ? `${r.view === 'privacy' ? 'Privacy Policy' : 'Terms of Use'} · ${t('app.name')}`
      : r.view === 'history' || r.view === 'settings'
      ? `${t(`nav.${r.view}`)} · ${t('app.name')}`
      : lang.value === 'en'
        ? seoFor(slug).title
        : r.view === 'work'
          ? `${t(`tool.${r.tool}`)} · ${t('app.name')}`
          : `${t('app.name')} · ${t('hero.title')}`;

  return (
    <>
      <Header />
      {route.value.view === 'home' ? (
        <Home />
      ) : route.value.view === 'history' ? (
        <HistoryPage />
      ) : route.value.view === 'settings' ? (
        <SettingsPage />
      ) : route.value.view === 'privacy' || route.value.view === 'terms' ? (
        <LegalPage kind={route.value.view} />
      ) : (
        <Workspace />
      )}
      <footer class="footer">
        <span>{t('app.name')}</span>
        <span>·</span>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          {t('footer.made')}
        </a>
        <span>·</span>
        <a href="/privacy" onClick={(e) => (e.preventDefault(), goPage('privacy'))}>
          {t('footer.privacy')}
        </a>
        <span>·</span>
        <a href="/terms" onClick={(e) => (e.preventDefault(), goPage('terms'))}>
          {t('footer.terms')}
        </a>
      </footer>
      {output.value && <Results />}
      {paletteOpen.value && <CommandPalette />}
      {dragging && (
        <div class="drop-overlay">
          <div>
            <Upload size={36} />
            <b>{t('drop.overlay')}</b>
          </div>
        </div>
      )}
      <div class="toasts" aria-live="polite">
        {toasts.value.map((x) => (
          <div key={x.id} class={`toast ${x.tone}`}>
            {x.tone === 'error' && <CircleAlert size={16} />}
            {x.text}
          </div>
        ))}
      </div>
    </>
  );
}
