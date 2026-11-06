/**
 * English search metadata per route. Used at build time to emit one static
 * HTML file per tool (so every tool has its own indexable URL) and at runtime
 * to keep the document title in sync.
 */
export const SITE_URL = 'https://localkit.ahmadarif.id';
export const SITE_NAME = 'Localkit';

export interface SeoPage {
  slug: string; // '' for home
  title: string;
  description: string;
  h1: string;
  intro: string;
  bullets: string[];
}

export const SEO_PAGES: SeoPage[] = [
  {
    slug: '',
    title: 'Localkit – All-in-One PDF & Image Tools That Never Upload Your Files',
    description:
      'Merge, split, compress, crop, resize, watermark and remove backgrounds from PDFs and images right in your browser. Free, works offline, and files are never uploaded.',
    h1: 'PDFs & images, processed without uploading.',
    intro:
      'Localkit is an all-in-one toolkit for PDFs and images: merge, split, compress, convert, crop, resize, watermark, strip metadata and remove backgrounds. Everything runs locally in your browser, so no file ever leaves your device.',
    bullets: [
      'Combine photos and PDFs, reorder, rotate and delete pages on one board',
      'Compress PDFs while keeping text selectable, or shrink them to the smallest size',
      'Convert JPG, PNG, WebP and HEIC to PDF, or PDF pages to JPG, PNG and WebP',
      'Works offline as an installable app, open source under the MIT license',
    ],
  },
  {
    slug: 'flow',
    title: 'Custom PDF Workflow Builder – Chain PDF Steps Without Uploading | Localkit',
    description:
      'Build your own PDF pipeline: drag steps such as rotate, remove pages, merge, split, compress, convert to images and rename into one flow, then run it in your browser.',
    h1: 'Build your own PDF workflow',
    intro:
      'Start from your files and add only the steps you need. Drag rotate, remove or keep pages, merge, split, compress, convert to images and rename into a pipeline, preview the result, and run it locally.',
    bullets: [
      'Drag and drop steps, reorder them any time',
      'Live preview of every resulting file before you run it',
      'Save flows and reuse them for the next batch',
    ],
  },
  {
    slug: 'images-to-pdf',
    title: 'Images to PDF – Convert JPG, PNG & HEIC to PDF Privately | Localkit',
    description:
      'Turn photos and scans (JPG, PNG, WebP, HEIC) into one PDF in your browser. Choose page size, margins and compression. Free, and nothing is uploaded.',
    h1: 'Convert images to PDF',
    intro:
      'Turn photos, screenshots and scanned documents into one tidy PDF. Reorder and rotate pages, fit them to A4 or Letter, and compress large phone photos.',
    bullets: [
      'Supports JPG, PNG, WebP, GIF, AVIF and iPhone HEIC photos',
      'Fit to image, A4 or Letter with optional margins',
      'Respects photo orientation and compresses large photos',
    ],
  },
  {
    slug: 'merge-pdf',
    title: 'Merge PDF – Combine PDF Files Without Uploading | Localkit',
    description:
      'Combine several PDF files into one and reorder, rotate or remove pages first. Lossless, free and private: merging happens in your browser.',
    h1: 'Merge PDF files',
    intro:
      'Combine several PDFs into a single document. Every page appears on a board where you can drag to reorder, rotate or delete before merging.',
    bullets: ['Lossless merge, text and quality stay intact', 'Reorder pages across files', 'Add images as pages too'],
  },
  {
    slug: 'split-pdf',
    title: 'Split PDF – Extract Pages or Split by Range | Localkit',
    description:
      'Split a PDF into single pages, fixed chunks or custom ranges like 1-3, 5, 8-. Lossless and private: splitting runs in your browser.',
    h1: 'Split a PDF',
    intro:
      'Extract the pages you need or break a document apart. Split every page, every N pages, or by custom ranges, and download the results as a ZIP.',
    bullets: ['Custom ranges such as 1-3, 5, 8-', 'Split every page or every N pages', 'Download all parts as one ZIP'],
  },
  {
    slug: 'pdf-to-images',
    title: 'PDF to JPG, PNG & WebP – Convert PDF Pages to Images | Localkit',
    description:
      'Convert every page of a PDF to JPG, PNG or WebP at 72 to 300 dpi. Free and private: pages are rendered in your browser and never uploaded.',
    h1: 'Convert PDF to images',
    intro:
      'Save each PDF page as a JPG, PNG or WebP image at the resolution you need, then download them one by one or together as a ZIP.',
    bullets: ['JPG, PNG or WebP output', 'Choose 72, 150, 200 or 300 dpi', 'Rotate or skip pages before converting'],
  },
  {
    slug: 'compress-pdf',
    title: 'Compress PDF – Reduce PDF File Size, Keep Text Selectable | Localkit',
    description:
      'Reduce PDF size by recompressing the images inside it while text and vectors stay intact, or rasterise for the smallest file. Runs in your browser.',
    h1: 'Compress PDF files',
    intro:
      'Shrink scanned documents and image-heavy PDFs for email or upload portals. The smart mode only recompresses images, so text stays sharp and selectable.',
    bullets: [
      'Light, medium, strong or custom compression',
      'Smart mode keeps text selectable',
      'Keeps the original when it is already optimal',
    ],
  },
  {
    slug: 'compress-images',
    title: 'Compress Images – Shrink JPG, PNG & WebP Photos | Localkit',
    description:
      'Reduce photo file size with control over quality and resolution. Supports JPG, PNG, WebP and HEIC. Free, private and processed in your browser.',
    h1: 'Compress images',
    intro:
      'Make photos smaller for chat, email or web forms. Pick a preset or set quality and maximum resolution yourself, and convert formats on the way.',
    bullets: ['Quality and resolution control', 'Convert between JPG, PNG and WebP', 'Batch download as ZIP'],
  },
  {
    slug: 'rotate-pdf',
    title: 'Rotate PDF – Rotate Pages Permanently, Free & Private | Localkit',
    description: 'Rotate all or selected pages of one or many PDFs and save them permanently. Lossless, free and processed entirely in your browser.',
    h1: 'Rotate PDF pages',
    intro: 'Rotate every page, only the selected ones, or just portrait or landscape pages. Rotation is lossless and the text stays selectable.',
    bullets: ['Rotate single pages or whole files', 'Select portrait or landscape pages in one click', 'Lossless, nothing is re-rendered'],
  },
  {
    slug: 'watermark-pdf',
    title: 'Watermark PDF – Add Text or Logo Watermarks Without Uploading | Localkit',
    description: 'Stamp a text or logo watermark on every page of your PDF. Choose position, size, opacity, angle or a tiled pattern. Runs in your browser.',
    h1: 'Add a watermark to PDF',
    intro: 'Stamp text such as DRAFT or CONFIDENTIAL, or your logo, on every page. The watermark is added as vector content, so it stays sharp at any zoom.',
    bullets: ['Text or logo (PNG/JPG)', 'Nine positions or a repeating pattern', 'Opacity, size and angle control'],
  },
  {
    slug: 'page-numbers',
    title: 'Add Page Numbers to PDF – Free, Private, No Upload | Localkit',
    description: 'Number the pages of your PDF with the position, format and starting number you choose. Free and processed locally in your browser.',
    h1: 'Add page numbers to PDF',
    intro: 'Add page numbers like 3, 3 / 10 or Page 3 at the top or bottom of every page, starting from any number.',
    bullets: ['Six positions', 'Formats 3, 3 / 10 and Page 3', 'Custom start number and size'],
  },
  {
    slug: 'resize-image',
    title: 'Resize Image – Change Size in Pixels, Percent or Presets | Localkit',
    description: 'Resize JPG, PNG, WebP and HEIC images by pixels, percent or presets such as Instagram, YouTube thumbnails and passport photos. No upload.',
    h1: 'Resize images',
    intro: 'Set an exact width and height, scale by percent, or pick a preset for social media and passport photos. Batch resize many images at once.',
    bullets: ['Pixels, percent or presets', 'Fit, fill & crop or stretch', 'Never enlarge small images (optional)'],
  },
  {
    slug: 'crop-image',
    title: 'Crop Image Online – Fixed Ratios or a Visual Editor, No Upload | Localkit',
    description: 'Crop JPG, PNG and WebP images to 1:1, 4:5, 16:9 and more, or adjust each crop by hand in a visual editor. Free and private.',
    h1: 'Crop images',
    intro: 'Crop a batch of images to the same ratio from the centre, or fine-tune each one with a visual crop editor.',
    bullets: ['Common ratios: 1:1, 4:5, 3:4, 16:9, 9:16', 'Visual editor with handles and pixel readout', 'Apply one crop to every image'],
  },
  {
    slug: 'convert-to-jpg',
    title: 'Convert to JPG – PNG, WebP, HEIC & GIF to JPG Free | Localkit',
    description: 'Convert PNG, WebP, HEIC, GIF, BMP and AVIF images to JPG in bulk with quality control. Files stay on your device.',
    h1: 'Convert images to JPG',
    intro: 'Turn iPhone HEIC photos, PNG screenshots and WebP images into widely compatible JPG files, with optional compression.',
    bullets: ['HEIC, PNG, WebP, GIF, BMP, AVIF', 'Transparent areas become white', 'Quality presets'],
  },
  {
    slug: 'convert-from-jpg',
    title: 'Convert JPG to PNG, WebP or Animated GIF | Localkit',
    description: 'Convert JPG images to PNG, WebP or GIF, or combine several images into one animated GIF. Free and processed in your browser.',
    h1: 'Convert from JPG',
    intro: 'Convert JPG photos to PNG, WebP or GIF, or turn a series of images into an animated GIF with your own frame timing.',
    bullets: ['PNG, WebP or GIF', 'Animated GIF from many images', 'Frame duration control'],
  },
  {
    slug: 'rotate-image',
    title: 'Rotate & Flip Images in Bulk – Free, No Upload | Localkit',
    description: 'Rotate or mirror many JPG, PNG and WebP images at once. Select only portrait or landscape images. Processed locally.',
    h1: 'Rotate and flip images',
    intro: 'Rotate images by 90° steps and flip them horizontally or vertically, one by one or all at once.',
    bullets: ['Rotate left or right', 'Flip horizontally or vertically', 'Select by orientation'],
  },
  {
    slug: 'watermark-image',
    title: 'Watermark Images – Add Text or Logo to Photos Privately | Localkit',
    description: 'Add a text or logo watermark to JPG, PNG and WebP images with position, opacity, angle and tiled patterns. No upload.',
    h1: 'Watermark images',
    intro: 'Protect your photos with a text or logo watermark. Preview the result live and apply it to a whole batch.',
    bullets: ['Text or logo', 'Live preview', 'Tiled pattern option'],
  },
  {
    slug: 'add-border',
    title: 'Add Border to Image – Coloured Frame or Padding | Localkit',
    description: 'Add a coloured border or padding around JPG, PNG and WebP images, in pixels or percent. Free and private.',
    h1: 'Add a border to images',
    intro: 'Give images a clean frame or extra padding in any colour, sized in pixels or as a percentage of the image.',
    bullets: ['Any colour', 'Pixels or percent', 'Batch processing'],
  },
  {
    slug: 'remove-metadata',
    title: 'Remove EXIF & GPS Metadata from Photos – Lossless | Localkit',
    description: 'See and remove EXIF data, camera details and GPS location from JPG, PNG and WebP photos without re-compressing. Runs in your browser.',
    h1: 'Remove photo metadata',
    intro: 'Check which metadata your photos carry, such as camera model, date and GPS location, and remove it without changing a single pixel.',
    bullets: ['Shows GPS location, camera and date', 'Lossless for JPG, PNG and WebP', 'Keeps photo orientation'],
  },
  {
    slug: 'remove-background',
    title: 'Remove Background from Image with AI – Free, On-Device | Localkit',
    description: 'Remove image backgrounds automatically with an AI model that runs in your browser. Export transparent PNG or a new background colour. No upload.',
    h1: 'Remove image backgrounds',
    intro: 'Cut out people, products and animals automatically. The AI model runs on your device, so photos are never uploaded.',
    bullets: ['Transparent PNG or WebP', 'White or custom background colour', 'AI model downloaded once, then works offline'],
  },

  {
    slug: 'privacy',
    title: 'Privacy Policy | Localkit',
    description: 'Localkit processes files in your browser and never uploads them. The optional account stores only your Google ID, email, name, saved flows and settings.',
    h1: 'Privacy Policy',
    intro:
      'Localkit processes PDFs and images entirely in your browser; files are never uploaded. If you sign in with Google (optional) we receive your Google account ID, email and name, and store your saved flows, settings and, only if enabled, history metadata (file names, sizes, times) to sync them between your devices. No analytics, ads, tracking or third-party scripts; data is never sold or shared. Delete everything any time in Settings → Delete cloud account. Use of Google user data follows the Google API Services User Data Policy, including Limited Use.',
    bullets: ['Files never leave your device', 'Optional account: Google ID, email, name, flows, settings', 'No analytics, ads or tracking', 'Delete your account and data at any time'],
  },
  {
    slug: 'terms',
    title: 'Terms of Use | Localkit',
    description: 'Localkit is a free, open-source (MIT) tool provided as is, without warranty. You keep all rights to your files.',
    h1: 'Terms of Use',
    intro: 'Localkit is a free, open-source tool provided "as is", without warranty of any kind. You keep all rights to your files and are responsible for having the right to process them. The optional account is for syncing your own flows and settings.',
    bullets: ['Free and open source (MIT)', 'Provided as is, no warranty', 'You keep the rights to your files'],
  },
];

export const seoFor = (slug: string) => SEO_PAGES.find((p) => p.slug === slug) ?? SEO_PAGES[0];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TOOL_LINKS: [string, string][] = [
  ['images-to-pdf', 'Images to PDF'],
  ['merge-pdf', 'Merge PDF'],
  ['split-pdf', 'Split PDF'],
  ['pdf-to-images', 'PDF to images'],
  ['compress-pdf', 'Compress PDF'],
  ['compress-images', 'Compress images'],
  ['resize-image', 'Resize image'],
  ['crop-image', 'Crop image'],
  ['remove-background', 'Remove background'],
  ['watermark-pdf', 'Watermark PDF'],
  ['remove-metadata', 'Remove metadata'],
  ['flow', 'Custom flow'],
];

const FAQ: [string, string][] = [
  [
    'Are my files uploaded?',
    'No. Localkit is a static web page. Files are read and processed by your own browser and never sent to a server. You can verify it in the DevTools Network tab or by going offline.',
  ],
  ['Is it free?', 'Yes. There is no account, no watermark and no file limit beyond what your device memory allows.'],
  [
    'Does it work offline?',
    'Yes. After the first visit the app is cached, and it can be installed as an app on desktop and mobile.',
  ],
];

/** Static, crawlable content placed inside #app until the app takes over. */
export function staticBody(page: SeoPage) {
  const links = TOOL_LINKS.map(([slug, label]) => `<li><a href="/${slug}">${esc(label)}</a></li>`).join('');
  const bullets = page.bullets.map((b) => `<li>${esc(b)}</li>`).join('');
  const faq = FAQ.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('');
  return `<main class="seo-static"><h1>${esc(page.h1)}</h1><p>${esc(page.intro)}</p><ul>${bullets}</ul><nav aria-label="Tools"><h2>Tools</h2><ul>${links}</ul></nav><section><h2>FAQ</h2>${faq}</section></main>`;
}

export function headTags(page: SeoPage) {
  const url = `${SITE_URL}/${page.slug}`;
  const image = `${SITE_URL}/og.png`;
  const ld = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: page.slug ? page.h1 : SITE_NAME,
      url,
      description: page.description,
      applicationCategory: 'UtilitiesApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript and a modern browser',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      featureList: page.bullets,
      image,
      inLanguage: ['en', 'id'],
      publisher: { '@type': 'Person', name: 'Ahmad Arif', url: 'https://ahmadarif.id' },
    },
    ...(page.slug
      ? []
      : [
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQ.map(([q, a]) => ({
              '@type': 'Question',
              name: q,
              acceptedAnswer: { '@type': 'Answer', text: a },
            })),
          },
        ]),
  ];
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="en_US" />`,
    `<meta property="og:locale:alternate" content="id_ID" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:image" content="${image}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Localkit: merge, split, convert and compress PDFs and images in your browser, nothing uploaded" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
}
