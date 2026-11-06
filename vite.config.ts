import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEO_PAGES, SITE_URL, headTags, staticBody } from './src/seo';

// Same policy as public/_headers. Injected only into the production build,
// because the dev server needs inline scripts and a websocket for HMR.
const CSP = [
  "default-src 'self'",
  // 'unsafe-eval' is needed by the HEIC decoder (emscripten embind). Exfiltration
  // is still impossible: img-src and form-action are same-origin and connect-src only adds our own API.
  "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  // the only other origin: the optional cloud-save API (flows/settings, never files)
  "connect-src 'self' blob: data: https://localkit-api.ahmadarif.id",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');


const cspMeta = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

const fill = (html: string, page = SEO_PAGES[0]) =>
  html.replace('<!--seo-head-->', headTags(page)).replace('<!--seo-body-->', staticBody(page));

/**
 * One static HTML file per tool (served as /merge-pdf etc. by Cloudflare
 * Pages), each with its own title, description, canonical and crawlable copy,
 * plus robots.txt and sitemap.xml.
 */
const seoPages = (): Plugin => ({
  name: 'seo-pages',
  transformIndexHtml: { order: 'post', handler: (html, ctx) => (ctx.server ? fill(html) : html) },
  writeBundle(opts) {
    const dir = opts.dir!;
    const template = readFileSync(join(dir, 'index.html'), 'utf8');
    for (const page of SEO_PAGES) {
      writeFileSync(join(dir, page.slug ? `${page.slug}.html` : 'index.html'), fill(template, page));
    }
    const today = new Date().toISOString().slice(0, 10);
    const urls = SEO_PAGES.map(
      (p) =>
        `  <url><loc>${SITE_URL}/${p.slug}</loc><lastmod>${today}</lastmod><priority>${p.slug ? '0.8' : '1.0'}</priority></url>`,
    ).join('\n');
    writeFileSync(
      join(dir, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    );
    writeFileSync(join(dir, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  },
});

const pdfjsData = (dir: string, glob = '*') => ({
  src: `node_modules/pdfjs-dist/${dir}/${glob}`,
  dest: `pdfjs/${dir}`,
  rename: { stripBase: 3 },
});

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    preact(),
    cspMeta(),
    seoPages(),
    viteStaticCopy({
      targets: [
        pdfjsData('cmaps'),
        pdfjsData('standard_fonts'),
        pdfjsData('iccs', '*.icc'),
        pdfjsData('wasm', '{openjpeg.wasm,jbig2.wasm,qcms_bg.wasm,*_nowasm_fallback.js}'),
      ],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Localkit',
        short_name: 'Localkit',
        description: 'Merge, split, convert and compress PDFs & images entirely in your browser.',
        theme_color: '#f26b1d',
        background_color: '#fbf8f5',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        file_handlers: [
          {
            action: '/',
            accept: {
              'application/pdf': ['.pdf'],
              'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif', '.bmp', '.avif'],
            },
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,wasm,icc}', 'pdfjs/standard_fonts/*'],
        // big, optional downloads are cached when first used instead of at install
        globIgnores: ['pdfjs/cmaps/**', 'models/**', 'assets/ort-*'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/models/') || /\/assets\/ort-[^/]+$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'ai-models', expiration: { maxEntries: 20 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/pdfjs/cmaps/'),
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs-cmaps', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  build: { target: 'es2022', chunkSizeWarningLimit: 2000 },
  // same isolation headers as production (public/_headers) so threads work locally too
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  worker: { format: 'es' },
});
