// End-to-end test against the production build (`npm run build` first).
// Starts `vite preview`, drives system Chrome, checks every produced file with
// tests/inspect_output.py and asserts that no request leaves the origin.
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const FIX = join(root, 'tests/fixtures');
const PORT = 4319;
// E2E_BASE=https://localkit.ahmadarif.id npm test  → run against a deployed site
const BASE = process.env.E2E_BASE ?? `http://localhost:${PORT}`;
const out = mkdtempSync(join(tmpdir(), 'localkit-e2e-'));
const only = process.argv[2];

if (!existsSync(join(FIX, 'report-3p.pdf'))) execFileSync('python3', [join(root, 'tests/make_fixtures.py')], { stdio: 'inherit' });

const server = process.env.E2E_BASE ? null : spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'pipe' });
if (server) await new Promise((resolve, reject) => {
  server.stdout.on('data', (d) => String(d).includes(String(PORT)) && resolve());
  server.on('exit', (c) => reject(new Error(`preview exited ${c}`)));
  setTimeout(() => reject(new Error('preview timeout')), 20000);
});

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ acceptDownloads: true, locale: 'en-US', viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();

const external = [];
const errors = [];
page.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(BASE) && !u.startsWith('blob:') && !u.startsWith('data:')) external.push(u);
});
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

const inspect = (file) => JSON.parse(execFileSync('python3', [join(root, 'tests/inspect_output.py'), file]).toString());
const fx = (...names) => names.map((n) => join(FIX, n));
let failures = 0;
const results = [];

function check(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function open(slug) {
  await page.goto(`${BASE}/${slug}`);
  await page.waitForSelector('.work');
}

async function upload(files, expectPages) {
  const trigger = (await page.$('.board .dropzone')) ?? (await page.$('.toolbar .btn'));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), trigger.click()]);
  await chooser.setFiles(files);
  await page.waitForFunction(
    (n) => document.querySelectorAll('.grid .page').length === n && !document.querySelector('.source.loading'),
    expectPages,
    { timeout: 60000 },
  );
}

async function pick(step, label) {
  await page.click(`#step-${step} button:text-is("${label}")`);
}

async function processAndDownload(name) {
  await page.click('.run .btn.primary, .fnode.output .btn.primary');
  await page.waitForSelector('.dialog.results', { timeout: 180000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.results-foot .btn.primary')]);
  const file = join(out, `${name}-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  const summary = await page.$eval('.results-head p', (el) => el.textContent);
  const warnings = await page.$$eval('.warnings li', (els) => els.map((e) => e.textContent.trim()));
  await page.keyboard.press('Escape');
  return { file, info: inspect(file), summary, warnings };
}

async function test(name, fn) {
  if (only && !name.includes(only)) return;
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push(`✔ ${name} (${((Date.now() - t0) / 1000).toFixed(1)}s)${note ? ` — ${note}` : ''}`);
  } catch (e) {
    failures++;
    results.push(`✘ ${name}: ${e.message}`);
    await page.screenshot({ path: join(out, `fail-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
  console.log(results.at(-1));
}

const kb = (n) => `${Math.round(n / 1024)} KB`;

await test('home renders, tools are crawlable links', async () => {
  await page.goto(BASE);
  await page.waitForSelector('.home .tool');
  const hrefs = await page.$$eval('.tools a.tool', (as) => as.map((a) => a.getAttribute('href')));
  check(hrefs.length === 19 && hrefs.includes('/merge-pdf') && hrefs.includes('/remove-background'), `tool links: ${hrefs}`);
  const title = await page.title();
  check(/Localkit/.test(title), `title ${title}`);
});

await test('images → PDF (jpg, exif-rotated jpg, transparent png, webp, heic)', async () => {
  await open('images-to-pdf');
  await upload(fx('scan-portrait.jpg', 'phone-exif-rotated.jpg', 'logo-transparent.png', 'landscape.webp', 'iphone.heic'), 5);
  const { info, summary } = await processAndDownload('img2pdf');
  check(info.type === 'pdf' && info.pages.length === 5, `pages ${info.pages?.length}`);
  const p2 = info.pages[1];
  check(p2.h > p2.w, `EXIF orientation 6 should give a portrait page, got ${p2.w}x${p2.h}`);
  check(info.pages[3].w > info.pages[3].h, 'webp landscape page');
  return `${kb(info.size)} · ${summary.trim()}`;
});

await test('images → PDF on A4 with margin, compression off', async () => {
  await open('images-to-pdf');
  await upload(fx('scan-portrait.jpg', 'landscape.webp'), 2);
  await pick('pagesize', 'A4');
  await pick('pagesize', 'Large');
  await pick('compress', 'Off');
  const { info } = await processAndDownload('img2pdf-a4');
  check(info.pages[0].w === 595 && info.pages[0].h === 842, `A4 portrait ${info.pages[0].w}x${info.pages[0].h}`);
  check(info.pages[1].w === 842 && info.pages[1].h === 595, 'auto landscape for wide image');
  return kb(info.size);
});

await test('merge PDFs, reverse order, rotate one page', async () => {
  await open('merge-pdf');
  await upload(fx('report-3p.pdf', 'notes-2p.pdf'), 5);
  await page.click('button[aria-label="Reverse order"]');
  await page.hover('.grid .page:nth-child(1)');
  await page.click('.grid .page:nth-child(1) .page-actions button[aria-label="Rotate right"]');
  const { info } = await processAndDownload('merge');
  check(info.pages.length === 5, `pages ${info.pages.length}`);
  check(info.pages[0].text.includes('Notes page 2'), `first page text: ${info.pages[0].text}`);
  check(info.pages[0].rotate === 90, `rotate ${info.pages[0].rotate}`);
  check(info.pages[4].text.includes('Report page 1'), 'last page');
  return `${kb(info.size)} lossless, text kept`;
});

await test('split by ranges → zip', async () => {
  await open('split-pdf');
  await upload(fx('report-3p.pdf'), 3);
  await page.fill('#step-output input[type=text]', '1-2, 9');
  check(await page.isVisible('.field-error'), 'out-of-range error shown');
  check(await page.isDisabled('.run .btn.primary'), 'process disabled on invalid range');
  await page.fill('#step-output input[type=text]', '1-2, 3');
  const { info } = await processAndDownload('split');
  const names = Object.keys(info.entries);
  check(info.type === 'zip' && names.length === 2, `entries ${names}`);
  check(info.entries[names[0]].pages.length === 2 && info.entries[names[1]].pages.length === 1, 'range sizes');
  return names.join(', ');
});

await test('split every page', async () => {
  await open('split-pdf');
  await upload(fx('notes-2p.pdf'), 2);
  await page.click('#step-output button:text-is("Every page")');
  const { info } = await processAndDownload('split-each');
  check(Object.keys(info.entries).length === 2, 'two files');
});

await test('PDF → JPG at 150 dpi', async () => {
  await open('pdf-to-images');
  await upload(fx('notes-2p.pdf'), 2);
  const { info } = await processAndDownload('pdf2img');
  const imgs = Object.values(info.entries);
  check(imgs.length === 2 && imgs.every((i) => i.format === 'JPEG'), 'two jpgs');
  check(Math.abs(imgs[0].w - 1240) <= 2 && Math.abs(imgs[0].h - 1754) <= 2, `150dpi A4 = 1240x1754, got ${imgs[0].w}x${imgs[0].h}`);
});

await test('PDF → PNG at 72 dpi', async () => {
  await open('pdf-to-images');
  await upload(fx('notes-2p.pdf'), 2);
  await page.click('#step-output button:text-is("PNG")');
  await page.click('#step-output button:text-is("72 dpi")');
  const { info } = await processAndDownload('pdf2png');
  const imgs = Object.values(info.entries);
  check(imgs.every((i) => i.format === 'PNG' && i.w === 595), `png ${imgs.map((i) => i.w)}`);
});

await test('compress PDF, smart mode keeps text', async () => {
  await open('compress-pdf');
  await upload(fx('report-3p.pdf'), 3);
  const { info, summary } = await processAndDownload('compress-smart');
  check(info.pages.length === 3, 'pages');
  check(info.size < 18229891 * 0.2, `expected big reduction, got ${kb(info.size)}`);
  check(info.pages.every((p) => p.text.includes('Report page')), 'text still extractable');
  return `${kb(18229891)} → ${kb(info.size)} · ${summary.trim()}`;
});

await test('compress PDF, smallest (raster) mode', async () => {
  await open('compress-pdf');
  await upload(fx('report-3p.pdf'), 3);
  await pick('compress', 'Strong');
  await page.click('#step-compress button:text-is("Smallest")');
  const { info } = await processAndDownload('compress-raster');
  check(info.pages.length === 3 && info.pages[0].w === 595, 'page size kept');
  check(info.pages.every((p) => !p.text), 'raster pages have no text');
  return kb(info.size);
});

await test('compress never returns a bigger PDF', async () => {
  await open('compress-pdf');
  await upload(fx('notes-2p.pdf', 'restricted.pdf'), 4);
  const { info } = await processAndDownload('compress-small');
  for (const [name, e] of Object.entries(info.entries)) {
    const orig = name.startsWith('notes') ? 2500 : null;
    if (orig) check(e.size <= orig, `${name} grew to ${e.size}`);
  }
});

await test('compress images, custom quality', async () => {
  await open('compress-images');
  await upload(fx('scan-portrait.jpg'), 1);
  await pick('compress', 'Custom');
  await page.$eval('#step-compress input[type=range]', (el) => {
    el.value = '50';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const { info } = await processAndDownload('compress-img');
  check(info.format === 'JPEG' && Math.max(info.w, info.h) <= 1600, `dims ${info.w}x${info.h}`);
  check(info.size < 3327753 / 5, `size ${kb(info.size)}`);
  return `${kb(3327753)} → ${kb(info.size)}`;
});

await test('compress images, multiple → zip, webp output', async () => {
  await open('compress-images');
  await upload(fx('scan-portrait.jpg', 'logo-transparent.png'), 2);
  await page.click('#step-output button:text-is("WebP")');
  const { info } = await processAndDownload('compress-webp');
  const imgs = Object.values(info.entries);
  check(imgs.length === 2 && imgs.every((i) => i.format === 'WEBP'), 'webp');
});

await test('password-protected PDF can be unlocked', async () => {
  await open('merge-pdf');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.board .dropzone')]);
  await chooser.setFiles(fx('locked-rahasia.pdf'));
  await page.waitForSelector('.source.locked');
  await page.fill('.unlock input', 'wrong');
  await page.click('.unlock button');
  await page.waitForSelector('.source.locked .unlock input.invalid');
  await page.fill('.unlock input', 'rahasia');
  await page.click('.unlock button');
  await page.waitForFunction(() => document.querySelectorAll('.grid .page').length === 2);
  const { info, warnings } = await processAndDownload('unlocked');
  check(info.pages.length === 2, 'pages');
  check(warnings.length === 1, `expected one warning, got ${warnings}`);
});

await test('owner-restricted PDF merges (raster fallback)', async () => {
  await open('merge-pdf');
  await upload(fx('restricted.pdf', 'notes-2p.pdf'), 4);
  const { info } = await processAndDownload('restricted');
  check(info.pages.length === 4, 'pages');
  check(info.pages[2].text.includes('Notes page 1'), 'normal pdf keeps text');
});

async function flowFiles(files) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('.canvas .dropzone')]);
  await chooser.setFiles(files);
  await page.waitForFunction(
    (n) => document.querySelectorAll('.input-files .source.ready').length === n,
    files.length,
    { timeout: 60000 },
  );
}
async function freshFlow() {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await open('flow');
}
const addStep = (type) => page.click(`.palette-item[data-type="${type}"]`);
const stepInput = (n) => `.fnodes .fnode-wrap:nth-child(${n}) input`;

await test('custom flow starts empty and needs files + a step', async () => {
  await freshFlow();
  check((await page.$$('.fnodes .fnode-wrap')).length === 0, 'no steps by default');
  check(await page.isDisabled('.fnode.output .btn.primary'), 'process disabled when empty');
  await flowFiles(fx('notes-2p.pdf'));
  check(await page.isDisabled('.fnode.output .btn.primary'), 'still disabled without steps');
});

await test('custom flow: remove page 1 → merge → compress', async () => {
  await freshFlow();
  await flowFiles(fx('report-3p.pdf', 'notes-2p.pdf', 'scan-portrait.jpg'));
  await addStep('remove');
  await page.fill(stepInput(1), '1');
  await addStep('merge');
  await addStep('compress');
  const preview = await page.$$eval('.preview-list li', (els) => els.map((e) => e.textContent));
  check(preview.length === 1 && /3 pages/.test(preview[0]), `preview ${preview}`);
  await page.click('.fnode.output .btn.primary');
  await page.waitForSelector('.dialog.results', { timeout: 180000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.results-foot .btn.primary')]);
  const file = join(out, `flow1-${dl.suggestedFilename()}`);
  await dl.saveAs(file);
  await page.keyboard.press('Escape');
  const info = inspect(file);
  check(info.pages.length === 3, `pages ${info.pages.length}`);
  check(info.pages[0].text.includes('Report page 2') && info.pages[2].text.includes('Notes page 2'), 'page order');
  check(info.size < 3_000_000, `compressed size ${kb(info.size)}`);
  return kb(info.size);
});

await test('custom flow: drag step from palette, rotate even pages, rename', async () => {
  await freshFlow();
  await flowFiles(fx('report-3p.pdf', 'notes-2p.pdf'));
  const from = await (await page.$('.palette-item[data-type="rotate"]')).boundingBox();
  const to = await (await page.$('.flow-empty')).boundingBox();
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 15; i++)
    await page.mouse.move(from.x + 40 + ((to.x + to.width / 2 - from.x - 40) * i) / 15, from.y + from.height / 2 + ((to.y + to.height / 2 - from.y - from.height / 2) * i) / 15);
  await page.mouse.up();
  await page.waitForSelector('.fnodes .fnode-wrap');
  await page.fill(stepInput(1), 'even');
  await addStep('rename');
  await page.fill(stepInput(2), '{name}-final');
  const { info } = await processAndDownload('flow2');
  const names = Object.keys(info.entries).sort();
  check(names.join() === 'notes-2p-final.pdf,report-3p-final.pdf', `names ${names}`);
  const rep = info.entries['report-3p-final.pdf'].pages.map((p) => p.rotate);
  check(rep.join() === '0,90,0', `rotations ${rep}`);
});

await test('custom flow: split → images (png) gives one image per page', async () => {
  await freshFlow();
  await flowFiles(fx('notes-2p.pdf', 'logo-transparent.png'));
  await addStep('split');
  await addStep('images');
  await page.click('.fnodes .fnode-wrap:nth-child(2) button:text-is("PNG")');
  const { info } = await processAndDownload('flow3');
  const imgs = Object.values(info.entries);
  check(imgs.length === 3 && imgs.every((i) => i.format === 'PNG'), `images ${imgs.length}`);
});

await test('custom flow: invalid step blocks processing', async () => {
  await freshFlow();
  await flowFiles(fx('notes-2p.pdf'));
  await addStep('keep');
  await page.fill(stepInput(1), 'abc');
  check(await page.isVisible('.fnode.has-error'), 'error shown');
  check(await page.isDisabled('.fnode.output .btn.primary'), 'process disabled');
  await page.fill(stepInput(1), '9');
  check(await page.isVisible('.fnode.has-error'), 'all pages removed is an error');
});

await test('custom flow: draft survives reload, saved flow opens from home', async () => {
  await freshFlow();
  await addStep('merge');
  await addStep('compress');
  await page.reload();
  await page.waitForSelector('.builder');
  check((await page.$$('.fnodes .fnode-wrap')).length === 2, 'draft restored');
  await page.click('.output-actions .link-btn');
  await page.fill('.recipe-form input', 'Merge small');
  await page.click('.recipe-form .btn.primary');
  await page.click('.fnode.output .link-btn.muted');
  check((await page.$$('.fnodes .fnode-wrap')).length === 0, 'cleared');
  await page.goto(BASE);
  await page.click('.mainnav a[href="/flow"]');
  await page.waitForSelector('.builder');
  await page.click('.saved-btn');
  await page.click('.saved-pop .saved-item:has-text("Merge small")');
  const titles = await page.$$eval('.fnodes .fnode-title b', (e) => e.map((x) => x.textContent));
  check(titles.join() === 'Merge,Compress', `titles ${titles}`);
});

await test('custom flow: saved flows load inside the builder, edits can be saved back', async () => {
  await freshFlow();
  await addStep('merge');
  await page.click('.output-actions .link-btn');
  await page.fill('.recipe-form input', 'A');
  await page.click('.recipe-form .btn.primary');
  await page.click('.fnode.output .link-btn.muted');
  await addStep('split');
  await page.click('.output-actions .link-btn');
  await page.fill('.recipe-form input', 'B');
  await page.click('.recipe-form .btn.primary');
  check(!(await page.$('.canvas .saved, .canvas .recipe')), 'no saved flows inside the canvas');
  const pick = async (name) => {
    await page.click('.saved-btn');
    await page.click(`.saved-pop .saved-item:has-text("${name}")`);
  };
  await page.click('.saved-btn');
  const names = await page.$$eval('.saved-pop .saved-name', (e) => e.map((x) => x.textContent));
  await page.keyboard.press('Escape');
  check(names.join() === 'A,B', `saved ${names}`);
  await pick('A');
  let titles = await page.$$eval('.fnodes .fnode-title b', (e) => e.map((x) => x.textContent));
  check(titles.join() === 'Merge', `loaded A: ${titles}`);
  check(page.url().endsWith('/flow'), 'stayed in builder');
  await addStep('compress');
  check(await page.isVisible('.saved-btn .dirty'), 'edited marker');
  await page.click('.save-actions .link-btn:has-text("Save changes")');
  check(!(await page.isVisible('.saved-btn .dirty')), 'marker cleared after save');
  await pick('B');
  await pick('A');
  titles = await page.$$eval('.fnodes .fnode-title b', (e) => e.map((x) => x.textContent));
  check(titles.join() === 'Merge,Compress', `A updated: ${titles}`);
  await page.click('.saved-btn');
  check((await page.$$('.saved-pop li')).length === 2, 'no duplicate created');
  await page.keyboard.press('Escape');
});

await test('single tools have no pipeline or step numbers', async () => {
  await open('split-pdf');
  check(!(await page.$('.pipeline')) && !(await page.$('.step-n')) && !(await page.$('.recipe-form, .link-btn')), 'clean tool page');
});

const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';
const paletteTitles = () => page.$$eval('.cmdk-row b', (e) => e.map((x) => x.textContent));

await test('command palette: open anywhere, fuzzy search, Enter navigates', async () => {
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector('.s-card');
  await page.keyboard.press(`${MOD}+k`);
  await page.waitForSelector('.cmdk-box input:focus');
  await page.keyboard.type('kmprs pdf');
  const first = (await paletteTitles())[0];
  check(first === 'Compress PDF', `first result: ${first}`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.work');
  check(page.url().endsWith('/compress-pdf') && !(await page.$('.cmdk-box')), page.url());
});

await test('command palette: Indonesian words, arrows, actions, Esc, recent', async () => {
  await page.goto(`${BASE}/merge-pdf`);
  await page.waitForSelector('.work');
  await page.keyboard.press(`${MOD}+k`);
  await page.keyboard.type('hapus latar');
  check((await paletteTitles())[0] === 'Remove background', 'Indonesian keywords match');
  await page.fill('.cmdk-box input', 'theme');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'theme action ran');
  await page.keyboard.press(`${MOD}+k`);
  await page.waitForSelector('.cmdk-box');
  const recent = await page.$eval('.cmdk-list h3', (h) => h.textContent);
  check(recent === 'Recent', `first section: ${recent}`);
  await page.keyboard.press('Escape');
  check(!(await page.$('.cmdk-box')), 'Esc closes');
  await page.evaluate(() => localStorage.removeItem('localkit:theme'));
});

await test('switch-tool button opens the palette', async () => {
  await page.goto(`${BASE}/merge-pdf`);
  await page.click('.switch-tool');
  await page.waitForSelector('.cmdk-box input:focus');
  await page.keyboard.type('pas foto');
  check((await paletteTitles())[0] === 'Resize image', 'passport keyword finds resize');
  await page.keyboard.press('Escape');
});

await test('history logs jobs and re-downloads in the same session', async () => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await open('merge-pdf');
  await upload(fx('notes-2p.pdf', 'restricted.pdf'), 4);
  await processAndDownload('hist');
  await page.click('.mainnav a[href="/history"]');
  await page.waitForSelector('.h-entry');
  const txt = await page.$eval('.h-entry', (e) => e.textContent);
  check(/Merge PDF/.test(txt) && /notes-2p\.pdf/.test(txt), txt);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.h-actions .btn')]);
  check(dl.suggestedFilename() === 'notes-2p.pdf', dl.suggestedFilename());
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('localkit:history') ?? '[]'));
  check(stored.length === 1 && !JSON.stringify(stored).includes('blob'), 'only metadata stored');
  await page.reload();
  await page.waitForSelector('.h-entry');
  check(await page.isVisible('.h-actions .btn.ghost'), 'after reload only "run again" is offered');
});

await test('settings: history off, theme, language', async () => {
  await page.goto(`${BASE}/settings`);
  await page.waitForSelector('.s-card');
  await page.click('.switch');
  check((await page.evaluate(() => localStorage.getItem('localkit:history'))) === null, 'stored history removed');
  await page.click('.s-card button:text-is("Dark")');
  check((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'dark theme');
  await page.click('.s-card button:text-is("Indonesia")');
  check((await page.textContent('.page-head h1')) === 'Pengaturan', 'language switched');
  await page.click('.s-card button:text-is("English")');
  await page.click('.s-card button:text-is("System")');
  await page.click('.switch');
});

await test('resize image: passport 3×4 preset', async () => {
  await open('resize-image');
  await upload(fx('scan-portrait.jpg', 'landscape.webp'), 2);
  await page.click('#step-resize button:text-is("Presets")');
  await page.click('#step-resize .presets button:has-text("Passport 3×4 cm")');
  const { info } = await processAndDownload('resize');
  const imgs = Object.values(info.entries);
  check(imgs.every((i) => i.w === 354 && i.h === 472), `sizes ${imgs.map((i) => `${i.w}x${i.h}`)}`);
  check(imgs[1].format === 'WEBP', 'format kept (auto)');
});

await test('resize image: width only keeps the ratio', async () => {
  await open('resize-image');
  await upload(fx('scan-portrait.jpg'), 1);
  await page.fill('#step-resize input[type=number] >> nth=0', '600');
  const { info } = await processAndDownload('resize-w');
  check(info.w === 600 && info.h === 800, `${info.w}x${info.h}`);
});

await test('crop image: 1:1 ratio + manual crop editor', async () => {
  await open('crop-image');
  await upload(fx('scan-portrait.jpg', 'landscape.webp'), 2);
  await page.click('#step-crop .chips button:text-is("1:1")');
  await page.hover('.grid .page:nth-child(2)');
  await page.click('.grid .page:nth-child(2) .page-actions button[aria-label="Adjust crop"]');
  await page.waitForSelector('.crop-dialog .crop-rect');
  await page.click('.crop-dialog .crop-ratios button:text-is("16:9")');
  await page.click('.crop-dialog .crop-foot .btn.primary');
  const { info } = await processAndDownload('crop');
  const [a, b] = Object.values(info.entries);
  check(a.w === a.h && a.w === 2400, `square ${a.w}x${a.h}`);
  check(Math.abs(b.w / b.h - 16 / 9) < 0.01, `16:9 got ${b.w}x${b.h}`);
});

await test('convert to JPG: transparent PNG gets a white background', async () => {
  await open('convert-to-jpg');
  await upload(fx('logo-transparent.png'), 1);
  const { file, info } = await processAndDownload('tojpg');
  check(info.format === 'JPEG', info.format);
  const corner = JSON.parse(execFileSync('python3', ['-c', `from PIL import Image;print(list(Image.open('${file}').getpixel((2,2))))`]).toString());
  check(corner.every((v) => v > 240), `corner ${corner}`);
});

await test('convert from JPG: animated GIF from several images', async () => {
  await open('convert-from-jpg');
  await upload(fx('scan-portrait.jpg', 'landscape.webp', 'parrot.jpg'), 3);
  await page.click('#step-output button:text-is("GIF")');
  await page.click('#step-output .switch');
  const { file, info } = await processAndDownload('gif');
  const frames = execFileSync('python3', ['-c', `from PIL import Image;im=Image.open('${file}');print(getattr(im,'n_frames',1))`]).toString().trim();
  check(info.format === 'GIF' && frames === '3', `gif frames ${frames}`);
});

await test('rotate & flip images', async () => {
  await open('rotate-image');
  await upload(fx('landscape.webp'), 1);
  await page.click('#step-rotate button:has-text("Rotate right")');
  await page.click('#step-rotate button:has-text("Flip horizontally")');
  const { info } = await processAndDownload('rotimg');
  check(info.w === 1200 && info.h === 1600, `${info.w}x${info.h}`);
});

await test('watermark image (text) and border change the pixels / size', async () => {
  await open('watermark-image');
  await upload(fx('landscape.webp'), 1);
  await page.waitForSelector('.ops-preview img');
  const { info } = await processAndDownload('wmimg');
  check(info.w === 1600 && info.h === 1200, 'size unchanged');
  await open('add-border');
  await upload(fx('landscape.webp'), 1);
  const b = await processAndDownload('border');
  check(b.info.w === 1680 && b.info.h === 1280, `border ${b.info.w}x${b.info.h}`);
});

await test('remove metadata shows GPS and strips it losslessly', async () => {
  await open('remove-metadata');
  await upload(fx('gps-photo.jpg'), 1);
  await page.waitForSelector('.meta-tag.danger');
  const txt = await page.textContent('.meta-list');
  check(/FakeCam Z9/.test(txt) && /-6\.1/.test(txt) && /106\.8/.test(txt), txt);
  const { file } = await processAndDownload('meta');
  const out = JSON.parse(execFileSync('python3', ['-c', `
from PIL import Image, ImageChops
import json
a=Image.open('${file}'); b=Image.open('${join(FIX, 'gps-photo.jpg')}')
e=a.getexif()
print(json.dumps({'gps': len(e.get_ifd(0x8825)), 'model': e.get(0x110), 'same': ImageChops.difference(a.convert('RGB'), b.convert('RGB')).getbbox() is None}))`]).toString());
  check(out.gps === 0 && !out.model && out.same, JSON.stringify(out));
});

await test('remove background (AI) gives a transparent PNG', async () => {
  await open('remove-background');
  await upload(fx('parrot.jpg'), 1);
  const { file, info } = await processAndDownload('rbg');
  const pct = execFileSync('python3', ['-c', `from PIL import Image;a=list(Image.open('${file}').getchannel('A').getdata());print(round(sum(v<20 for v in a)/len(a)*100))`]).toString().trim();
  check(info.format === 'PNG' && info.mode === 'RGBA' && Number(pct) > 20, `transparent ${pct}%`);
  return `${pct}% transparent`;
});

await test('watermark PDF + page numbers are vector text', async () => {
  await open('watermark-pdf');
  await upload(fx('notes-2p.pdf'), 2);
  const w = await processAndDownload('wmpdf');
  const wtext = execFileSync('python3', ['-c', `from pypdf import PdfReader;print(sum('DRAFT' in p.extract_text() for p in PdfReader('${w.file}').pages))`]).toString().trim();
  check(wtext === '2', `pages with DRAFT: ${wtext}`);
  await open('page-numbers');
  await upload(fx('report-3p.pdf'), 3);
  const n = await processAndDownload('pn');
  const all = execFileSync('python3', ['-c', `from pypdf import PdfReader;print('|'.join(p.extract_text() for p in PdfReader('${n.file}').pages))`]).toString();
  check(/1 \/ 3/.test(all) && /3 \/ 3/.test(all), all.slice(0, 200));
});

await test('rotate PDF keeps text', async () => {
  await open('rotate-pdf');
  await upload(fx('notes-2p.pdf'), 2);
  await page.click('#step-rotate button:has-text("Rotate right")');
  const { info } = await processAndDownload('rotpdf');
  check(info.pages.every((p) => p.rotate === 90 && p.text.includes('Notes page')), JSON.stringify(info.pages));
});

await test('custom flow: image steps (resize → border → images)', async () => {
  await freshFlow();
  await flowFiles(fx('landscape.webp'));
  await addStep('resize');
  await addStep('border');
  await addStep('images');
  const { info } = await processAndDownload('flowimg');
  check(info.w === 1360 && info.h === 1040, `${info.w}x${info.h}`);
});

await test('select + bulk delete with keyboard', async () => {
  await open('merge-pdf');
  await upload(fx('report-3p.pdf'), 3);
  await page.click('.grid .page:nth-child(2)');
  await page.click('.grid .page:nth-child(3)');
  await page.keyboard.press('Delete');
  await page.waitForFunction(() => document.querySelectorAll('.grid .page').length === 1);
});

await test('drag to reorder', async () => {
  await open('merge-pdf');
  await upload(fx('notes-2p.pdf'), 2);
  const a = await page.$('.grid .page:nth-child(1) .page-paper');
  const b = await page.$('.grid .page:nth-child(2) .page-paper');
  const ba = await a.boundingBox();
  const bb = await b.boundingBox();
  await page.mouse.move(ba.x + ba.width / 2, ba.y + ba.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(ba.x + ba.width / 2 + ((bb.x - ba.x + 30) * i) / 12, bb.y + bb.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const caption = await page.$eval('.grid .page:nth-child(1) .page-caption span', (el) => el.textContent);
  check(caption.endsWith('· 2'), `first card after drag: ${caption}`);
});

await test('works offline after first visit', async () => {
  await page.goto(BASE);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await ctx.setOffline(true);
  try {
    await page.goto(`${BASE}/merge-pdf`);
    await page.waitForSelector('.work');
    await upload(fx('notes-2p.pdf'), 2);
    const { info } = await processAndDownload('offline');
    check(info.pages.length === 2, 'pages');
  } finally {
    await ctx.setOffline(false);
  }
});

await test('mobile layout has no horizontal scroll', async () => {
  const m = await browser.newPage({ viewport: { width: 375, height: 760 }, isMobile: true, hasTouch: true });
  for (const path of ['', 'merge-pdf']) {
    await m.goto(`${BASE}/${path}`);
    await m.waitForSelector('main');
    const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `/${path} overflows by ${overflow}px`);
  }
  await m.close();
});

await test('sign-in token is only accepted with this tab\'s nonce', async () => {
  // separate context: the API is blocked here and does not count as external traffic
  const c = await browser.newContext();
  await c.route(/localkit-api/, (r) => r.abort());
  const p = await c.newPage();
  const tok = 'T'.repeat(43);
  const stored = () => p.evaluate(() => localStorage.getItem('localkit:token'));
  const nonce = 'N'.repeat(32);
  try {
    // a crafted link with someone else's token is ignored
    await p.goto(`${BASE}/#lk_token=${tok}&lk_nonce=${nonce}`);
    await p.waitForTimeout(300);
    check((await stored()) === null, 'token from a crafted link was stored');
    check(!(await p.evaluate(() => location.hash)), 'hash not cleared');
    // the tab that started sign-in accepts its own redirect, once
    await p.evaluate((n) => sessionStorage.setItem('localkit:signin', JSON.stringify({ nonce: n, exp: Date.now() + 60_000 })), nonce);
    await p.goto(`${BASE}/settings#lk_token=${tok}&lk_nonce=${nonce}`);
    await p.waitForTimeout(300);
    check((await stored()) === tok, 'own sign-in redirect was rejected');
    check((await p.evaluate(() => sessionStorage.getItem('localkit:signin'))) === null, 'nonce not consumed');
    await p.evaluate(() => localStorage.removeItem('localkit:token'));
    await p.goto(`${BASE}/#lk_token=${tok}&lk_nonce=${nonce}`);
    await p.waitForTimeout(300);
    check((await stored()) === null, 'replayed redirect was accepted');
  } finally {
    await c.close();
  }
});

await test('no external requests, no console errors', async () => {
  check(!external.length, `external: ${[...new Set(external)].join(', ')}`);
  const real = errors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
  check(!real.length, `errors: ${real.slice(0, 5).join(' | ')}`);
});

await browser.close();
server?.kill();
console.log(`\n${results.length - failures}/${results.length} passed · outputs in ${out}`);
process.exit(failures ? 1 : 0);
