// Renders the PWA icons and the Open Graph image from HTML with system Chrome.
// Usage: node scripts/render-assets.mjs
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const font = readFileSync(`${root}node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2`).toString('base64');
const fontCss = `@font-face{font-family:J;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:200 800}`;

const mark = (s) => `
<svg width="${s}" height="${s}" viewBox="0 0 32 32"><rect width="32" height="32" rx="9" fill="#f26b1d"/>
<path d="M10 7.5h8.2L23 12.3V23a1.5 1.5 0 0 1-1.5 1.5h-11.5A1.5 1.5 0 0 1 8.5 23V9a1.5 1.5 0 0 1 1.5-1.5Z" fill="#fff"/>
<path d="M12 16h7M12 19h5" stroke="#f26b1d" stroke-width="1.6" stroke-linecap="round"/>
<circle cx="22.5" cy="22.5" r="5" fill="#1d1a17" stroke="#f26b1d" stroke-width="1.6"/>
<path d="m20.4 22.6 1.4 1.4 2.8-2.9" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const icon = (size) => `<html><body style="margin:0;background:#f26b1d">
<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#f26b1d">
<div style="transform:scale(${(size * 0.8) / 32});transform-origin:center;width:32px;height:32px">${mark(32).replace('rx="9"', 'rx="0"')}</div></div></body></html>`;

const page = (rot, label, color, x, y, extra = '') => `
<div style="position:absolute;left:${x}px;top:${y}px;width:168px;height:224px;border-radius:14px;background:#fff;
box-shadow:0 18px 40px -16px rgba(40,20,0,.35),0 1px 2px rgba(0,0,0,.08);transform:rotate(${rot}deg);overflow:hidden;${extra}">
<div style="position:absolute;inset:22px 20px auto;display:flex;flex-direction:column;gap:9px">
<div style="height:11px;width:70%;border-radius:6px;background:#1d1a17;opacity:.8"></div>
${[92, 100, 84, 96, 60].map((w) => `<div style="height:7px;width:${w}%;border-radius:4px;background:#d9d3c6"></div>`).join('')}
<div style="height:58px;border-radius:8px;margin-top:6px;background:linear-gradient(135deg,${color}33,${color}88)"></div></div>
<div style="position:absolute;left:0;right:0;bottom:0;height:5px;background:${color}"></div>
<div style="position:absolute;left:12px;bottom:14px;font:800 13px J;color:#6d6a63">${label}</div></div>`;

const chip = (n, t, on) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 16px 8px 8px;border-radius:14px;background:#fff;border:1px solid #e4dfd3">
<span style="width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:800 14px J;background:${on ? '#f26b1d' : '#e9e5db'};color:${on ? '#fff' : '#6d6a63'}">${n}</span>
<span style="font:700 17px J;color:#1d1a17">${t}</span></div>`;

const og = `<html><head><style>${fontCss}*{box-sizing:border-box}</style></head>
<body style="margin:0;width:1200px;height:630px;background:#fbf8f5;font-family:J;position:relative;overflow:hidden">
<div style="position:absolute;inset:0;background:radial-gradient(70% 90% at 85% 40%,#fff0e5,transparent 70%)"></div>
<div style="position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px">${mark(56)}
<span style="font:800 32px J;letter-spacing:-.02em;color:#1d1a17">Localkit</span></div>
<div style="position:absolute;left:72px;top:168px;width:600px">
<div style="font:800 60px/1.04 J;letter-spacing:-.04em;color:#1d1a17">Merge, split, compress &amp; convert PDFs <span style="color:#f26b1d">in your browser.</span></div>
<div style="margin-top:26px;font:600 23px/1.45 J;color:#6d6a63">Nothing is uploaded. Free, works offline, open source.</div></div>
<div style="position:absolute;left:72px;bottom:64px;display:flex;align-items:center;gap:10px">
${chip(1, 'Files', true)}<span style="color:#c9c1b0;font:800 20px J">›</span>${chip(2, 'Arrange', true)}<span style="color:#c9c1b0;font:800 20px J">›</span>${chip(3, 'Compress', true)}<span style="color:#c9c1b0;font:800 20px J">›</span>${chip(4, 'Output', false)}</div>
${page(-9, '1', '#2f7de1', 770, 118)}${page(4, '2', '#16a37f', 900, 96)}${page(-2, '3', '#f26b1d', 835, 250, '')}
<div style="position:absolute;right:66px;top:72px;display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:#dcf3ea;color:#11845f;font:800 17px J;border:1px solid #a7e0c9">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>No uploads</div>
</body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
for (const size of [192, 512]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(icon(size));
  await p.screenshot({ path: `${root}public/icon-${size}.png`, clip: { x: 0, y: 0, width: size, height: size } });
}
await p.setViewportSize({ width: 1200, height: 630 });
await p.setContent(og);
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: `${root}public/og.png` });
await browser.close();
console.log('rendered icons + og.png');
