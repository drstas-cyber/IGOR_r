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
import BlogIndexPage from '@/components/BlogIndexPage';
import BlogPostPage from '@/components/BlogPostPage';
import NotFound from '@/components/NotFound';
import ScrollToTop from '@/components/ScrollToTop';
import HashSectionRedirect from '@/components/HashSectionRedirect';
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
        <ScrollToTop />
        <HashSectionRedirect />
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
          {/* Blog re-enabled 2026-07-26 — relaunched on the self-hosted
              generator pipeline (tools/blog-generator/), not BabyLoveGrowth.
              Content is two-gate-verified (regex scanner + independent LLM
              claim review) and the first 3 articles get a full human read
              before publish (see tools/blog-generator/README.md). Only
              published:true articles ever reach blog-articles.json — see
              tools/fetch-blog-data.js's merge step. Adding another blog
              route here requires a matching entry in
              tools/seo-prerender.js's ROUTES array. */}
          <Route path="/blog" element={<BlogIndexPage />} />
          <Route path="/blog/" element={<BlogIndexPage />} />
          <Route path="/blog/:slug" element={<BlogPostPage />} />
          <Route path="/blog/:slug/" element={<BlogPostPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
      
      <Toaster />
    </>
  );
}

export default App;