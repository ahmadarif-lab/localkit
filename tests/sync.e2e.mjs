// Two-device sync test against a real API. Needs a session token for a test user:
//   LK_TOKEN=… LK_BASE=http://localhost:4320 node tests/sync.e2e.mjs
import { chromium, devices } from 'playwright-core';

const BASE = process.env.LK_BASE ?? 'http://localhost:4320';
const TOKEN = process.env.LK_TOKEN;
if (!TOKEN) throw new Error('LK_TOKEN missing');

const browser = await chromium.launch({ channel: 'chrome' });
const mk = async (opts) => {
  const ctx = await browser.newContext({ locale: 'en-US', ...opts });
  await ctx.addInitScript((t) => localStorage.getItem('localkit:token') || localStorage.setItem('localkit:token', t), TOKEN);
  return ctx.newPage();
};
const laptop = await mk({ viewport: { width: 1360, height: 900 } });
const phone = await mk({ ...devices['Pixel 7'] });
const synced = (p) => p.waitForFunction(() => document.querySelector('.avatar-btn.state-ok, .account-sync.state-ok'), null, { timeout: 30000 });
const ok = (c, m) => {
  if (!c) throw new Error(m);
  console.log('✔', m);
};

// laptop: build and save a flow
await laptop.goto(`${BASE}/flow`);
await synced(laptop);
await laptop.click('.palette-item[data-type="merge"]');
await laptop.click('.palette-item[data-type="compress"]');
await laptop.click('.output-actions .link-btn');
await laptop.fill('.recipe-form input', 'From laptop');
await laptop.click('.recipe-form .btn.primary');
await laptop.waitForTimeout(2500); // debounce + push
await synced(laptop);

// phone (next day): the flow is there
await phone.goto(`${BASE}/flow`);
await synced(phone);
await phone.click('.saved-btn');
const names = await phone.$$eval('.saved-pop .saved-name', (e) => e.map((x) => x.textContent));
ok(names.includes('From laptop'), `phone sees laptop flow (${names})`);
await phone.click('.saved-pop .saved-item:has-text("From laptop")');
const steps = await phone.$$eval('.fnodes .fnode-title b', (e) => e.map((x) => x.textContent));
ok(steps.join() === 'Merge,Compress', `steps restored on phone (${steps})`);

// phone: change theme, delete the flow
await phone.goto(`${BASE}/settings`);
await phone.click('.s-card button:text-is("Dark")');
await phone.goto(`${BASE}/flow`);
await synced(phone);
await phone.click('.saved-btn');
await phone.click('.saved-pop li:has-text("From laptop") .icon-btn');
await phone.waitForTimeout(2500);
await synced(phone);

// laptop: sees both changes after coming back
await laptop.reload();
await synced(laptop);
await laptop.waitForTimeout(500);
ok((await laptop.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme from phone applied on laptop');
await laptop.click('.saved-btn');
const after = await laptop.$$eval('.saved-pop .saved-name', (e) => e.map((x) => x.textContent));
ok(!after.includes('From laptop'), `deletion on phone reached laptop (${after})`);

const external = [];
laptop.on('request', (r) => !r.url().startsWith(BASE) && !r.url().startsWith('https://localkit-api.ahmadarif.id') && !/^(blob|data):/.test(r.url()) && external.push(r.url()));
await laptop.reload();
await synced(laptop);
ok(!external.length, `only our API is contacted (${external})`);
await browser.close();
