import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import ScrollingTicker from '@/components/ScrollingTicker';
import StickyNavigation from '@/components/StickyNavigation';
import HeroSection from '@/components/HeroSection';
import StatsBar from '@/components/StatsBar';
import HomeValueForm from '@/components/HomeValueForm';
import BilingualBand from '@/components/BilingualBand';
import GoogleReviews from '@/components/GoogleReviews';
import ContactForm from '@/components/ContactForm';
import AgentBioSection from '@/components/AgentBioSection';
import ListingAlertsSection from '@/components/ListingAlertsSection';
import HomepageFAQSection from '@/components/HomepageFAQSection';
import MobileBottomBar from '@/components/MobileBottomBar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { buildHomepageFaqJsonLd } from '@/data/homepage-faq';
import { toJsonLdScript } from '@/lib/blog';
import { isKnownHomeSectionHash } from '@/lib/homeSectionScroll';

export default function HomePage() {
  const { toast } = useToast();
  const faqJsonLd = toJsonLdScript(buildHomepageFaqJsonLd());
  const { hash } = useLocation();

  // isInitialRenderRef (2026-08-19 nav-hash audit): distinguishes "this
  // hash was already present when HomePage mounted" (cold load, or an SPA
  // <Link> landing here from another route) from "the hash just changed
  // while HomePage was already sitting on screen" (a same-page nav click).
  // Only the first case needs the instant-jump workaround below — the
  // second is exactly the ORIGINAL in-page click behavior (a plain
  // <a href="#id">, animated by index.css's sitewide `scroll-behavior:
  // smooth`) that the audit's fix must leave untouched. Flipped to false
  // by the second effect below, which runs once, after the very first
  // paint, regardless of whether a hash was present — so it's already
  // false by the time any later, user-triggered hash change reaches the
  // first effect, even if the initial load had no hash at all.
  const isInitialRenderRef = useRef(true);

  // Cross-page "/#<section>" links (StickyNavigation/Navigation, on pages
  // other than "/", plus HashSectionRedirect's cold-load redirect) land
  // here — either via a full page load (browser tries to hash-scroll
  // before React has mounted anything, too early for a client-rendered
  // SPA) or an SPA <Link> transition (no hash-scroll attempt at all,
  // since react-router's history.pushState doesn't trigger the browser's
  // native anchor-scroll the way a real navigation does). Either way,
  // this effect owns the actual scroll once React has rendered the
  // target, retrying if it hasn't yet.
  //
  // Generalized 2026-08-19 (nav-hash audit) — previously hardcoded to
  // '#home-value' only; every other known section (about-george, contact,
  // listing-alerts) had no retry-scroll at all, so a cross-page link to
  // any of them landed on the homepage but never actually scrolled.
  // Re-runs on `hash` change too (not just on mount), so a same-page nav
  // click from elsewhere on the homepage itself (hash changes without an
  // unmount/remount) still scrolls — but see isInitialRenderRef above:
  // that same-page case must animate smoothly, not jump, so it branches.
  useEffect(() => {
    if (!isKnownHomeSectionHash(hash)) return;
    const id = hash.slice(1);
    const instantJump = isInitialRenderRef.current;
    const scrollToSection = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      if (instantJump) {
        // index.css sets `html { scroll-behavior: smooth }` sitewide. scrollIntoView's
        // `behavior` option defers to that CSS property, so this became an
        // rAF-driven animation that never got a frame this early in a cold SPA
        // load. Override inline (wins over the stylesheet rule) for one
        // synchronous jump, then restore normal smooth-scroll for everything else.
        const prevBehavior = document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = 'auto';
        el.scrollIntoView();
        document.documentElement.style.scrollBehavior = prevBehavior;
      } else {
        // Already mounted, hash changed from a same-page click — this is
        // React already past its first paint, so the CSS transition has a
        // frame to animate on; no override needed, matches the original
        // plain-anchor behavior exactly.
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return true;
    };
    if (!scrollToSection()) {
      const timer = setTimeout(scrollToSection, 150);
      return () => clearTimeout(timer);
    }
  }, [hash]);

  // Runs once, after the first paint, unconditionally — flips
  // isInitialRenderRef regardless of whether the initial load had a hash,
  // so a hash that only appears later (a genuine same-page click) is
  // never mistaken for the initial-load case. Declared after the effect
  // above so React runs them in that order within the same commit.
  useEffect(() => {
    isInitialRenderRef.current = false;
  }, []);

  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>Temecula Valley Homes For Sale | George Khazanovskiy</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/" />
        <meta name="description" content="Temecula Realtor George Khazanovskiy — Russian & Ukrainian speaking. Request a free home valuation or a no-obligation buyer consultation. DRE #02034120." />
        <meta name="keywords" content="Temecula homes for sale, Temecula Valley real estate, Temecula Realtor, George Khazanovskiy, DRE #02034120, Russian speaking realtor, Ukrainian speaking realtor, Temecula Valley Homes, wine country real estate, Murrieta homes" />

        <meta property="og:title" content="Temecula Valley Homes For Sale | George Khazanovskiy" />
        <meta property="og:description" content="Temecula Realtor George Khazanovskiy — Russian & Ukrainian speaking. Request a free home valuation or a no-obligation buyer consultation. DRE #02034120." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://temeculavalleyhomes.us" />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Temecula Valley Homes For Sale | George Khazanovskiy" />
        <meta name="twitter:description" content="Temecula Realtor George Khazanovskiy — Russian & Ukrainian speaking. Request a free home valuation or a no-obligation buyer consultation. DRE #02034120." />
        <meta name="twitter:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
        {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />}
      </Helmet>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <ScrollingTicker />
        <StickyNavigation />

        <main>
        {/* 1. Hero + Buy/Sell Forms */}
        <HeroSection />
        <StatsBar />

        {/* 2. Social Proof — real Google reviews */}
        <GoogleReviews />

        {/* 3. Seller Lead Capture */}
        <HomeValueForm />

        {/* 4. Agent Credentials */}
        <AgentBioSection />

        {/* 5. Contact Form */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ContactForm />
        </div>

        {/* 7. Bilingual Band */}
        <BilingualBand />

        {/* 8. Listing Alerts */}
        <ListingAlertsSection />

        {/* 9. FAQ — visible text and FAQPage JSON-LD both generated from
            src/data/homepage-faq.js; see that file's header comment. */}
        <HomepageFAQSection />

        {/* Internal link — AI SEO audit Batch B Part 2 (2026-08-08) */}
        <p className="text-center text-sm text-gray-500 pb-10 px-4">
          <Link to="/blog/" className="underline hover:text-[#C8920A] transition-colors">Read our latest buying and selling guides</Link>.
        </p>
        </main>

        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
