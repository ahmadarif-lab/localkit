import { Repeat } from 'lucide-preact';
import { t } from '../i18n';
import { activeTool } from '../state';
import { Board } from './Board';
import { Steps } from './Steps';
import { ToolIcon } from './Icons';
import { FlowBuilder, SavedFlowsButton } from './FlowBuilder';
import { CropEditor } from './CropEditor';
import { cropEditing } from './ImageSteps';
import { openPalette } from './CommandPalette';
import { IS_MAC } from './Header';

export function Workspace() {
  const tool = activeTool.value;
  const flow = tool.id === 'flow';
  return (
    <main class={`work ${flow ? 'wide' : ''}`}>
      <div class="work-head">
        <div class="work-title">
          {!flow && (
            <span class="work-icon">
              <ToolIcon id={tool.id} size={24} />
            </span>
          )}
          <div>
            {!flow && <span class="work-cat">{t(`cat.${tool.category}.title`)}</span>}
            <h1>{t(`tool.${tool.id}`)}</h1>
            <p>{t(`tool.${tool.id}.desc`)}</p>
          </div>
        </div>
        {flow ? (
          <SavedFlowsButton />
        ) : (
          // other tools are one ⌘K away; files stay loaded when switching
          <button class="btn switch-tool" onClick={openPalette}>
            <Repeat size={16} /> {t('work.switch')}
            <kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</kbd>
          </button>
        )}
      </div>
      {flow ? (
        <FlowBuilder />
      ) : (
        <div class="work-body">
          <Board />
          <Steps />
        </div>
      )}
      {cropEditing.value && <CropEditor />}
    </main>
  );
}
