import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { Toaster } from '@/components/ui/toaster';
import HomePage from '@/components/HomePage';
import RussianRealtorPage from '@/components/RussianRealtorPage';
import ContactPage from '@/components/ContactPage';
import SellMyHousePage from '@/components/SellMyHousePage';
import BuyerHomesPage from '@/components/BuyerHomesPage';
import AboutGeorgePage from '@/components/AboutGeorgePage';
import BlogPlaceholderPage from '@/components/BlogPlaceholderPage';
import NotFound from '@/components/NotFound';
import { captureFirstTouch } from '@/lib/attribution';

function App() {
  // Capture gclid/fbclid/utm_* into sessionStorage on first mount of the
  // session. Preserves attribution through internal nav (landing-page → form
  // page) so submit-time payload carries the click ID even after URL params
  // strip on navigation. See src/lib/attribution.js.
  useEffect(() => { captureFirstTouch(); }, []);

  return (
    <>
      <Helmet>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/russian-speaking-realtor-temecula" element={<RussianRealtorPage />} />
          <Route path="/russian-speaking-realtor-temecula/" element={<RussianRealtorPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/contact/" element={<ContactPage />} />
          <Route path="/sell-my-house" element={<SellMyHousePage />} />
          <Route path="/sell-my-house/" element={<SellMyHousePage />} />
          <Route path="/homes-for-sale-temecula" element={<BuyerHomesPage />} />
          <Route path="/homes-for-sale-temecula/" element={<BuyerHomesPage />} />
          <Route path="/about-george" element={<AboutGeorgePage />} />
          <Route path="/about-george/" element={<AboutGeorgePage />} />
          {/* Blog routes removed 2026-07-24 — AI-authored content fabricates
              first-person claims attributed to George, reintroduces removed
              tenure/exclusivity language. BlogIndexPage/BlogPostPage, the
              article data, and the fetch pipeline stay on disk untouched.
              /blog/ and /blog specifically get a real placeholder route
              (below) — added 2026-07-26 to replace an orphaned pre-unpublish
              deployment artifact that was still resolving stale content at
              that exact path; see the audit that led to this. Every other
              /blog/* path (individual article slugs) still falls through to
              the catch-all (soft-404, noindex) until content is fixed and
              re-verified — do not add more blog routes here without also
              wiring the corresponding entry in tools/seo-prerender.js's
              ROUTES array, or the static prerendered <head> won't match. */}
          <Route path="/blog" element={<BlogPlaceholderPage />} />
          <Route path="/blog/" element={<BlogPlaceholderPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      
      <Toaster />
    </>
  );
}

export default App;