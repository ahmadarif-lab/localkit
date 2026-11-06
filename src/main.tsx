import './migrate';
import { render } from 'preact';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import { App } from './app';
import { initCloud } from './cloud';

const root = document.getElementById('app')!;
root.textContent = ''; // drop the static, crawlable fallback
render(<App />, root);
initCloud();

// Lift the boot screen once the UI font is in (capped, so a slow font never
// holds the app back); this avoids a flash of fallback text.
const boot = document.getElementById('boot');
if (boot) {
  const lift = () => {
    boot.classList.add('gone');
    setTimeout(() => boot.remove(), 300);
  };
  const font = document.fonts?.load("600 16px 'Plus Jakarta Sans Variable'") ?? Promise.resolve();
  Promise.race([font, new Promise((r) => setTimeout(r, 1200))]).then(lift, lift);
}
