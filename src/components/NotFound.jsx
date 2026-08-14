import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

/**
 * Catch-all route for unmatched URLs, for the one case a real HTTP 404
 * can't cover: client-side navigation to a bad path (e.g. a broken
 * internal <Link>) inside an already-mounted SPA session, where the
 * browser never makes a fresh top-level request Cloudflare could 404.
 *
 * A fresh request to an unknown path (typo'd URL, phantom landing-page
 * path, dead slug) now gets a REAL HTTP 404 before React ever loads --
 * public/404.html, served natively by Cloudflare Pages once the SPA
 * catch-all (`/* /index.html 200`) was removed from public/_redirects
 * 2026-08-13 (see the 404-task cleanup-batch commit). `robots: noindex`
 * here is belt-and-suspenders for the in-session case above, not the
 * primary 404 mechanism anymore.
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
          <Link to="/" className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Return Home
          </Link>
          <Link to="/homes-for-sale-temecula/" className="border-2 border-white/60 hover:border-white text-white px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Homes For Sale
          </Link>
          <Link to="/contact/" className="border-2 border-white/60 hover:border-white text-white px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold transition-colors text-center">
            Contact George
          </Link>
        </nav>
      </main>
    </>
  );
}
