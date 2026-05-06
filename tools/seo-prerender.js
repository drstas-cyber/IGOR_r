/* eslint-disable no-console */
// Post-build step: emit per-route HTML files with correct head metadata so
// crawlers see route-specific <title>/<meta>/<link rel="canonical"> instead of
// the homepage shell on every URL. Also regenerates dist/sitemap.xml from the
// route list. Components remain the source of truth — this script reads each
// page's <Helmet> block and patches the values into a copy of dist/index.html.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(PROJECT_ROOT, 'dist');
const COMPONENTS = path.join(PROJECT_ROOT, 'src', 'components');
const SITE = 'https://temeculavalleyhomes.us';

const ROUTES = [
  { path: '/',                                  component: 'HomePage.jsx',           priority: 1.0, changefreq: 'weekly'  },
  { path: '/homes-for-sale-temecula/',          component: 'BuyerHomesPage.jsx',     priority: 0.9, changefreq: 'weekly'  },
  { path: '/russian-speaking-realtor-temecula/', component: 'RussianRealtorPage.jsx', priority: 0.9, changefreq: 'monthly' },
  { path: '/sell-my-house/',                    component: 'SellMyHousePage.jsx',    priority: 0.8, changefreq: 'monthly' },
  { path: '/contact/',                          component: 'ContactPage.jsx',        priority: 0.7, changefreq: 'yearly'  },
];

function extractHelmet(src) {
  const block = src.match(/<Helmet>([\s\S]*?)<\/Helmet>/);
  if (!block) return null;
  const body = block[1];

  const grab = (re) => {
    const m = body.match(re);
    return m ? m[1].trim() : null;
  };

  return {
    title:              grab(/<title>([\s\S]*?)<\/title>/),
    description:        grab(/<meta\s+name="description"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    canonical:          grab(/<link\s+rel="canonical"[\s\S]*?href="([\s\S]*?)"\s*\/?>/),
    robots:             grab(/<meta\s+name="robots"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    ogTitle:            grab(/<meta\s+property="og:title"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    ogDescription:      grab(/<meta\s+property="og:description"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    ogUrl:              grab(/<meta\s+property="og:url"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    twitterTitle:       grab(/<meta\s+name="twitter:title"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
    twitterDescription: grab(/<meta\s+name="twitter:description"[\s\S]*?content="([\s\S]*?)"\s*\/?>/),
  };
}

function htmlEscapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function htmlEscapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function patchHead(html, seo, routePath) {
  const url = `${SITE}${routePath}`;
  const canonical          = seo.canonical          || url;
  const ogUrl              = seo.ogUrl              || url;
  const title              = seo.title              || '';
  const description        = seo.description        || '';
  const robots             = seo.robots             || null;
  const ogTitle            = seo.ogTitle            || title;
  const ogDescription      = seo.ogDescription      || description;
  const twitterTitle       = seo.twitterTitle       || title;
  const twitterDescription = seo.twitterDescription || description;

  let out = html;

  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/,
      `<title>${htmlEscapeText(title)}</title>`);
  }
  if (description) {
    out = out.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${htmlEscapeAttr(description)}" />`);
  }
  out = out.replace(/<link\s+rel="canonical"\s+href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${htmlEscapeAttr(canonical)}" />`);

  if (robots) {
    out = out.replace(/<meta\s+name="robots"\s+content="[^"]*"\s*\/>/,
      `<meta name="robots" content="${htmlEscapeAttr(robots)}" />`);
  }

  out = out.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:title" content="${htmlEscapeAttr(ogTitle)}" />`);
  out = out.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:description" content="${htmlEscapeAttr(ogDescription)}" />`);
  out = out.replace(/<meta\s+property="og:url"\s+content="[^"]*"\s*\/>/,
    `<meta property="og:url" content="${htmlEscapeAttr(ogUrl)}" />`);
  out = out.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:title" content="${htmlEscapeAttr(twitterTitle)}" />`);
  out = out.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/,
    `<meta name="twitter:description" content="${htmlEscapeAttr(twitterDescription)}" />`);

  return out;
}

function writeRouteHtml(routePath, html) {
  const dir = routePath === '/'
    ? DIST
    : path.join(DIST, routePath.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
}

function buildSitemap(routes) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = routes.map(r => `  <url>
    <loc>${SITE}${r.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('[seo-prerender] dist/ not found — run vite build first.');
    process.exit(1);
  }
  const baseHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

  const indexable = [];
  for (const route of ROUTES) {
    const componentPath = path.join(COMPONENTS, route.component);
    if (!fs.existsSync(componentPath)) {
      console.warn(`[seo-prerender] component not found: ${route.component} — skipping ${route.path}`);
      continue;
    }
    const src = fs.readFileSync(componentPath, 'utf8');
    const seo = extractHelmet(src);
    if (!seo) {
      console.warn(`[seo-prerender] no <Helmet> block in ${route.component} — skipping ${route.path}`);
      continue;
    }
    if (!seo.title || !seo.description) {
      console.warn(`[seo-prerender] missing title or description in ${route.component} (title=${!!seo.title} description=${!!seo.description})`);
    }
    const patched = patchHead(baseHtml, seo, route.path);
    writeRouteHtml(route.path, patched);

    const noindex = !!seo.robots && /noindex/i.test(seo.robots);
    if (!noindex) indexable.push(route);

    const canonical = seo.canonical || `${SITE}${route.path}`;
    console.log(`[seo-prerender] ${route.path}`);
    console.log(`    title:     ${(seo.title || '(missing)').slice(0, 90)}`);
    console.log(`    canonical: ${canonical}`);
    console.log(`    robots:    ${seo.robots || '(inherits index,follow)'}`);
  }

  const sitemap = buildSitemap(indexable);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`[seo-prerender] sitemap.xml written with ${indexable.length} indexable routes (excluded ${ROUTES.length - indexable.length} noindex)`);
}

main();
