import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { CloudCheck, CloudOff, LoaderCircle, LogIn, LogOut, RefreshCw, Settings } from 'lucide-preact';
import { lang, t } from '../i18n';
import { account, lastSync, signIn, signOut, syncNow, syncState } from '../cloud';
import { goPage } from '../state';

export function initials(a: { email: string; name: string | null }) {
  const src = (a.name || a.email).trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function syncLabel() {
  const s = syncState.value;
  if (s === 'syncing') return t('cloud.syncing');
  if (s === 'error') return t('cloud.error');
  if (s === 'offline') return t('cloud.offline');
  if (lastSync.value) {
    const time = new Date(lastSync.value).toLocaleTimeString(lang.value === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    return t('cloud.synced', { time });
  }
  return t('cloud.idle');
}

export function SyncIcon({ size = 15 }: { size?: number }) {
  const s = syncState.value;
  if (s === 'syncing') return <LoaderCircle size={size} class="spin" />;
  if (s === 'error' || s === 'offline') return <CloudOff size={size} />;
  return <CloudCheck size={size} />;
}

/** Header control: "Sign in" button, or the account chip with a small menu. */
export function AccountButton() {
  const a = account.value;
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', down);
    addEventListener('keydown', key);
    return () => {
      removeEventListener('pointerdown', down);
      removeEventListener('keydown', key);
    };
  }, [open]);

  if (!a) {
    return (
      <button class="btn small signin-btn" onClick={signIn} title={t('cloud.signInHint')}>
        <LogIn size={15} /> <span>{t('cloud.signIn')}</span>
      </button>
    );
  }
  return (
    <div class="account" ref={root}>
      <button class={`avatar-btn state-${syncState.value}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label={a.email} title={`${a.email} · ${syncLabel()}`}>
        <span class="avatar">{initials(a)}</span>
        <span class="sync-dot" />
      </button>
      {open && (
        <div class="account-pop" role="menu">
          <div class="account-who">
            <span class="avatar big">{initials(a)}</span>
            <span>
              <b>{a.name || a.email}</b>
              <small>{a.email}</small>
            </span>
          </div>
          <p class={`account-sync state-${syncState.value}`}>
            <SyncIcon /> {syncLabel()}
          </p>
          <button role="menuitem" onClick={() => syncNow()} disabled={syncState.value === 'syncing'}>
            <RefreshCw size={15} /> {t('cloud.syncNow')}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              goPage('settings');
            }}
          >
            <Settings size={15} /> {t('cloud.manage')}
          </button>
          <button role="menuitem" onClick={() => (setOpen(false), signOut())}>
            <LogOut size={15} /> {t('cloud.signOut')}
          </button>
        </div>
      )}
    </div>
  );
}
