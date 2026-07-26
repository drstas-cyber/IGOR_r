import React from 'react';
import { Helmet } from 'react-helmet';
import Navigation from './Navigation';
import Footer from './Footer';

// Minimal placeholder for /blog/ while the real blog (BlogIndexPage/BlogPostPage,
// untouched on disk) stays unrouted pending compliance sanitization — see
// tools/fetch-blog-data.js and the audit that led to this page. This is NOT the
// blog returning; it exists specifically so the orphaned pre-unpublish /blog/
// asset (stale content, indexable) has a real, current, correctly-signaled page
// to be replaced by. Rendered output here must match dist/blog/index.html's
// prerendered markup exactly — this is the FIRST client-side route ever
// registered for /blog since the 2026-07-24 unpublish, and mismatched
// server/client output would flash the placeholder then replace it, which is
// worse than either alternative. Keep this component static (no client-only
// conditional rendering) so that guarantee holds.
export default function BlogPlaceholderPage() {
  return (
    <>
      <Helmet>
        <title>Blog Returning Soon | Temecula Valley Homes</title>
        <meta
          name="description"
          content="Our Temecula Valley real estate blog is being refreshed and will return soon. In the meantime, explore homes for sale or contact George directly."
        />
        <meta name="robots" content="noindex, follow" />
        <link rel="canonical" href="https://temeculavalleyhomes.us/blog/" />
      </Helmet>
      <Navigation />
      <main className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-24 bg-secondary">
        <span className="font-sans text-[13px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold mb-4">
          Blog
        </span>
        <h1 className="font-serif text-[32px] sm:text-[40px] text-white font-bold leading-[1.15] mb-4 max-w-2xl">
          Our blog is returning soon
        </h1>
        <p className="font-sans text-[16px] text-gray-300 max-w-xl mb-10">
          We're refreshing our Temecula Valley real estate articles and will have them back up shortly.
          In the meantime, here's how to get started:
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <a
            href="/"
            className="inline-block bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold text-[15px] px-8 py-3 rounded-lg transition-colors"
          >
            Return Home
          </a>
          <a
            href="/homes-for-sale-temecula/"
            className="inline-block bg-transparent border border-[#C8920A]/50 hover:border-[#C8920A] text-[#C8920A] font-semibold text-[15px] px-8 py-3 rounded-lg transition-colors"
          >
            Homes For Sale
          </a>
          <a
            href="/contact/"
            className="inline-block bg-transparent border border-[#C8920A]/50 hover:border-[#C8920A] text-[#C8920A] font-semibold text-[15px] px-8 py-3 rounded-lg transition-colors"
          >
            Contact George
          </a>
        </div>
      </main>
      <Footer />
    </>
  );
}
