import React from 'react';
import { Link } from 'react-router-dom';
import articles from '@/data/blog-articles.json';
import { formatArticleDate } from '@/lib/blog';
import { selectRelatedArticles } from '@/lib/relatedArticles';

// Batch B, AI SEO audit RISK #3 (2026-08-08) — deterministic, no-LLM
// related-articles block. Selection logic lives in
// src/lib/relatedArticles.js, shared with tools/seo-prerender.js's
// crawler-visible noscript injection so the two can never disagree about
// which articles are "related." Uses <Link> (SPA navigation), matching
// every other internal article link on this page (the "← Back to Blog"
// link above it). Renders nothing if there are 0 related articles
// (graceful degradation — a 1-article blog never shows an empty section).
export default function RelatedArticles({ currentSlug }) {
  const related = selectRelatedArticles({ currentSlug, articles, count: 3 });
  if (related.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-white/10">
      <h2 className="font-serif text-xl text-white font-bold mb-5">Related articles</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {related.map((article) => (
          <Link
            key={article.slug}
            to={`/blog/${article.slug}/`}
            className="bg-[#12384a] rounded-xl p-5 border border-white/10 hover:border-[#C8920A]/50 transition-colors flex flex-col"
          >
            <span className="text-gray-400 text-xs uppercase tracking-wide mb-2">
              {formatArticleDate(article.created_at)}
            </span>
            <span className="font-serif text-base text-white font-bold leading-snug">
              {article.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
