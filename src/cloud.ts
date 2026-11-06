import { batch, effect, signal } from '@preact/signals';
import { lang, setLang, type Lang } from './i18n';
import { setTheme, themePref, type ThemePref } from './theme';
import { applyHistory, history, historyEnabled, historyTombstones, setHistoryEnabled, type HistoryEntry } from './history';
import { applyRecipes, recipes, recipeTombstones, toast, type Recipe } from './state';
import { t } from './i18n';

/**
 * Optional cloud save (Google sign-in). Only saved flows, settings and,
 * if enabled, history metadata are synced; files never leave the device.
 *
 * Lists are merged per item (newest edit wins, deletions are tombstones), the
 * settings document is last-write-wins. Every PUT carries the version it was
 * based on; on a conflict the client re-reads, merges and tries again.
 */

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://localkit-api.ahmadarif.id';
const TOKEN_KEY = 'localkit:token';
const SYNC_HISTORY_KEY = 'localkit:sync-history';
const SETTINGS_AT_KEY = 'localkit:settings-at';
/** per-tab sign-in nonce; sessionStorage survives the redirect to Google and back */
const SIGNIN_KEY = 'localkit:signin';
const SIGNIN_TTL = 10 * 60_000;
const TOMBSTONE_TTL = 120 * 86_400_000;

export interface Account {
  email: string;
  name: string | null;
}

export type SyncState = 'idle' | 'syncing' | 'ok' | 'error' | 'offline';

export const account = signal<Account | null>(null);
export const syncState = signal<SyncState>('idle');
export const lastSync = signal<number | null>(null);
export const syncHistory = signal<boolean>(read(SYNC_HISTORY_KEY) === '1');

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string | null) {
  try {
    if (v === null) localStorage.removeItem(key);
    else localStorage.setItem(key, v);
  } catch {}
}

let token = read(TOKEN_KEY);
let settingsAt = Number(read(SETTINGS_AT_KEY) ?? 0);
/** true while remote data is being applied, so it is not mistaken for a local edit */
let applying = false;

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
  });
  if (res.status === 401) {
    forgetSession();
    throw new Error('unauthorized');
  }
  return res;
}

function forgetSession() {
  token = null;
  write(TOKEN_KEY, null);
  account.value = null;
  syncState.value = 'idle';
}

// ---------------------------------------------------------------- merging

interface ListDoc<T> {
  items: T[];
  deleted: Record<string, number>;
}

function mergeList<T extends { id: string }>(a: ListDoc<T>, b: ListDoc<T>, stamp: (x: T) => number, order: (x: T[]) => T[]): ListDoc<T> {
  const cutoff = Date.now() - TOMBSTONE_TTL;
  const deleted: Record<string, number> = {};
  for (const d of [a.deleted ?? {}, b.deleted ?? {}])
    for (const [id, at] of Object.entries(d)) if (at > cutoff) deleted[id] = Math.max(deleted[id] ?? 0, at);
  const byId = new Map<string, T>();
  for (const it of [...(a.items ?? []), ...(b.items ?? [])]) {
    const cur = byId.get(it.id);
    if (!cur || stamp(it) > stamp(cur)) byId.set(it.id, it);
  }
  const items = order([...byId.values()].filter((it) => !(deleted[it.id] >= stamp(it))));
  return { items, deleted };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

interface SettingsDoc {
  lang: Lang;
  theme: ThemePref;
  historyEnabled: boolean;
  syncHistory: boolean;
  at: number;
}

const localSettings = (): SettingsDoc => ({
  lang: lang.value,
  theme: themePref.value,
  historyEnabled: historyEnabled.value,
  syncHistory: syncHistory.value,
  at: settingsAt,
});

interface Channel<D> {
  key: 'flows' | 'settings' | 'history';
  local: () => D;
  merge: (local: D, remote: D) => D;
  apply: (d: D) => void;
}

const flowsChannel: Channel<ListDoc<Recipe>> = {
  key: 'flows',
  local: () => ({ items: recipes.value, deleted: recipeTombstones.value }),
  merge: (l, r) =>
    mergeList(l, r, (x) => x.updatedAt ?? 0, (xs) => xs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))),
  apply: (d) => applyRecipes(d.items, d.deleted),
};

const historyChannel: Channel<ListDoc<HistoryEntry>> = {
  key: 'history',
  local: () => ({ items: history.value, deleted: historyTombstones.value }),
  merge: (l, r) => mergeList(l, r, (x) => x.at, (xs) => xs.sort((a, b) => b.at - a.at).slice(0, 200)),
  apply: (d) => applyHistory(d.items, d.deleted),
};

const settingsChannel: Channel<SettingsDoc> = {
  key: 'settings',
  local: localSettings,
  merge: (l, r) => (r && r.at > l.at ? r : l),
  apply: (d) => {
    if (d.lang !== lang.value) setLang(d.lang);
    if (d.theme !== themePref.value) setTheme(d.theme);
    if (d.historyEnabled !== historyEnabled.value) setHistoryEnabled(d.historyEnabled);
    if (d.syncHistory !== syncHistory.value) {
      syncHistory.value = d.syncHistory;
      write(SYNC_HISTORY_KEY, d.syncHistory ? '1' : '0');
    }
    settingsAt = d.at;
    write(SETTINGS_AT_KEY, String(d.at));
  },
};

async function syncChannel<D>(ch: Channel<D>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote: { data: D | null; version: number } = await (await api(`/v1/data/${ch.key}`)).json();
    const local = ch.local();
    const merged = remote.data ? ch.merge(local, remote.data) : local;
    if (!same(merged, local)) {
      applying = true;
      try {
        batch(() => ch.apply(merged));
      } finally {
        applying = false;
      }
    }
    if (remote.data && same(merged, remote.data)) return;
    const res = await api(`/v1/data/${ch.key}`, { method: 'PUT', body: JSON.stringify({ data: merged, baseVersion: remote.version }) });
    if (res.status === 409) continue;
    if (!res.ok) throw new Error(`sync ${ch.key}: ${res.status}`);
    return;
  }
  throw new Error(`sync ${ch.key}: too many conflicts`);
}

let running: Promise<void> | null = null;
let again = false;

/** Syncs everything now. Concurrent calls are coalesced into one extra run. */
export function syncNow(): Promise<void> {
  if (!token) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    if (!navigator.onLine) {
      syncState.value = 'offline';
      return;
    }
    syncState.value = 'syncing';
    try {
      await syncChannel(settingsChannel);
      await syncChannel(flowsChannel);
      if (syncHistory.value) await syncChannel(historyChannel);
      syncState.value = 'ok';
      lastSync.value = Date.now();
    } catch (e) {
      console.warn(e);
      if (token) syncState.value = 'error';
    }
  })().finally(() => {
    running = null;
    if (again) {
      again = false;
      syncNow();
    }
  });
  return running;
}

let timer: ReturnType<typeof setTimeout> | undefined;
function scheduleSync() {
  if (!token) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, 1500);
}

// ---------------------------------------------------------------- account

export function signIn() {
  const ret = `${location.origin}${location.pathname}`;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(24)));
  try {
    sessionStorage.setItem(SIGNIN_KEY, JSON.stringify({ nonce, exp: Date.now() + SIGNIN_TTL }));
  } catch {}
  location.href = `${API_URL}/auth/google/start?return=${encodeURIComponent(ret)}&nonce=${nonce}`;
}

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Returns and clears the nonce of the sign-in this tab started, if it is still fresh. */
function takeSignInNonce(): string | null {
  try {
    const raw = sessionStorage.getItem(SIGNIN_KEY);
    sessionStorage.removeItem(SIGNIN_KEY);
    const p = raw ? (JSON.parse(raw) as { nonce?: string; exp?: number }) : null;
    return p?.nonce && (p.exp ?? 0) > Date.now() ? p.nonce : null;
  } catch {
    return null;
  }
}

export async function signOut() {
  try {
    if (token) await api('/v1/logout', { method: 'POST' });
  } catch {}
  forgetSession();
}

/** Deletes the account and everything stored for it on the server. Local data stays. */
export async function deleteAccount() {
  await api('/v1/me', { method: 'DELETE' });
  forgetSession();
}

export async function setSyncHistory(on: boolean) {
  syncHistory.value = on;
  write(SYNC_HISTORY_KEY, on ? '1' : '0');
  // turning it off removes the cloud copy
  if (!on && token) await api('/v1/data/history', { method: 'DELETE' }).catch(() => {});
}

async function loadAccount() {
  try {
    const me = await (await api('/v1/me')).json();
    account.value = { email: me.email, name: me.name };
    await syncNow();
  } catch (e) {
    if ((e as Error).message !== 'unauthorized') syncState.value = navigator.onLine ? 'error' : 'offline';
  }
}

/**
 * Picks up the result of a sign-in redirect (#lk_token=…&lk_nonce=… / #lk_error=…).
 * A token is only accepted together with the nonce this tab stored before it
 * went to Google. Without that check, anyone could send a link carrying their
 * own token and have the visitor's flows and history sync into their account.
 */
function readRedirect() {
  const m = /[#&]lk_(token|error)=([^&]+)/.exec(location.hash);
  if (!m) return;
  const nonce = /[#&]lk_nonce=([^&]+)/.exec(location.hash)?.[1];
  window.history.replaceState(null, '', location.pathname + location.search);
  const expected = takeSignInNonce();
  if (m[1] === 'token') {
    if (!expected || nonce !== expected || !/^[A-Za-z0-9_-]{20,100}$/.test(m[2])) {
      setTimeout(() => toast(t('cloud.err.failed'), 'error'), 400);
      return;
    }
    token = m[2];
    write(TOKEN_KEY, token);
    setTimeout(() => toast(t('cloud.signedIn')), 400);
  } else {
    if (!expected) return; // an error nobody here asked for
    const code = decodeURIComponent(m[2]);
    const known = ['not_configured', 'cancelled', 'failed'].includes(code) ? code : 'failed';
    setTimeout(() => toast(t(`cloud.err.${known}`), 'error'), 400);
  }
}

export function initCloud() {
  readRedirect();
  if (token) loadAccount();

  // local edits → push soon
  let first = true;
  effect(() => {
    // touch everything that is synced
    void recipes.value, recipeTombstones.value, history.value, historyTombstones.value;
    void lang.value, themePref.value, historyEnabled.value, syncHistory.value;
    if (first) {
      first = false;
      return;
    }
    if (applying) return;
    scheduleSync();
  });
  // settings get their own timestamp so the newest device wins
  let firstSettings = true;
  effect(() => {
    void lang.value, themePref.value, historyEnabled.value, syncHistory.value;
    if (firstSettings) {
      firstSettings = false;
      return;
    }
    if (applying) return;
    settingsAt = Date.now();
    write(SETTINGS_AT_KEY, String(settingsAt));
  });

  addEventListener('online', () => syncNow());
  addEventListener('offline', () => token && (syncState.value = 'offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncNow();
  });
  setInterval(() => document.visibilityState === 'visible' && syncNow(), 5 * 60_000);
}
