/* eslint-disable no-console */
// Post-build step: emit per-route HTML files with correct head metadata so
// crawlers see route-specific <title>/<meta>/<link rel="canonical"> instead of
// the homepage shell on every URL. Also regenerates dist/sitemap.xml from the
// route list. Components remain the source of truth — this script reads each
// page's <Helmet> block and patches the values into a copy of dist/index.html.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJsonLdScript } from '../src/lib/blog.js';
import { buildHomepageFaqJsonLd } from '../src/data/homepage-faq.js';
import { TESTIMONIALS } from '../src/data/testimonials.js';
import { GOOGLE_REVIEWS_URL } from '../src/lib/reviews.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DIST = path.join(PROJECT_ROOT, 'dist');
const COMPONENTS = path.join(PROJECT_ROOT, 'src', 'components');
const BLOG_DATA_PATH = path.join(PROJECT_ROOT, 'src', 'data', 'blog-articles.json');
const SITE = 'https://temeculavalleyhomes.us';

// `head` (optional): raw markup injected before </head> for THIS route only.
// Used to preload the homepage LCP hero (the <img> is React-rendered, so a
// static-HTML preload is the only way to start its download during initial
// parse). Scoped to '/' so subpages don't preload an unused image.
const HERO_PRELOAD =
  '<link rel="preload" as="image" type="image/avif" ' +
  'imagesrcset="/assets/hero/hero-400.avif 400w, /assets/hero/hero-800.avif 800w, /assets/hero/hero-1200.avif 1200w, /assets/hero/hero-1600.avif 1600w" ' +
  'imagesizes="100vw" fetchpriority="high" />';

const ROUTES = [
  { path: '/',                                  component: 'HomePage.jsx',           priority: 1.0, changefreq: 'weekly',  head: HERO_PRELOAD },
  { path: '/homes-for-sale-temecula/',          component: 'BuyerHomesPage.jsx',     priority: 0.9, changefreq: 'weekly'  },
  { path: '/russian-speaking-realtor-temecula/', component: 'RussianRealtorPage.jsx', priority: 0.9, changefreq: 'monthly' },
  { path: '/sell-my-house/',                    component: 'SellMyHousePage.jsx',    priority: 0.8, changefreq: 'monthly' },
  { path: '/about-george/',                     component: 'AboutGeorgePage.jsx',    priority: 0.7, changefreq: 'monthly' },
  { path: '/contact/',                          component: 'ContactPage.jsx',        priority: 0.7, changefreq: 'yearly'  },
  // /blog/ and /blog/<slug>/ are NOT listed here — they're generated
  // dynamically from src/data/blog-articles.json by prerenderBlog() below,
  // one entry per article, not a static component like the routes above.
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
    htmlLang:           grab(/<html\s+lang="([^"]*)"\s*\/?>/),
  };
}

function htmlEscapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function htmlEscapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Homepage-only, plain-HTML crawler fallback for the testimonials section
// (see the '/' route branch in main() for why this exists and why it's
// wrapped in <noscript>). No schema involved -- see src/data/testimonials.js
// for why that's intentional -- so this is the only mechanism that makes the
// real review text reachable to a crawler that doesn't execute JS.
function buildTestimonialsNoscriptHtml(testimonials, reviewsUrl) {
  const cards = testimonials.map((r) => {
    const stars = '★'.repeat(r.rating || 5);
    return `<div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #ddd;">
          <p>${stars}</p>
          <p>&quot;${htmlEscapeText(r.text)}&quot;</p>
          <p><strong>${htmlEscapeText(r.reviewerName)}</strong> — ${htmlEscapeText(r.displayDate)} · <a href="${htmlEscapeAttr(r.sourceUrl)}">on Google</a></p>
        </div>`;
  }).join('\n');

  return `<noscript>
      <div style="max-width:800px;margin:0 auto;padding:40px 20px;font-family:sans-serif;">
        <h2>What clients say</h2>
        ${cards}
        <p><a href="${htmlEscapeAttr(reviewsUrl)}">Read all reviews on Google</a></p>
      </div>
    </noscript>`;
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

  if (seo.htmlLang) {
    out = out.replace(/<html lang="[^"]*">/, `<html lang="${htmlEscapeAttr(seo.htmlLang)}">`);
  }

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

  if (seo.ogImage) {
    out = out.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image" content="${htmlEscapeAttr(seo.ogImage)}" />`);
    out = out.replace(/<meta\s+property="og:image:secure_url"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:image:secure_url" content="${htmlEscapeAttr(seo.ogImage)}" />`);
  }
  if (seo.twitterImage) {
    out = out.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/>/,
      `<meta name="twitter:image" content="${htmlEscapeAttr(seo.twitterImage)}" />`);
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

function loadBlogArticles() {
  try {
    const raw = fs.readFileSync(BLOG_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`[seo-prerender] could not read blog-articles.json (${err.message}) — treating blog as empty.`);
    return [];
  }
}

function buildBlogPostHead(article) {
  const parts = [];
  const ld = toJsonLdScript(article.jsonLd);
  const faqLd = toJsonLdScript(article.faqJsonLd);
  if (ld) parts.push(`<script type="application/ld+json">${ld}</script>`);
  if (faqLd) parts.push(`<script type="application/ld+json">${faqLd}</script>`);
  return parts.join('\n');
}

// Re-enabled 2026-07-26 — relaunched on the self-hosted, two-gate-verified
// generator pipeline (tools/blog-generator/), not BabyLoveGrowth.
// blog-articles.json only ever contains published:true articles (see
// tools/fetch-blog-data.js's merge step), and the first 3 generator articles
// each get a full human read before publish — see
// tools/blog-generator/README.md. Indexable by default now, same as any
// other route; pushed into the `indexable` array so sitemap.xml includes
// every blog route exactly like the static pages above.
//
// RESIDUAL RISK, worth knowing: if BABYLOVE_API_KEY is ever re-added to the
// Cloudflare Pages build environment without first setting
// BLOG_COMPLIANCE_ENFORCE=true, BabyLoveGrowth articles would merge in here
// and ship indexable by default too — the compliance filter is still
// report-only (see tools/blog-compliance/README.md). Not a risk today
// (the key is deleted), but a real one to close before ever re-adding it.
function prerenderBlog(baseHtml, indexable) {
  const articles = loadBlogArticles();

  const blogIndexSeo = {
    title: 'Temecula Real Estate Blog | George Khazanovskiy',
    description: 'Real estate insights, market updates, and home buying/selling guides for Temecula Valley, Murrieta, and Menifee.',
    canonical: `${SITE}/blog/`,
    robots: 'index, follow',
  };
  writeRouteHtml('/blog/', patchHead(baseHtml, blogIndexSeo, '/blog/'));
  indexable.push({ path: '/blog/', priority: 0.6, changefreq: 'weekly' });
  console.log(`[seo-prerender] /blog/ (${articles.length} articles)`);

  for (const article of articles) {
    if (!article.slug) {
      console.warn(`[seo-prerender] blog article ${article.id || '(no id)'} missing slug — skipping`);
      continue;
    }
    const routePath = `/blog/${article.slug}/`;
    const seo = {
      title: article.title,
      description: article.meta_description || article.excerpt || '',
      canonical: `${SITE}${routePath}`,
      ogImage: article.hero_image_url,
      twitterImage: article.hero_image_url,
      robots: 'index, follow',
    };
    let patched = patchHead(baseHtml, seo, routePath);
    const blogHead = buildBlogPostHead(article);
    if (blogHead) {
      patched = patched.replace('</head>', `  ${blogHead}\n</head>`);
    }
    writeRouteHtml(routePath, patched);
    indexable.push({ path: routePath, priority: 0.6, changefreq: 'monthly' });
    console.log(`[seo-prerender] ${routePath}`);
    console.log(`    title: ${(seo.title || '(missing)').slice(0, 90)}`);
  }

  console.log(`[seo-prerender] blog: ${articles.length + 1} route(s) rendered and indexable (blog index + ${articles.length} article(s))`);
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error('[seo-prerender] dist/ not found — run vite build first.');
    process.exit(1);
  }
  const baseHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

  const indexable = [];
  let excludedNoindex = 0;
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
    let patched = patchHead(baseHtml, seo, route.path);
    if (route.head) {
      patched = patched.replace('</head>', `  ${route.head}\n</head>`);
    }
    // Homepage FAQ schema (2026-08-05): extractHelmet() above only captures
    // a fixed tag whitelist (title/meta/canonical/OG/Twitter) via regex --
    // it does NOT read <script type="application/ld+json"> out of a
    // component's <Helmet> at all. Without this, the FAQ schema added to
    // HomePage.jsx's Helmet would render correctly for live browsers
    // (client-side DOM update) but be silently absent from this static,
    // crawler-visible HTML -- the exact bug class this homepage FAQ project
    // exists to fix, just relocated. Injected directly from the same
    // src/data/homepage-faq.js array HomepageFAQSection.jsx renders, same
    // pattern buildBlogPostHead() already uses for blog articles below.
    if (route.path === '/') {
      const faqLd = toJsonLdScript(buildHomepageFaqJsonLd());
      if (faqLd) {
        patched = patched.replace('</head>', `  <script type="application/ld+json">${faqLd}</script>\n</head>`);
      }

      // Testimonials (2026-08-04): same visibility gap the FAQ block above
      // exists to close -- a component-only section renders fine for live
      // browsers but is invisible to a crawler that doesn't execute JS.
      // Unlike the FAQ there's no schema to lean on here by design (see
      // src/data/testimonials.js), so the actual visible text has to be
      // reachable from raw HTML directly. Wrapped in <noscript> so it's
      // inert, and never visibly duplicated, once React mounts over #root
      // for a real, JS-enabled visitor -- same technique already used for
      // the sitewide crawler-fallback block further down <body>.
      const testimonialsHtml = buildTestimonialsNoscriptHtml(TESTIMONIALS, GOOGLE_REVIEWS_URL);
      patched = patched.replace('<div id="root"></div>', `<div id="root"></div>\n\n    ${testimonialsHtml}`);
    }
    writeRouteHtml(route.path, patched);

    const noindex = !!seo.robots && /noindex/i.test(seo.robots);
    if (!noindex) indexable.push(route);
    else excludedNoindex += 1;

    const canonical = seo.canonical || `${SITE}${route.path}`;
    console.log(`[seo-prerender] ${route.path}`);
    console.log(`    title:     ${(seo.title || '(missing)').slice(0, 90)}`);
    console.log(`    canonical: ${canonical}`);
    console.log(`    robots:    ${seo.robots || '(inherits index,follow)'}`);
  }

  // Blog relaunched 2026-07-26 on the self-hosted generator pipeline — see
  // the comment on prerenderBlog() above for the compliance model and the
  // residual BabyLoveGrowth-report-only-mode risk.
  prerenderBlog(baseHtml, indexable);

  const sitemap = buildSitemap(indexable);
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap, 'utf8');
  console.log(`[seo-prerender] sitemap.xml written with ${indexable.length} indexable routes (excluded ${excludedNoindex} noindex)`);
}

main();
