import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getKnownRoutes, formatKnownRoutesForPrompt } from './knownRoutes.mjs';

function isolatedBlogArticles(articles) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'known-routes-test-'));
  const filePath = path.join(dir, 'blog-articles.json');
  fs.writeFileSync(filePath, JSON.stringify(articles), 'utf8');
  return filePath;
}

describe('getKnownRoutes — canonical live-route list (2026-08-08)', () => {
  test('always includes every static page from ROUTES, real URLs', () => {
    const blogArticlesPath = isolatedBlogArticles([]);
    const routes = getKnownRoutes({ blogArticlesPath });
    const urls = routes.map((r) => r.url);
    assert.ok(urls.includes('https://temeculavalleyhomes.us/'));
    assert.ok(urls.includes('https://temeculavalleyhomes.us/homes-for-sale-temecula/'));
    assert.ok(urls.includes('https://temeculavalleyhomes.us/sell-my-house/'));
    assert.ok(urls.includes('https://temeculavalleyhomes.us/russian-speaking-realtor-temecula/'));
    assert.ok(urls.includes('https://temeculavalleyhomes.us/about-george/'));
    assert.ok(urls.includes('https://temeculavalleyhomes.us/contact/'));
  });

  test('always includes /blog/', () => {
    const blogArticlesPath = isolatedBlogArticles([]);
    const routes = getKnownRoutes({ blogArticlesPath });
    assert.ok(routes.some((r) => r.url === 'https://temeculavalleyhomes.us/blog/'));
  });

  test('includes every published article from the given blog-articles.json, with real titles', () => {
    const blogArticlesPath = isolatedBlogArticles([
      { slug: 'hoa-fees-temecula-homebuyers-guide', title: 'Understanding HOA Fees' },
      { slug: 'escrow-process-homebuyers-guide', title: 'What to Expect During Escrow' },
    ]);
    const routes = getKnownRoutes({ blogArticlesPath });
    const article1 = routes.find((r) => r.url === 'https://temeculavalleyhomes.us/blog/hoa-fees-temecula-homebuyers-guide/');
    assert.ok(article1);
    assert.equal(article1.title, 'Understanding HOA Fees');
  });

  test('an article missing a slug or title is skipped, not included as a broken entry', () => {
    const blogArticlesPath = isolatedBlogArticles([
      { slug: '', title: 'No Slug' },
      { slug: 'no-title' },
      { slug: 'valid-one', title: 'Valid Article' },
    ]);
    const routes = getKnownRoutes({ blogArticlesPath });
    const articleRoutes = routes.filter((r) => r.url.includes('/blog/') && r.url !== 'https://temeculavalleyhomes.us/blog/');
    assert.equal(articleRoutes.length, 1);
    assert.equal(articleRoutes[0].title, 'Valid Article');
  });

  test('fails closed (empty article list, not a throw) if blog-articles.json is missing/unreadable', () => {
    const routes = getKnownRoutes({ blogArticlesPath: '/does/not/exist.json' });
    // Static pages + /blog/ still present; just no article routes.
    assert.ok(routes.length >= 7);
    assert.equal(routes.some((r) => r.url.includes('/blog/nonexistent/')), false);
  });

  test('never includes the retired BabyLoveGrowth slugs (deliberately NOT sourced from slugs.js\'s getKnownSlugs)', () => {
    const blogArticlesPath = isolatedBlogArticles([]);
    const routes = getKnownRoutes({ blogArticlesPath });
    assert.equal(routes.some((r) => r.url.includes('hot-market-home-buying-best-practices')), false);
  });
});

describe('formatKnownRoutesForPrompt', () => {
  test('one line per route, "URL — Title"', () => {
    const text = formatKnownRoutesForPrompt([
      { url: 'https://temeculavalleyhomes.us/', title: 'Home' },
      { url: 'https://temeculavalleyhomes.us/blog/', title: 'Blog' },
    ]);
    assert.equal(text, 'https://temeculavalleyhomes.us/ — Home\nhttps://temeculavalleyhomes.us/blog/ — Blog');
  });

  test('empty list produces empty string, not an error', () => {
    assert.equal(formatKnownRoutesForPrompt([]), '');
  });
});
