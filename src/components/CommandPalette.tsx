import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  Bookmark,
  CornerDownLeft,
  Eraser,
  FilePlus,
  History,
  Home,
  Languages,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Search,
  Settings,
  Sun,
  Workflow,
} from 'lucide-preact';
import { lang, setLang, t } from '../i18n';
import { TOOLS, TOOL_KEYWORDS } from '../tools';
import { clearAll, goHome, goPage, openRecipe, openTool, recipes, sources } from '../state';
import { isDark, toggleTheme } from '../theme';
import { account, signIn, signOut, syncNow } from '../cloud';
import { pickFiles, startWithFiles } from '../picker';
import { ToolIcon } from './Icons';

/**
 * Spotlight-style command palette (⌘K / Ctrl+K from anywhere): jump to any
 * tool, page or saved flow, or run an action, without touching the mouse.
 */

export const paletteOpen = signal(false);
export const openPalette = () => (paletteOpen.value = true);

const RECENT_KEY = 'localkit:palette-recent';

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

type Group = 'pages' | 'pdf' | 'image' | 'flows' | 'actions';

interface Item {
  id: string;
  group: Group;
  title: string;
  sub?: string;
  icon: ComponentChildren;
  keywords?: string;
  run: () => void;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Score of a query against an item (0 = no match). Every query word must
 * match a word of the item, as a prefix (best), substring, or in-order
 * subsequence (abbreviations like "kmprs").
 */
function score(item: Item, words: string[]): number {
  const split = (x: string) => fold(x).split(/[^a-z0-9]+/).filter(Boolean);
  const title = split(item.title);
  const rest = split(`${item.sub ?? ''} ${item.keywords ?? ''}`);
  const titleText = fold(item.title);
  let total = 0;
  for (const w of words) {
    // matches in the title always outrank matches in the description/keywords
    let best = titleText.startsWith(w) ? 12 : 0;
    for (const tok of title) {
      if (tok === w) best = Math.max(best, 11);
      else if (tok.startsWith(w)) best = Math.max(best, 9);
      else if (tok.includes(w)) best = Math.max(best, 5);
      else if (w.length >= 3 && subsequence(w, tok)) best = Math.max(best, 3);
    }
    for (const tok of rest) {
      if (best >= 6) break;
      if (tok === w) best = Math.max(best, 6);
      else if (tok.startsWith(w)) best = Math.max(best, 5);
      else if (tok.includes(w)) best = Math.max(best, 2);
      else if (w.length >= 3 && subsequence(w, tok)) best = Math.max(best, 1);
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}

function subsequence(needle: string, hay: string) {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) if (hay[j] === needle[i]) i++;
  return i === needle.length && hay[0] === needle[0];
}

function buildItems(): Item[] {
  const items: Item[] = [
    { id: 'page:home', group: 'pages', title: t('nav.tools'), sub: t('palette.homeSub'), icon: <Home size={18} />, keywords: 'home beranda alat tools', run: goHome },
    { id: 'page:flow', group: 'pages', title: t('tool.flow'), sub: t('tool.flow.desc'), icon: <Workflow size={18} />, keywords: `${TOOL_KEYWORDS.flow} flows alur`, run: () => openTool('flow') },
    { id: 'page:history', group: 'pages', title: t('nav.history'), sub: t('palette.historySub'), icon: <History size={18} />, keywords: 'history riwayat recent', run: () => goPage('history') },
    { id: 'page:settings', group: 'pages', title: t('nav.settings'), sub: t('palette.settingsSub'), icon: <Settings size={18} />, keywords: 'settings pengaturan preferences account akun', run: () => goPage('settings') },
  ];
  for (const tool of TOOLS) {
    if (tool.category === 'flow') continue;
    items.push({
      id: `tool:${tool.id}`,
      group: tool.category === 'image' ? 'image' : 'pdf',
      title: t(`tool.${tool.id}`),
      sub: t(`tool.${tool.id}.desc`),
      icon: <ToolIcon id={tool.id} size={18} />,
      keywords: TOOL_KEYWORDS[tool.id],
      run: () => openTool(tool.id),
    });
  }
  for (const r of recipes.value) {
    items.push({
      id: `flow:${r.id}`,
      group: 'flows',
      title: r.name,
      sub: t('flow.steps', { n: r.nodes.length }),
      icon: <Bookmark size={18} />,
      keywords: 'flow alur saved tersimpan recipe',
      run: () => openRecipe(r),
    });
  }
  const dark = isDark();
  items.push(
    {
      id: 'act:files',
      group: 'actions',
      title: t('palette.addFiles'),
      sub: t('drop.sub'),
      icon: <FilePlus size={18} />,
      keywords: 'add files upload tambah file buka open choose pilih',
      run: () => pickFiles('any', startWithFiles),
    },
    {
      id: 'act:theme',
      group: 'actions',
      title: dark ? t('palette.light') : t('palette.dark'),
      icon: dark ? <Sun size={18} /> : <Moon size={18} />,
      keywords: 'theme tema dark gelap light terang mode',
      run: toggleTheme,
    },
    {
      id: 'act:lang',
      group: 'actions',
      title: lang.value === 'id' ? 'Switch to English' : 'Ganti ke Bahasa Indonesia',
      icon: <Languages size={18} />,
      keywords: 'language bahasa english indonesia',
      run: () => setLang(lang.value === 'id' ? 'en' : 'id'),
    },
  );
  if (sources.value.length) {
    items.push({
      id: 'act:clear',
      group: 'actions',
      title: t('palette.clearFiles'),
      sub: t('home.loaded', { n: sources.value.length }),
      icon: <Eraser size={18} />,
      keywords: 'clear kosongkan reset hapus files berkas',
      run: clearAll,
    });
  }
  if (account.value) {
    items.push(
      { id: 'act:sync', group: 'actions', title: t('cloud.syncNow'), sub: account.value.email, icon: <RefreshCw size={18} />, keywords: 'sync sinkron cloud', run: () => syncNow() },
      { id: 'act:signout', group: 'actions', title: t('cloud.signOut'), sub: account.value.email, icon: <LogOut size={18} />, keywords: 'sign out logout keluar', run: () => signOut() },
    );
  } else {
    items.push({ id: 'act:signin', group: 'actions', title: t('cloud.signInGoogle'), sub: t('cloud.pitch'), icon: <LogIn size={18} />, keywords: 'sign in login masuk google cloud sync', run: signIn });
  }
  return items;
}

const ORDER: Group[] = ['pages', 'pdf', 'image', 'flows', 'actions'];

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const close = () => (paletteOpen.value = false);

  const all = useMemo(buildItems, [lang.value, recipes.value, account.value, sources.value.length]);
  const words = fold(query).split(/\s+/).filter(Boolean);

  // results: either ranked matches, or "recent" followed by every group
  const sections = useMemo(() => {
    if (words.length) {
      const ranked = all
        .map((it) => ({ it, s: score(it, words) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.it);
      return ranked.length ? [{ key: 'results', items: ranked.slice(0, 30) }] : [];
    }
    const recent = readRecent()
      .map((id) => all.find((it) => it.id === id))
      .filter((x): x is Item => !!x);
    const out: { key: string; items: Item[] }[] = [];
    if (recent.length) out.push({ key: 'recent', items: recent });
    for (const g of ORDER) {
      const items = all.filter((it) => it.group === g && !recent.includes(it));
      if (items.length) out.push({ key: g, items });
    }
    return out;
  }, [all, query]);

  const flat = sections.flatMap((s) => s.items);
  useEffect(() => setActive(0), [query]);
  useLayoutEffect(() => input.current?.focus(), []);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (it: Item | undefined) => {
    if (!it) return;
    remember(it.id);
    close();
    it.run();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault();
      setActive((a) => Math.min(flat.length - 1, a + 1));
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(flat[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else close();
    }
  };

  let i = -1;
  return (
    <div class="overlay cmdk-overlay" onClick={close}>
      <div class="cmdk-box" role="dialog" aria-modal="true" aria-label={t('palette.label')} onClick={(e) => e.stopPropagation()}>
        <label class="cmdk-input">
          <Search size={20} />
          <input
            ref={input}
            value={query}
            placeholder={t('palette.placeholder')}
            spellcheck={false}
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmdk-list"
            aria-activedescendant={flat[active] ? `pal-${flat[active].id}` : undefined}
            onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
            onKeyDown={onKey}
          />
          <kbd>esc</kbd>
        </label>
        <div class="cmdk-list" id="cmdk-list" role="listbox" ref={list}>
          {!flat.length && <p class="cmdk-empty">{t('palette.empty', { q: query })}</p>}
          {sections.map((sec) => (
            <div key={sec.key} role="group" aria-label={t(`palette.${sec.key}`)}>
              <h3>{t(`palette.${sec.key}`)}</h3>
              {sec.items.map((it) => {
                i++;
                const idx = i;
                return (
                  <div
                    key={it.id}
                    id={`pal-${it.id}`}
                    role="option"
                    aria-selected={idx === active}
                    class={`cmdk-row ${idx === active ? 'on' : ''}`}
                    onMouseMove={() => idx !== active && setActive(idx)}
                    onClick={() => run(it)}
                  >
                    <span class="cmdk-row-icon">{it.icon}</span>
                    <span class="cmdk-row-text">
                      <b>{it.title}</b>
                      {it.sub && <small>{it.sub}</small>}
                    </span>
                    {sec.key === 'results' || sec.key === 'recent' ? <span class="cmdk-tag">{t(`palette.${it.group}`)}</span> : null}
                    {idx === active && <CornerDownLeft size={15} class="cmdk-enter" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <footer class="cmdk-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {t('palette.navigate')}
          </span>
          <span>
            <kbd>↵</kbd> {t('palette.open')}
          </span>
          <span>
            <kbd>esc</kbd> {t('palette.close')}
          </span>
        </footer>
      </div>
    </div>
  );
}

/** Global ⌘K / Ctrl+K handler; mount once. */
export function usePaletteShortcut() {
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        paletteOpen.value = !paletteOpen.value;
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);
}
