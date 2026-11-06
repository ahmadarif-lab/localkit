import { signal } from '@preact/signals';
import type { Result, RunOutput } from './types';
import type { ToolId } from './tools';

/**
 * A local log of finished jobs. Only metadata (names, sizes, time) is stored,
 * never file contents. Result blobs are kept in memory so they can be
 * downloaded again until the tab is closed.
 */
export interface HistoryEntry {
  id: string;
  at: number;
  tool: ToolId;
  inputs: { count: number; bytes: number };
  outputs: { name: string; size: number; kind: Result['kind'] }[];
}

const KEY = 'localkit:history';
const PREF_KEY = 'localkit:history-enabled';
const MAX = 200;

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const DEL_KEY = 'localkit:history-deleted';

export const historyEnabled = signal<boolean>(read(PREF_KEY, true));
/** id → deletion time, for merging with other devices */
export const historyTombstones = signal<Record<string, number>>(read(DEL_KEY, {}));
export const history = signal<HistoryEntry[]>(historyEnabled.value ? read<HistoryEntry[]>(KEY, []) : []);
/** result files of this session, by entry id */
export const sessionFiles = new Map<string, Result[]>();

export function record(tool: ToolId, out: RunOutput, inputCount: number) {
  const id = Math.random().toString(36).slice(2, 10);
  sessionFiles.set(id, out.results);
  const entry: HistoryEntry = {
    id,
    at: Date.now(),
    tool,
    inputs: { count: inputCount, bytes: out.inputBytes },
    outputs: out.results.map((r) => ({ name: r.name, size: r.blob.size, kind: r.kind })),
  };
  history.value = [entry, ...history.value].slice(0, MAX);
  if (historyEnabled.value) write(KEY, history.value);
}

export function removeEntry(id: string) {
  sessionFiles.delete(id);
  history.value = history.value.filter((e) => e.id !== id);
  historyTombstones.value = { ...historyTombstones.value, [id]: Date.now() };
  write(KEY, historyEnabled.value ? history.value : null);
  write(DEL_KEY, historyTombstones.value);
}

export function clearHistory() {
  const now = Date.now();
  historyTombstones.value = { ...historyTombstones.value, ...Object.fromEntries(history.value.map((e) => [e.id, now])) };
  sessionFiles.clear();
  history.value = [];
  write(KEY, null);
  write(DEL_KEY, historyTombstones.value);
}

/** Replaces the local list with a merged copy from the cloud. */
export function applyHistory(items: HistoryEntry[], deleted: Record<string, number>) {
  history.value = items;
  historyTombstones.value = deleted;
  if (historyEnabled.value) write(KEY, items);
  write(DEL_KEY, deleted);
}

export function setHistoryEnabled(on: boolean) {
  historyEnabled.value = on;
  write(PREF_KEY, on);
  // turning it off forgets what was stored; the in-memory list stays for this session
  write(KEY, on ? history.value : null);
}
