import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import Navigation from './Navigation';
import Footer from './Footer';
import articles from '@/data/blog-articles.json';
import { formatArticleDate } from '@/lib/blog';

const TITLE = 'Temecula Real Estate Blog | George Khazanovskiy';
const DESCRIPTION = 'Real estate insights, market updates, and home buying/selling guides for Temecula Valley, Murrieta, and Menifee.';

export default function BlogIndexPage() {
  const sorted = [...articles].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return (
    <>
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        {/* Re-indexed 2026-07-26 — relaunched on the two-gate-verified
            self-hosted generator pipeline; see tools/blog-generator/README.md. */}
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://temeculavalleyhomes.us/blog/" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content="https://temeculavalleyhomes.us/blog/" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
      </Helmet>

      <Navigation />
      <main className="bg-[#0D2E3A] min-h-screen">
        <section className="max-w-5xl mx-auto px-4 pt-10 pb-6 text-center">
          <span className="block font-sans text-[13px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold mb-3">
            Temecula Real Estate Blog
          </span>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-white font-bold leading-tight mb-3">
            Insights for Temecula Valley Buyers & Sellers
          </h1>
          <p className="text-gray-300 text-base max-w-xl mx-auto">
            Market updates, neighborhood guides, and practical advice from George Khazanovskiy.
          </p>
        </section>

        <section className="max-w-5xl mx-auto px-4 pb-16">
          {sorted.length === 0 ? (
            <div className="bg-[#12384a] rounded-xl p-10 text-center border border-white/10">
              <p className="text-gray-300 text-lg mb-2">Articles coming soon.</p>
              <p className="text-gray-400 text-sm">
                Check back shortly, or call George directly for immediate answers.
              </p>
              <a
                href="tel:+16192772766"
                className="inline-block mt-6 bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold py-3 px-8 rounded-lg transition-colors"
              >
                Call (619) 277-2766
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((article) => (
                <Link
                  key={article.id}
                  to={`/blog/${article.slug}/`}
                  className="bg-[#12384a] rounded-xl overflow-hidden border border-white/10 hover:border-[#C8920A]/50 transition-colors flex flex-col"
                >
                  {article.hero_image_url && (
                    <img
                      src={article.hero_image_url}
                      alt={article.title}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <span className="text-gray-400 text-xs uppercase tracking-wide mb-2">
                      {formatArticleDate(article.created_at)}
                    </span>
                    <h2 className="font-serif text-xl text-white font-bold leading-snug mb-2">
                      {article.title}
                    </h2>
                    <p className="text-gray-300 text-sm leading-relaxed flex-1">
                      {article.excerpt || article.meta_description}
                    </p>
                    <span className="text-[#C8920A] text-sm font-semibold mt-4">Read more →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
