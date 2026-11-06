import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Cloud, Database, Info, LogIn, LogOut, Palette, RefreshCw, ShieldCheck } from 'lucide-preact';
import { account, deleteAccount, signIn, signOut, syncHistory, syncNow, syncState, setSyncHistory } from '../cloud';
import { initials, SyncIcon, syncLabel } from './Account';
import { lang, setLang, t } from '../i18n';
import { setTheme, themePref, type ThemePref } from '../theme';
import { clearHistory, history, historyEnabled, setHistoryEnabled } from '../history';
import { clearFlow, recipes, toast } from '../state';
import { Segmented, Switch } from './Controls';
import { privacyOpen, REPO_URL } from './Header';

function Card(props: { icon: ComponentChildren; title: string; children: ComponentChildren }) {
  return (
    <section class="s-card">
      <h2>
        <span class="s-icon">{props.icon}</span>
        {props.title}
      </h2>
      <div class="s-body">{props.children}</div>
    </section>
  );
}

function Row(props: { label: string; desc?: string; children: ComponentChildren }) {
  return (
    <div class="s-row">
      <span class="switch-text">
        <b>{props.label}</b>
        {props.desc && <small>{props.desc}</small>}
      </span>
      <div class="s-control">{props.children}</div>
    </div>
  );
}

/** A destructive button that asks for a second click instead of a modal. */
function ConfirmButton(props: { label: string; confirm: string; onConfirm: () => void; disabled?: boolean; danger?: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      class={`btn small ${props.danger || armed ? 'danger' : ''}`}
      disabled={props.disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        props.onConfirm();
      }}
    >
      {armed ? props.confirm : props.label}
    </button>
  );
}

function wipeLocalData() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('localkit:')) localStorage.removeItem(key);
  } catch {}
  location.reload();
}

function AccountCard() {
  const a = account.value;
  return (
    <Card icon={<Cloud size={18} />} title={t('cloud.title')}>
      {!a ? (
        <div class="s-row">
          <span class="switch-text">
            <b>{t('cloud.pitch')}</b>
            <small>{t('cloud.pitchDesc')}</small>
          </span>
          <div class="s-control">
            <button class="btn primary google-btn" onClick={signIn}>
              <LogIn size={16} /> {t('cloud.signInGoogle')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div class="s-row">
            <span class="account-who">
              <span class="avatar big">{initials(a)}</span>
              <span>
                <b>{a.name || a.email}</b>
                <small>{a.email}</small>
              </span>
            </span>
            <div class="s-control row-actions">
              <span class={`account-sync state-${syncState.value}`}>
                <SyncIcon /> {syncLabel()}
              </span>
              <button class="btn small" onClick={() => syncNow()} disabled={syncState.value === 'syncing'}>
                <RefreshCw size={15} /> {t('cloud.syncNow')}
              </button>
            </div>
          </div>
          <p class="s-text">{t('cloud.what')}</p>
          <Switch label={t('cloud.syncHistory')} desc={t('cloud.syncHistoryDesc')} checked={syncHistory.value} onChange={(on) => setSyncHistory(on).then(() => syncNow())} />
          <Row label={t('cloud.signOut')} desc={t('cloud.signOutDesc')}>
            <button class="btn small" onClick={signOut}>
              <LogOut size={15} /> {t('cloud.signOut')}
            </button>
          </Row>
          <Row label={t('cloud.delete')} desc={t('cloud.deleteDesc')}>
            <ConfirmButton
              label={t('cloud.deleteBtn')}
              confirm={t('settings.sure')}
              danger
              onConfirm={() =>
                deleteAccount()
                  .then(() => toast(t('cloud.deleted')))
                  .catch(() => toast(t('cloud.error'), 'error'))
              }
            />
          </Row>
        </>
      )}
    </Card>
  );
}

export function SettingsPage() {
  return (
    <main class="subpage narrow">
      <div class="page-head">
        <div>
          <h1>{t('settings.title')}</h1>
          <p>{t('settings.desc')}</p>
        </div>
      </div>

      <AccountCard />

      <Card icon={<Palette size={18} />} title={t('settings.appearance')}>
        <Row label={t('settings.language')}>
          <Segmented
            value={lang.value}
            onChange={setLang}
            small
            options={[
              { value: 'id', label: 'Indonesia' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
        <Row label={t('settings.theme')}>
          <Segmented<ThemePref>
            value={themePref.value}
            onChange={setTheme}
            small
            options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`theme.${v}`) }))}
          />
        </Row>
      </Card>

      <Card icon={<Database size={18} />} title={t('settings.data')}>
        <Switch
          label={t('settings.keepHistory')}
          desc={t('settings.keepHistory.desc')}
          checked={historyEnabled.value}
          onChange={setHistoryEnabled}
        />
        <Row label={t('history.title')} desc={t('settings.entries', { n: history.value.length })}>
          <ConfirmButton
            label={t('history.clear')}
            confirm={t('settings.sure')}
            disabled={!history.value.length}
            onConfirm={() => {
              clearHistory();
              toast(t('settings.cleared'));
            }}
          />
        </Row>
        <Row label={t('flow.saved')} desc={t('settings.flows', { n: recipes.value.length })}>
          <ConfirmButton
            label={t('settings.clearFlows')}
            confirm={t('settings.sure')}
            disabled={!recipes.value.length}
            onConfirm={() => {
              recipes.value = [];
              try {
                localStorage.removeItem('localkit:recipes');
              } catch {}
              clearFlow();
              toast(t('settings.cleared'));
            }}
          />
        </Row>
        <Row label={t('settings.wipe')} desc={t('settings.wipe.desc')}>
          <ConfirmButton label={t('settings.wipe.btn')} confirm={t('settings.sure')} danger onConfirm={wipeLocalData} />
        </Row>
      </Card>

      <Card icon={<ShieldCheck size={18} />} title={t('settings.privacy')}>
        <p class="s-text">{t('privacy.body')}</p>
        <button class="link-btn" onClick={() => (privacyOpen.value = true)}>
          {t('privacy.verify')}
        </button>
      </Card>

      <Card icon={<Info size={18} />} title={t('settings.about')}>
        <Row label="Localkit" desc={`${t('settings.version')} ${__APP_VERSION__} · MIT`}>
          <a class="btn small" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </Row>
      </Card>
    </main>
  );
}
