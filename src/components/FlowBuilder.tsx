import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import Sortable from 'sortablejs';
import {
  ArrowDownAZ,
  Bookmark,
  Crop as CropIcon,
  FlipHorizontal2,
  Frame,
  ListOrdered,
  Scaling,
  Stamp,
  WandSparkles,
  BookmarkPlus,
  Save,
  ChevronDown,
  CircleAlert,
  Download,
  Eraser,
  FileCheck,
  FileInput,
  FileMinus,
  FileText,
  GripVertical,
  Image as ImageIcon,
  Images,
  LoaderCircle,
  Merge,
  PencilLine,
  Play,
  Plus,
  Ratio,
  RotateCw,
  Scissors,
  Shrink,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-preact';
import { formatBytes, t } from '../i18n';
import {
  activeRecipe,
  addFiles,
  addNode,
  deleteRecipe,
  loadRecipe,
  recipeDirty,
  recipes,
  clearFlow,
  flowEval,
  flowNodes,
  moveNode,
  moveSource,
  progress,
  processAll,
  removeNode,
  saveRecipe,
  sourceMap,
  sources,
  toast,
  updateNode,
} from '../state';
import { PALETTE, type FlowNode, type NodeResult, type NodeType } from '../flow';
import { pickFiles } from '../picker';
import { requestThumb, thumbKey, thumbs } from '../thumbs';
import { ColorField, Segmented, Slider, Switch, TextField } from './Controls';
import { BorderFields, PageNumberFields, ResizeFields, WatermarkFields } from './ImageSteps';
import { SourceChip } from './Board';
import type { PageItem } from '../types';

const ICONS: Record<NodeType, typeof Merge> = {
  rotate: RotateCw,
  remove: FileMinus,
  keep: FileCheck,
  order: ArrowDownAZ,
  layout: Ratio,
  merge: Merge,
  split: Scissors,
  compress: Shrink,
  images: Images,
  rename: PencilLine,
  flip: FlipHorizontal2,
  pageNumbers: ListOrdered,
  resize: Scaling,
  crop: CropIcon,
  border: Frame,
  watermark: Stamp,
  removeBg: WandSparkles,
};

const NodeIcon = ({ type, size = 17 }: { type: NodeType; size?: number }) => {
  const C = ICONS[type];
  return <C size={size} strokeWidth={1.9} />;
};

// ---------------------------------------------------------------- palette

function Palette() {
  const lists = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const created = [...(lists.current?.querySelectorAll<HTMLElement>('.palette-list') ?? [])].map((el) =>
      Sortable.create(el, {
        group: { name: 'flow', pull: 'clone', put: false },
        sort: false,
        animation: 150,
        delay: 120,
        delayOnTouchOnly: true,
        ghostClass: 'fnode-ghost',
      }),
    );
    return () => created.forEach((s) => s.destroy());
  }, []);

  return (
    <aside class="palette" ref={lists}>
      <h2>{t('flow.palette')}</h2>
      <p class="hint">{t('flow.palette.hint')}</p>
      {PALETTE.map((g) => (
        <div key={g.group} class="palette-group">
          <h3>{t(g.group)}</h3>
          <div class="palette-list">
            {g.types.map((type) => (
              <button key={type} class="palette-item" data-type={type} onClick={() => addNode(type)}>
                <span class="palette-icon">
                  <NodeIcon type={type} />
                </span>
                <span class="palette-text">
                  <b>{t(`node.${type}`)}</b>
                  <small>{t(`node.${type}.desc`)}</small>
                </span>
                <Plus size={15} class="palette-add" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function InsertMenu({ at, onClose }: { at: number; onClose: () => void }) {
  useLayoutEffect(() => {
    const close = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', close);
    return () => removeEventListener('keydown', close);
  }, []);
  return (
    <div class="insert-menu" role="menu">
      {PALETTE.map((g) => (
        <div key={g.group}>
          <small>{t(g.group)}</small>
          <div class="insert-grid">
            {g.types.map((type) => (
              <button
                key={type}
                role="menuitem"
                onClick={() => {
                  addNode(type, at);
                  onClose();
                }}
              >
                <NodeIcon type={type} size={15} />
                {t(`node.${type}`)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Connector({ at }: { at: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div class={`connector ${open ? 'open' : ''}`}>
      <button
        class="connector-plus"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('flow.insert')}
        title={t('flow.insert')}
      >
        {open ? <X size={14} /> : <Plus size={14} />}
      </button>
      {open && <InsertMenu at={at} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- node editors

const pagesField = (value: string, onInput: (v: string) => void, required: boolean, error?: string | null) => (
  <TextField
    label={t('field.pages')}
    value={value}
    placeholder={required ? t('field.pages.hint') : t('field.pages.all')}
    hint={t('field.pages.hint')}
    error={error}
    onInput={onInput}
  />
);

function NodeEditor({ node, issue }: { node: FlowNode; issue?: string | null }) {
  const set = (patch: object) => updateNode(node.id, patch);
  switch (node.type) {
    case 'rotate':
      return (
        <>
          <Segmented
            label={t('field.angle')}
            value={node.p.angle}
            onChange={(angle) => set({ angle })}
            small
            options={([90, 180, 270] as const).map((v) => ({ value: v, label: t(`angle.${v}`) }))}
          />
          {pagesField(node.p.ranges, (ranges) => set({ ranges }), false, issue)}
        </>
      );
    case 'remove':
    case 'keep':
      return pagesField(node.p.ranges, (ranges) => set({ ranges }), true, issue);
    case 'order':
      return (
        <Segmented
          value={node.p.mode}
          onChange={(mode) => set({ mode })}
          small
          options={(['name', 'reverse-pages', 'reverse-files'] as const).map((v) => ({ value: v, label: t(`order.${v}`) }))}
        />
      );
    case 'layout':
      return (
        <>
          <Segmented
            label={t('pagesize.size')}
            value={node.p.pageSize}
            onChange={(pageSize) => set({ pageSize })}
            small
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: t('pagesize.fit') },
            ]}
          />
          {node.p.pageSize !== 'fit' && (
            <Segmented
              label={t('pagesize.orientation')}
              value={node.p.orientation}
              onChange={(orientation) => set({ orientation })}
              small
              options={(['auto', 'portrait', 'landscape'] as const).map((v) => ({ value: v, label: t(`orientation.${v}`) }))}
            />
          )}
          <Segmented
            label={t('pagesize.margin')}
            value={node.p.margin}
            onChange={(margin) => set({ margin })}
            small
            options={(['none', 'small', 'large'] as const).map((v) => ({ value: v, label: t(`margin.${v}`) }))}
          />
        </>
      );
    case 'merge':
      return <p class="hint">{t('merge.note')}</p>;
    case 'split':
      return (
        <>
          <Segmented
            value={node.p.mode}
            onChange={(mode) => set({ mode })}
            small
            options={[
              { value: 'each', label: t('split.each') },
              { value: 'ranges', label: t('split.ranges') },
              { value: 'chunk', label: t('split.chunk') },
            ]}
          />
          {node.p.mode === 'ranges' && (
            <TextField
              label={t('split.rangesLabel')}
              value={node.p.ranges}
              placeholder={t('split.rangesPlaceholder')}
              hint={t('split.rangesHint.flow')}
              error={issue}
              onInput={(ranges) => set({ ranges })}
            />
          )}
          {node.p.mode === 'chunk' && (
            <TextField
              label={t('split.chunkLabel')}
              type="number"
              min={1}
              value={String(node.p.chunk)}
              onInput={(v) => set({ chunk: Math.max(1, parseInt(v, 10) || 1) })}
            />
          )}
        </>
      );
    case 'compress':
      return (
        <>
          <Segmented
            value={node.p.level}
            onChange={(level) => set({ level })}
            small
            options={(['light', 'medium', 'strong', 'custom'] as const).map((v) => ({ value: v, label: t(`compress.${v}`) }))}
          />
          <p class="hint">{t(`compress.hint.${node.p.level}`)}</p>
          {node.p.level === 'custom' && (
            <div class="custom">
              <Slider label={t('compress.quality')} value={node.p.quality} min={20} max={95} format={(v) => `${v}%`} onChange={(quality) => set({ quality })} />
              <Slider
                label={t('compress.maxDim')}
                value={node.p.maxDim}
                min={600}
                max={4000}
                step={100}
                format={(v) => `${v} px`}
                onChange={(maxDim) => set({ maxDim })}
              />
            </div>
          )}
          <Segmented
            label={t('compress.pdfMode')}
            value={node.p.pdfMode}
            onChange={(pdfMode) => set({ pdfMode })}
            small
            options={[
              { value: 'smart', label: t('pdfMode.smart') },
              { value: 'raster', label: t('pdfMode.raster') },
            ]}
          />
        </>
      );
    case 'images':
      return (
        <>
          <Segmented
            label={t('images.format')}
            value={node.p.format}
            onChange={(format) => set({ format })}
            small
            options={[
              { value: 'auto', label: t('format.auto') },
              { value: 'jpeg', label: 'JPG' },
              { value: 'png', label: 'PNG' },
              { value: 'webp', label: 'WebP' },
            ]}
          />
          <Segmented
            label={t('images.dpi')}
            value={node.p.dpi}
            onChange={(dpi) => set({ dpi })}
            small
            options={[72, 150, 200, 300].map((v) => ({ value: v, label: `${v} dpi` }))}
          />
        </>
      );
    case 'flip':
      return (
        <>
          <Switch label={t('rot.flipH')} checked={node.p.h} onChange={(h) => set({ h })} />
          <Switch label={t('rot.flipV')} checked={node.p.v} onChange={(v) => set({ v })} />
        </>
      );
    case 'pageNumbers':
      return <PageNumberFields value={node.p} onChange={(v) => set(v)} />;
    case 'resize':
      return <ResizeFields value={node.p} onChange={(v) => set(v)} />;
    case 'crop':
      return (
        <div class="chips" role="radiogroup">
          {['1:1', '4:5', '3:4', '4:3', '16:9', '9:16', '3:2', '2:3'].map((r) => (
            <button key={r} type="button" role="radio" aria-checked={node.p.ratio === r} class={node.p.ratio === r ? 'on' : ''} onClick={() => set({ ratio: r })}>
              {r}
            </button>
          ))}
        </div>
      );
    case 'border':
      return <BorderFields value={node.p} onChange={(v) => set(v)} />;
    case 'watermark':
      return <WatermarkFields value={node.p} onChange={(v) => set(v)} />;
    case 'removeBg':
      return (
        <>
          <Segmented
            value={node.p.bg}
            onChange={(bg) => set({ bg })}
            small
            options={[
              { value: 'transparent', label: t('rbg.transparent') },
              { value: 'white', label: t('rbg.white') },
              { value: 'color', label: t('rbg.color') },
            ]}
          />
          {node.p.bg === 'color' && <ColorField label={t('rbg.color')} value={node.p.color} onChange={(color) => set({ color })} />}
          <p class="hint">{t('rbg.hint')}</p>
        </>
      );
    case 'rename':
      return (
        <TextField
          label={t('field.pattern')}
          value={node.p.pattern}
          placeholder="{name}"
          hint={t('rename.hint')}
          error={issue}
          onInput={(pattern) => set({ pattern })}
        />
      );
  }
}

function Stats({ r }: { r?: NodeResult | { docs: number; pages: number } }) {
  if (!r) return null;
  return <span class="fnode-stats">{t('flow.stats', { docs: r.docs, pages: r.pages })}</span>;
}

function NodeCard({ node, index, result }: { node: FlowNode; index: number; result?: NodeResult }) {
  const [collapsed, setCollapsed] = useState(false);
  const issue = result?.error ? t(result.error.key, result.error.vars) : null;
  const warn = result?.warn ? t(result.warn.key, result.warn.vars) : null;
  const shownInField =
    ['rotate', 'remove', 'keep', 'rename'].includes(node.type) || (node.type === 'split' && node.p.mode === 'ranges');
  return (
    <div class="fnode-wrap" data-id={node.id}>
      <div class={`fnode ${issue ? 'has-error' : warn ? 'has-warn' : ''}`}>
        <header class="fnode-head">
          <span class="fnode-grip" title={t('flow.drag')} aria-hidden="true">
            <GripVertical size={16} />
          </span>
          <span class="fnode-icon">
            <NodeIcon type={node.type} />
          </span>
          <button class="fnode-title" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed}>
            <b>{t(`node.${node.type}`)}</b>
            <ChevronDown size={15} class={collapsed ? 'rot' : ''} />
          </button>
          <Stats r={result} />
          <button class="icon-btn small" onClick={() => removeNode(node.id)} aria-label={t('flow.remove')} title={t('flow.remove')}>
            <X size={15} />
          </button>
        </header>
        {!collapsed && (
          <div class="fnode-body">
            <NodeEditor node={node} issue={issue} />
          </div>
        )}
        {issue && (collapsed || !shownInField) && (
          <p class="fnode-msg error">
            <CircleAlert size={14} /> {issue}
          </p>
        )}
        {warn && <p class="fnode-msg warn"><TriangleAlert size={14} /> {warn}</p>}
      </div>
      <Connector at={index + 1} />
    </div>
  );
}

// ---------------------------------------------------------------- input & output

function Card(props: { icon: ComponentChildren; title: string; extra?: ComponentChildren; children: ComponentChildren; cls?: string }) {
  return (
    <div class={`fnode fixed ${props.cls ?? ''}`}>
      <header class="fnode-head">
        <span class="fnode-icon solid">{props.icon}</span>
        <b class="fnode-title static">{props.title}</b>
        {props.extra}
      </header>
      <div class="fnode-body">{props.children}</div>
    </div>
  );
}

function InputCard() {
  const list = useRef<HTMLDivElement>(null);
  const ev = flowEval.value;
  const hasFiles = sources.value.length > 0;
  useEffect(() => {
    if (!list.current) return;
    const s = Sortable.create(list.current, {
      animation: 150,
      delay: 120,
      delayOnTouchOnly: true,
      filter: 'button, input',
      preventOnFilter: false,
      onEnd(e) {
        const { oldIndex, newIndex, item, from } = e;
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return;
        from.removeChild(item);
        from.insertBefore(item, from.children[oldIndex] ?? null);
        moveSource(oldIndex, newIndex);
      },
    });
    return () => s.destroy();
  }, [hasFiles]);

  return (
    <Card icon={<FileInput size={17} />} title={t('flow.input')} extra={hasFiles && <Stats r={ev.input} />}>
      {hasFiles ? (
        <>
          <div class="input-files" ref={list}>
            {sources.value.map((s) => (
              <SourceChip key={s.id} src={s} />
            ))}
          </div>
          <div class="input-actions">
            <button class="btn small" onClick={() => pickFiles('any', addFiles)}>
              <Plus size={15} /> {t('board.add')}
            </button>
            <span class="hint">{t('flow.input.hint')}</span>
          </div>
        </>
      ) : (
        <button class="dropzone compact" onClick={() => pickFiles('any', addFiles)}>
          <span class="dropzone-icon">
            <Upload size={20} />
          </span>
          <b>{t('drop.title')}</b>
          <small>{t('flow.input.empty')}</small>
        </button>
      )}
    </Card>
  );
}

function SaveFlow() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const active = recipes.value.find((r) => r.id === activeRecipe.value);
  if (!open) {
    return (
      <span class="save-actions">
        {active && recipeDirty.value && (
          <button
            class="link-btn"
            onClick={() => {
              saveRecipe(active.name);
              toast(t('toast.recipeUpdated', { name: active.name }));
            }}
          >
            <Save size={15} /> {t('recipe.update')}
          </button>
        )}
        <button
          class="link-btn"
          onClick={() => {
            setName(active?.name ?? '');
            setOpen(true);
          }}
          disabled={!flowNodes.value.length}
        >
          <BookmarkPlus size={15} /> {active ? t('recipe.saveAs') : t('recipe.save')}
        </button>
      </span>
    );
  }
  return (
    <form
      class="recipe-form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = name.trim();
        if (!v) return;
        const updated = saveRecipe(v);
        toast(t(updated ? 'toast.recipeUpdated' : 'toast.recipeSaved', { name: v }));
        setOpen(false);
        setName('');
      }}
    >
      <input
        autoFocus
        value={name}
        placeholder={t('recipe.placeholder')}
        aria-label={t('recipe.prompt')}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
      />
      <button class="btn small primary">{t('recipe.ok')}</button>
      <button type="button" class="btn small ghost" onClick={() => setOpen(false)}>
        {t('recipe.cancel')}
      </button>
    </form>
  );
}

function OutputCard() {
  const ev = flowEval.value;
  const p = progress.value;
  const n = ev.groups.length;
  const reason = !sources.value.length
    ? 'flow.need.files'
    : !flowNodes.value.length
      ? 'flow.need.steps'
      : !ev.ok
        ? 'flow.need.fix'
        : null;
  return (
    <Card icon={<Download size={17} />} title={t('flow.output')} cls="output">
      {!reason && <p class="output-summary">{t(ev.images ? 'flow.result.images' : 'flow.result.pdf', { n })}</p>}
      <button class="btn primary big block" disabled={!!reason || !!p} onClick={processAll}>
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
        reason && <p class="run-note">{t(reason)}</p>
      )}
      <div class="output-actions">
        <SaveFlow />
        {flowNodes.value.length > 0 && (
          <button class="link-btn muted" onClick={clearFlow}>
            <Eraser size={15} /> {t('flow.clear')}
          </button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- preview

function MiniThumb({ page }: { page: PageItem }) {
  const src = sourceMap.value.get(page.sourceId);
  const thumb = thumbs.value[thumbKey(page.sourceId, page.index)];
  useEffect(() => {
    if (src && !thumb) requestThumb(src, page.index);
  }, [page.sourceId, page.index, !!thumb]);
  const swap = page.rotation % 180 !== 0;
  return (
    <span class="mini" style={{ '--src': src?.color }}>
      {thumb ? (
        <img
          src={thumb.url}
          alt=""
          style={{ transform: `rotate(${page.rotation}deg)${swap ? ' scale(0.75)' : ''}` }}
        />
      ) : (
        <span class="page-skeleton" />
      )}
    </span>
  );
}

const PREVIEW_LIMIT = 24;
const STRIP_LIMIT = 6;

function Preview() {
  const ev = flowEval.value;
  const groups = ev.groups;
  return (
    <aside class="preview">
      <h2>
        {t('flow.preview')}
        {groups.length > 0 && <span class="step-summary">{t(ev.images ? 'flow.result.images' : 'flow.result.pdf', { n: groups.length })}</span>}
      </h2>
      {!groups.length ? (
        <p class="hint">{t('flow.preview.empty')}</p>
      ) : (
        <ul class="preview-list">
          {groups.slice(0, PREVIEW_LIMIT).map((g, i) => (
            <li key={`${g.name}-${i}`}>
              <div class="preview-name">
                {ev.images ? <ImageIcon size={15} /> : <FileText size={15} />}
                <b title={g.name}>{g.name}</b>
                {!ev.images && <small>{t('sum.pages', { n: g.pages.length })}</small>}
              </div>
              <div class="strip">
                {g.pages.slice(0, STRIP_LIMIT).map((p, k) => (
                  <MiniThumb key={`${p.id}-${k}`} page={p} />
                ))}
                {g.pages.length > STRIP_LIMIT && <span class="mini more">+{g.pages.length - STRIP_LIMIT}</span>}
              </div>
            </li>
          ))}
          {groups.length > PREVIEW_LIMIT && <li class="hint">{t('flow.preview.more', { n: groups.length - PREVIEW_LIMIT })}</li>}
        </ul>
      )}
      {sources.value.length > 0 && (
        <p class="preview-foot hint">
          {t('flow.input')}: {formatBytes(sources.value.reduce((n, s) => n + s.size, 0))}
        </p>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------- saved flows

/** Header button with a popup list of saved flows; keeps the canvas free for building. */
export function SavedFlowsButton() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const active = recipes.value.find((r) => r.id === activeRecipe.value);
  // layout effect: listeners must exist as soon as the popup is visible
  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', onDown);
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('pointerdown', onDown);
      removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div class="saved" ref={root}>
      <button class="btn saved-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <Bookmark size={16} />
        <span class="saved-btn-label">{active ? active.name : t('flow.saved')}</span>
        {active && recipeDirty.value && <small class="dirty">{t('flow.modified')}</small>}
        {!active && recipes.value.length > 0 && <span class="count">{recipes.value.length}</span>}
        <ChevronDown size={15} class={open ? 'flip' : ''} />
      </button>
      {open && (
        <div class="saved-pop" role="menu">
          <h3>{t('flow.saved')}</h3>
          {recipes.value.length ? (
            <ul>
              {recipes.value.map((r) => {
                const on = r.id === activeRecipe.value;
                return (
                  <li key={r.id} class={on ? 'on' : ''}>
                    <button
                      class="saved-item"
                      role="menuitem"
                      onClick={() => {
                        loadRecipe(r);
                        setOpen(false);
                        toast(t('flow.loaded', { name: r.name }));
                      }}
                    >
                      <span class="saved-name">{r.name}</span>
                      <small>{t('flow.steps', { n: r.nodes.length })}</small>
                      {on && recipeDirty.value && <small class="dirty">{t('flow.modified')}</small>}
                    </button>
                    <button class="icon-btn small" onClick={() => deleteRecipe(r.id)} aria-label={t('recipe.delete')} title={t('recipe.delete')}>
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p class="hint">{t('flow.saved.empty')}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- builder

export function FlowBuilder() {
  const list = useRef<HTMLDivElement>(null);
  const nodes = flowNodes.value;
  const ev = flowEval.value;

  useEffect(() => {
    if (!list.current) return;
    const s = Sortable.create(list.current, {
      group: { name: 'flow', pull: false, put: true },
      handle: '.fnode-grip',
      draggable: '.fnode-wrap',
      animation: 160,
      ghostClass: 'fnode-ghost',
      onAdd(e) {
        // a palette item was dropped: put the DOM back and add a real node
        const type = (e.item as HTMLElement).dataset.type as NodeType;
        const at = e.newDraggableIndex ?? e.newIndex ?? nodes.length;
        e.clone?.parentNode?.replaceChild(e.item, e.clone);
        if (type) addNode(type, at);
      },
      onEnd(e) {
        if (e.from !== e.to) return;
        const { oldDraggableIndex: a, newDraggableIndex: b, item, from } = e;
        if (a == null || b == null || a === b) return;
        from.removeChild(item);
        const ref = from.querySelectorAll('.fnode-wrap')[a] ?? from.querySelector('.flow-empty') ?? null;
        from.insertBefore(item, ref);
        moveNode(a, b);
      },
    });
    return () => s.destroy();
  }, []);

  return (
    <div class="builder">
      <Palette />
      <section class="canvas" aria-label={t('tool.flow')}>
        <InputCard />
        <Connector at={0} />
        <div class={`fnodes ${nodes.length ? '' : 'empty'}`} ref={list}>
          {nodes.map((n, i) => (
            <NodeCard key={n.id} node={n} index={i} result={ev.nodes[i]} />
          ))}
          {!nodes.length && (
            <div class="flow-empty">
              <Plus size={18} />
              <span>{t('flow.empty')}</span>
            </div>
          )}
        </div>
        {!nodes.length && <div class="connector line" aria-hidden="true" />}
        <OutputCard />
      </section>
      <Preview />
    </div>
  );
}
