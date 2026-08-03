import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
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

export default function HomePage() {
  const { toast } = useToast();
  const faqJsonLd = toJsonLdScript(buildHomepageFaqJsonLd());

  // Cross-page "/#home-value" links (StickyNavigation, on pages other than
  // "/") land here via a full page load, which the browser tries to
  // hash-scroll before React has mounted anything — too early, since this is
  // a client-rendered SPA. Retry once React has actually rendered the target.
  useEffect(() => {
    if (window.location.hash !== '#home-value') return;
    const scrollToHomeValue = () => {
      const el = document.getElementById('home-value');
      if (!el) return false;
      // index.css sets `html { scroll-behavior: smooth }` sitewide. scrollIntoView's
      // `behavior` option defers to that CSS property, so this became an
      // rAF-driven animation that never got a frame this early in a cold SPA
      // load. Override inline (wins over the stylesheet rule) for one
      // synchronous jump, then restore normal smooth-scroll for everything else.
      const prevBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      el.scrollIntoView();
      document.documentElement.style.scrollBehavior = prevBehavior;
      return true;
    };
    if (!scrollToHomeValue()) {
      const timer = setTimeout(scrollToHomeValue, 150);
      return () => clearTimeout(timer);
    }
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
        </main>

        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
