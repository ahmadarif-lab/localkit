import { signal } from '@preact/signals';
import { History, LayoutGrid, Settings, ShieldCheck, WifiOff, Workflow, X } from 'lucide-preact';
import { t } from '../i18n';
import { goHome, goPage, openTool, route } from '../state';
import { GithubMark, Logo } from './Icons';
import { AccountButton } from './Account';
import { openPalette } from './CommandPalette';
import { Search } from 'lucide-preact';

export const REPO_URL = 'https://github.com/ahmadarif-lab/localkit';

export const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
export const privacyOpen = signal(false);
const online = signal(navigator.onLine);
addEventListener('online', () => (online.value = true));
addEventListener('offline', () => (online.value = false));

type NavId = 'tools' | 'flows' | 'history' | 'settings';

function currentNav(): NavId {
  const r = route.value;
  if (r.view === 'history') return 'history';
  if (r.view === 'settings') return 'settings';
  if (r.view === 'work' && r.tool === 'flow') return 'flows';
  return 'tools';
}

const NAV: { id: NavId; href: string; icon: typeof History; go: () => void }[] = [
  { id: 'tools', href: '/', icon: LayoutGrid, go: goHome },
  { id: 'flows', href: '/flow', icon: Workflow, go: () => openTool('flow') },
  { id: 'history', href: '/history', icon: History, go: () => goPage('history') },
  { id: 'settings', href: '/settings', icon: Settings, go: () => goPage('settings') },
];

export function MainNav() {
  const cur = currentNav();
  return (
    <nav class="mainnav" aria-label="Main">
      {NAV.map(({ id, href, icon: Icon, go }) => (
        <a
          key={id}
          href={href}
          class={cur === id ? 'on' : ''}
          aria-current={cur === id ? 'page' : undefined}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            go();
          }}
        >
          <Icon size={18} strokeWidth={1.9} />
          <span>{t(`nav.${id}`)}</span>
        </a>
      ))}
    </nav>
  );
}

export function Header() {
  return (
    <header class="topbar-wrap">
      <div class="topbar">
        <a
          class="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            goHome();
          }}
        >
          <Logo size={34} />
          <span>
            Local<b>kit</b>
          </span>
        </a>
        <MainNav />
        <div class="topbar-actions">
          <button class="cmdk-btn" onClick={openPalette} aria-label={t('palette.label')} title={t('palette.label')}>
            <Search size={16} />
            <span>{t('palette.short')}</span>
            <kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
          <button class="privacy-pill" onClick={() => (privacyOpen.value = true)}>
            {online.value ? <ShieldCheck size={16} /> : <WifiOff size={16} />}
            <span>{t('privacy.badge')}</span>
          </button>
          <span class="divider hide-sm" aria-hidden="true" />
          <a class="icon-btn hide-sm" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
            <GithubMark size={20} />
          </a>
          <AccountButton />
        </div>
      </div>
      {privacyOpen.value && <PrivacyDialog />}
    </header>
  );
}

function PrivacyDialog() {
  const close = () => (privacyOpen.value = false);
  return (
    <div class="overlay" onClick={close}>
      <div class="dialog privacy" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button class="icon-btn dialog-close" onClick={close} aria-label={t('privacy.close')}>
          <X size={18} />
        </button>
        <div class="privacy-icon">
          <ShieldCheck size={28} />
        </div>
        <h2>{t('privacy.title')}</h2>
        <p>{t('privacy.body')}</p>
        <h3>{t('privacy.verify')}</h3>
        <ol>
          <li>{t('privacy.step1')}</li>
          <li>{t('privacy.step2')}</li>
        </ol>
        <button class="btn primary block" onClick={close}>
          {t('privacy.close')}
        </button>
      </div>
    </div>
  );
}
