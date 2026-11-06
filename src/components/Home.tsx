import {
  ArrowRight,
  Check,
  Code,
  Cpu,
  FileText,
  FolderOpen,
  Layers,
  ShieldHalf,
  SlidersHorizontal,
  Upload,
  WifiOff,
  Zap,
} from 'lucide-preact';
import { t } from '../i18n';
import { TOOLS, toolsIn, type Tool, type ToolId } from '../tools';
import { openTool, sources } from '../state';
import { pickFiles, startWithFiles } from '../picker';
import { REPO_URL } from './Header';
import { dropHint } from '../platform';
import { ToolIcon } from './Icons';
import { SourceChip } from './Board';
import { HeroArt } from './HeroArt';



const nav = (id: ToolId) => (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  openTool(id);
};

function MiniFlow() {
  return (
    <span class="mini-flow" aria-hidden="true">
      <span>
        <FileText size={20} />
      </span>
      <ArrowRight size={16} />
      <span>
        <SlidersHorizontal size={20} />
      </span>
      <ArrowRight size={16} />
      <span>
        <Check size={20} />
      </span>
    </span>
  );
}

function ToolCard({ tool }: { tool: Tool }) {
  return (
    <a class="tool" href={`/${tool.slug}`} onClick={nav(tool.id)}>
      <span class="tool-icon">
        <ToolIcon id={tool.id} size={26} />
      </span>
      <span class="tool-text">
        <b>{t(`tool.${tool.id}`)}</b>
        <small>{t(`tool.${tool.id}.desc`)}</small>
      </span>
    </a>
  );
}

export function Home() {
  const flow = TOOLS[0];

  return (
    <main class="home">
      <section class="hero">
        <div class="hero-text">
          <p class="eyebrow">{t('hero.eyebrow')}</p>
          <h1>
            {t('hero.title1')} <em>{t('hero.title2')}</em>
          </h1>
          <p class="hero-sub">{t('hero.sub')}</p>
          <ul class="hero-badges">
            <li>
              <Zap size={17} /> {t('badge.browser')}
            </li>
            <li>
              <ShieldHalf size={17} /> {t('badge.privacy')}
            </li>
            <li>
              <Code size={17} /> {t('badge.open')}
            </li>
          </ul>
        </div>
        <HeroArt />
      </section>

      <button class="dropzone hero-drop" onClick={() => pickFiles('any', startWithFiles)}>
        <span class="dropzone-icon">
          <Upload size={24} />
        </span>
        <b>{t('drop.title')}</b>
        <small>{dropHint()}</small>
        <span class="btn primary">
          <FolderOpen size={17} /> {t('drop.button')}
        </span>
      </button>

      {sources.value.length > 0 && (
        <div class="loaded">
          <div class="loaded-files">
            {sources.value.map((s) => (
              <SourceChip key={s.id} src={s} />
            ))}
          </div>
          <p>
            <b>{t('home.loaded', { n: sources.value.length })}</b> {t('home.pickTool')}
          </p>
        </div>
      )}

      <section class="section" id="tools">
        <div class="section-head">
          <h2>
            <Layers size={24} />
            {sources.value.length ? t('home.toolsFor') : t('home.tools')}
          </h2>
        </div>

        {(
          <div class="tools featured-row">
            <a class="tool featured" href={`/${flow.slug}`} onClick={nav(flow.id)}>
              <span class="tool-icon">
                <ToolIcon id={flow.id} size={28} />
              </span>
              <span class="tool-text">
                <b>
                  {t(`tool.${flow.id}`)} <span class="tool-badge">{t('tool.recommended')}</span>
                </b>
                <small>{t(`tool.${flow.id}.desc`)}</small>
              </span>
              <MiniFlow />
            </a>
          </div>
        )}
        {(['pdf', 'image'] as const).map((c) => {
          const list = toolsIn(c);
          return (
            <div key={c} class="tool-group">
              <h3 class="group-title">
                {t(`cat.${c}.title`)} <span>{list.length}</span>
              </h3>
              <div class="tools">
                {list.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section class="trust">
        <div>
          <Cpu size={30} strokeWidth={1.7} />
          <span>
            <b>{t('trust.local')}</b>
            <small>{t('trust.local.sub')}</small>
          </span>
        </div>
        <div>
          <WifiOff size={30} strokeWidth={1.7} />
          <span>
            <b>{t('trust.offline')}</b>
            <small>{t('trust.offline.sub')}</small>
          </span>
        </div>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <Code size={30} strokeWidth={1.7} />
          <span>
            <b>{t('trust.open')}</b>
            <small>{t('trust.open.sub')}</small>
          </span>
        </a>
      </section>
    </main>
  );
}
