import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';

/**
 * Catch-all route for unmatched URLs (e.g. the phantom landing-page paths from
 * the stale Ads plan, or any typo'd URL). Without this, react-router rendered
 * nothing and Cloudflare's SPA fallback soft-200'd a blank homepage shell.
 *
 * `robots: noindex` keeps these soft-404s out of the index. Note: this is a
 * SOFT 404 (HTTP 200 + noindex) — a true 404 status would require editing
 * public/_redirects (`/* /index.html 200`), which is the load-bearing
 * trailing-slash routing surface and must not change. noindex is Google's
 * endorsed pattern for SPA not-found pages.
 */
export default function NotFound() {
  useEffect(() => {
    // index.html ships a permissive robots meta ("index, follow, ...") that
    // react-helmet APPENDS to rather than replaces (it isn't helmet-managed),
    // leaving two conflicting robots tags. Remove the stray one so the only
    // robots signal on an unknown URL is Helmet's noindex below. Crawlers fetch
    // each URL with fresh HTML, so removing it here has no cross-page SEO effect.
    document
      .querySelectorAll('meta[name="robots"]:not([data-react-helmet])')
      .forEach((t) => t.remove());
  }, []);

  return (
    <>
      <Helmet>
        <title>Page Not Found | Temecula Valley Homes</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <main className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6 py-24 bg-secondary">
        <span className="font-sans text-[13px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold mb-4">
          404 — Page Not Found
        </span>
        <h1 className="font-serif text-[32px] sm:text-[40px] text-white font-bold leading-[1.15] mb-4 max-w-2xl">
          We couldn't find that page
        </h1>
        <p className="font-sans text-[16px] text-gray-200 leading-[1.6] max-w-md font-light mb-8">
          The page you're looking for may have moved or no longer exists. Here are some places to start instead.
        </p>
        <nav className="flex flex-col sm:flex-row flex-wrap gap-4 justify-center" aria-label="Helpful links">
          <a href="/" className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Return Home
          </a>
          <a href="/homes-for-sale-temecula/" className="border-2 border-white/60 hover:border-white text-white px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Homes For Sale
          </a>
          <a href="/contact/" className="border-2 border-white/60 hover:border-white text-white px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Contact George
          </a>
        </nav>
      </main>
    </>
  );
}
