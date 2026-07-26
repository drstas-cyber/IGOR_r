// Generated articles have hero_image_url: null by design (Phase 1 has no
// image-generation step). This is a regression tripwire, not a full render
// test: no React/DOM test harness exists in this repo (only node:test for
// plain JS), and building one is out of scope for this build. Verified by
// direct source read at build time (2026-07-25) that BlogIndexPage.jsx,
// BlogPostPage.jsx, and seo-prerender.js all already guard every
// hero_image_url use behind a truthiness check — a null value renders no
// <img>/og:image/twitter:image rather than crashing or emitting a broken
// tag. These tests assert those guards are still present in the source, so
// a future edit that removes one fails loudly here instead of silently at
// runtime.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.resolve(__dirname, '..', '..', 'src', 'components');
const SEO_PRERENDER = path.resolve(__dirname, '..', 'seo-prerender.js');

describe('null hero_image_url renders gracefully — guard presence checks', () => {
  test('BlogIndexPage.jsx guards its <img> and never renders one unconditionally', () => {
    const src = fs.readFileSync(path.join(COMPONENTS, 'BlogIndexPage.jsx'), 'utf8');
    assert.match(src, /article\.hero_image_url\s*&&/, 'expected a hero_image_url truthiness guard before rendering an <img>');
  });

  test('BlogPostPage.jsx guards its <img>, og:image, and twitter:image', () => {
    const src = fs.readFileSync(path.join(COMPONENTS, 'BlogPostPage.jsx'), 'utf8');
    const guardCount = (src.match(/article\.hero_image_url\s*&&/g) || []).length;
    assert.ok(guardCount >= 3, `expected at least 3 hero_image_url guards (img, og:image, twitter:image), found ${guardCount}`);
  });

  test('seo-prerender.js only patches og:image/twitter:image meta tags when seo.ogImage/seo.twitterImage is truthy', () => {
    const src = fs.readFileSync(SEO_PRERENDER, 'utf8');
    assert.match(src, /if\s*\(\s*seo\.ogImage\s*\)/);
    assert.match(src, /if\s*\(\s*seo\.twitterImage\s*\)/);
  });
});
