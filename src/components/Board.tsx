import { useEffect, useRef, useState } from 'preact/hooks';
import Sortable from 'sortablejs';
import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  Copy,
  Crop as CropIcon,
  FlipHorizontal2,
  FlipVertical2,
  Eraser,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Lock,
  Plus,
  RotateCcw,
  RotateCw,
  Trash,
  Upload,
  X,
} from 'lucide-preact';
import { formatBytes, t } from '../i18n';
import {
  activeTool,
  addFiles,
  clearAll,
  deletePages,
  duplicatePages,
  flipPages,
  movePage,
  pages,
  removeSource,
  reversePages,
  rotatePages,
  selection,
  sortByName,
  sourceMap,
  sources,
  toggleSelect,
  unlockSource,
} from '../state';
import { requestThumb, thumbKey, thumbs } from '../thumbs';
import { pickFiles } from '../picker';
import { cropEditing } from './ImageSteps';
import type { PageItem, Source } from '../types';

export function SourceChip({ src }: { src: Source }) {
  const [pwd, setPwd] = useState('');
  return (
    <div class={`source ${src.status}`} style={{ '--src': src.color }}>
      <span class="source-dot" />
      {src.kind === 'pdf' ? <FileText size={15} /> : <ImageIcon size={15} />}
      <span class="source-name" title={src.name}>
        {src.name}
      </span>
      <span class="source-meta">
        {src.status === 'loading' && <LoaderCircle size={14} class="spin" />}
        {src.status === 'ready' && src.kind === 'pdf' && `${t('source.pages', { n: src.pageCount })} · `}
        {src.status !== 'loading' && formatBytes(src.size)}
        {src.status === 'error' && ` · ${t('source.error')}`}
      </span>
      {src.status === 'locked' && (
        <form
          class="unlock"
          onSubmit={(e) => {
            e.preventDefault();
            if (pwd) unlockSource(src.id, pwd);
          }}
        >
          <Lock size={14} />
          <input
            type="password"
            placeholder={src.error ? t('source.wrong') : t('source.password')}
            class={src.error ? 'invalid' : ''}
            value={pwd}
            onInput={(e) => setPwd((e.target as HTMLInputElement).value)}
            aria-label={t('source.password')}
          />
          <button class="btn small">{t('source.unlock')}</button>
        </form>
      )}
      <button class="icon-btn small" onClick={() => removeSource(src.id)} aria-label={t('source.remove')} title={t('source.remove')}>
        <X size={14} />
      </button>
    </div>
  );
}

/** Box is 3:4; work out how much a 90°-rotated thumbnail must shrink to still fit. */
function rotationScale(w: number, h: number, rot: number) {
  if (rot % 180 === 0) return 1;
  const fit = (iw: number, ih: number) => Math.min(3 / iw, 4 / ih);
  return fit(h, w) / fit(w, h);
}

function PageCard({ page, pos, src, tool }: { page: PageItem; pos: number; src: Source; tool: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = thumbKey(page.sourceId, page.index);
  const thumb = thumbs.value[key];
  const selected = selection.value.has(page.id);

  useEffect(() => {
    if (thumb || !ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          requestThumb(src, page.index);
          io.disconnect();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, [key, !!thumb]);

  const label = src.kind === 'pdf' ? t('page.of', { name: src.name, n: page.index + 1 }) : src.name;
  const stop = (fn: () => void) => (e: Event) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      ref={ref}
      class={`page ${selected ? 'selected' : ''}`}
      style={{ '--src': src.color }}
      data-id={page.id}
      onClick={() => toggleSelect(page.id, true)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleSelect(page.id, true);
        }
      }}
    >
      <div class="page-paper">
        {thumb ? (
          <img
            src={thumb.url}
            alt=""
            draggable={false}
            style={{
              transform: `scale(${page.flipH ? -1 : 1}, ${page.flipV ? -1 : 1}) rotate(${page.rotation}deg) scale(${rotationScale(thumb.w, thumb.h, page.rotation)})`,
            }}
          />
        ) : (
          <span class="page-skeleton" />
        )}
        <span class="page-check">
          <Check size={13} strokeWidth={3} />
        </span>
        {page.crop && (
          <span class="page-badge" title={t('crop.title')}>
            <CropIcon size={12} />
          </span>
        )}
        <span class="page-actions">
          {tool === 'crop-img' && (
            <button onClick={stop(() => (cropEditing.value = page.id))} aria-label={t('crop.edit')} title={t('crop.edit')}>
              <CropIcon size={15} />
            </button>
          )}
          {tool === 'rotate-img' && (
            <button onClick={stop(() => flipPages([page.id], 'h'))} aria-label={t('rot.flipH')} title={t('rot.flipH')}>
              <FlipHorizontal2 size={15} />
            </button>
          )}
          <button onClick={stop(() => rotatePages([page.id], -90))} aria-label={t('board.rotateL')} title={t('board.rotateL')}>
            <RotateCcw size={15} />
          </button>
          <button onClick={stop(() => rotatePages([page.id], 90))} aria-label={t('board.rotateR')} title={t('board.rotateR')}>
            <RotateCw size={15} />
          </button>
          <button onClick={stop(() => deletePages([page.id]))} aria-label={t('board.delete')} title={t('board.delete')}>
            <Trash size={15} />
          </button>
        </span>
      </div>
      <div class="page-caption">
        <b>{pos}</b>
        <span title={label}>{src.kind === 'pdf' ? `${src.name} · ${page.index + 1}` : src.name}</span>
      </div>
    </div>
  );
}

export function Board() {
  const grid = useRef<HTMLDivElement>(null);
  const tool = activeTool.value;
  const list = pages.value;
  const map = sourceMap.value;
  const sel = selection.value;

  useEffect(() => {
    if (!grid.current) return;
    const s = Sortable.create(grid.current, {
      animation: 160,
      ghostClass: 'ghost',
      chosenClass: 'chosen',
      dragClass: 'dragging',
      delay: 160,
      delayOnTouchOnly: true,
      filter: '.page-actions button',
      preventOnFilter: false,
      onEnd(e) {
        const { oldIndex, newIndex, item, from } = e;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        // let Preact own the DOM: undo Sortable's move, then update state
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);
        movePage(oldIndex, newIndex);
      },
    });
    return () => s.destroy();
  }, [list.length > 0]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.value.size) {
        e.preventDefault();
        deletePages(selection.value);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && pages.value.length) {
        e.preventDefault();
        selection.value = new Set(pages.value.map((p) => p.id));
      } else if (e.key === 'Escape') {
        selection.value = new Set();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  if (!sources.value.length) {
    return (
      <section class="board">
        <button class="dropzone tall" onClick={() => pickFiles(tool.accept)}>
          <span class="dropzone-icon">
            <Upload size={26} />
          </span>
          <b>{t('drop.title')}</b>
          <small>{t(`board.empty.${tool.accept}`)}</small>
          <span class="btn primary">{t('drop.button')}</span>
        </button>
      </section>
    );
  }

  const all = sel.size > 0 && sel.size === list.length;
  return (
    <section class="board">
      <div class="sources">
        {sources.value.map((s) => (
          <SourceChip key={s.id} src={s} />
        ))}
      </div>

      <div class="toolbar">
        <button class="btn" onClick={() => pickFiles(tool.accept, addFiles)}>
          <Plus size={16} /> {t('board.add')}
        </button>
        <button
          class="btn ghost"
          onClick={() => (selection.value = all ? new Set() : new Set(list.map((p) => p.id)))}
          disabled={!list.length}
        >
          {all ? t('board.clearSel') : t('board.selectAll')}
        </button>
        {sel.size > 0 && (
          <div class="toolbar-group sel">
            <span class="sel-count">{t('board.selected', { n: sel.size })}</span>
            <button class="icon-btn" onClick={() => rotatePages(sel, -90)} title={t('board.rotateL')} aria-label={t('board.rotateL')}>
              <RotateCcw size={17} />
            </button>
            <button class="icon-btn" onClick={() => rotatePages(sel, 90)} title={t('board.rotateR')} aria-label={t('board.rotateR')}>
              <RotateCw size={17} />
            </button>
            {tool.id === 'rotate-img' && (
              <>
                <button class="icon-btn" onClick={() => flipPages(sel, 'h')} title={t('rot.flipH')} aria-label={t('rot.flipH')}>
                  <FlipHorizontal2 size={17} />
                </button>
                <button class="icon-btn" onClick={() => flipPages(sel, 'v')} title={t('rot.flipV')} aria-label={t('rot.flipV')}>
                  <FlipVertical2 size={17} />
                </button>
              </>
            )}
            <button class="icon-btn" onClick={() => duplicatePages(sel)} title={t('board.duplicate')} aria-label={t('board.duplicate')}>
              <Copy size={17} />
            </button>
            <button class="icon-btn danger" onClick={() => deletePages(sel)} title={t('board.delete')} aria-label={t('board.delete')}>
              <Trash size={17} />
            </button>
          </div>
        )}
        <div class="toolbar-group end">
          <button class="icon-btn" onClick={sortByName} title={t('board.sortName')} aria-label={t('board.sortName')}>
            <ArrowDownAZ size={17} />
          </button>
          <button class="icon-btn" onClick={reversePages} title={t('board.reverse')} aria-label={t('board.reverse')}>
            <ArrowUpDown size={17} />
          </button>
          <button class="icon-btn" onClick={clearAll} title={t('board.clear')} aria-label={t('board.clear')}>
            <Eraser size={17} />
          </button>
        </div>
      </div>

      <div class="grid" ref={grid}>
        {list.map((p, i) => {
          const src = map.get(p.sourceId);
          return src ? <PageCard key={p.id} page={p} pos={i + 1} src={src} tool={tool.id} /> : null;
        })}
      </div>
      {list.length > 0 && <p class="board-hint">{t('board.hint')}</p>}
    </section>
  );
}
