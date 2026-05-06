import React from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import StickyNavigation from '@/components/StickyNavigation';
import StatsBar from '@/components/StatsBar';
import FeaturedListings from '@/components/FeaturedListings';
import NeighborhoodsGrid from '@/components/NeighborhoodsGrid';
import GoogleReviews from '@/components/GoogleReviews';
import AgentBioSection from '@/components/AgentBioSection';
import ListingAlertsSection from '@/components/ListingAlertsSection';
import ContactForm from '@/components/ContactForm';
import BilingualBand from '@/components/BilingualBand';
import MobileBottomBar from '@/components/MobileBottomBar';
import Footer from '@/components/Footer';

export default function BuyerHomesPage() {
  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>Homes For Sale in Temecula | Live MLS Search | George Khazanovskiy Realtor® DRE #02034120</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/homes-for-sale-temecula/" />
        <meta
          name="description"
          content="Search every active home for sale in Temecula Valley — Wolf Creek, Harveston, Redhawk, La Cresta, Wine Country, Old Town. Daily MLS updates. Filter by price, beds, neighborhood. Free with George Khazanovskiy, DRE #02034120, Allison James Estates & Homes."
        />
        <meta
          name="keywords"
          content="homes for sale in temecula, temecula homes for sale, temecula houses for sale, houses for sale temecula, temecula real estate, real estate agent temecula, realtor temecula, homes for sale murrieta, homes for sale menifee, wolf creek temecula homes, harveston temecula, la cresta real estate"
        />

        <meta property="og:title" content="Homes For Sale in Temecula | Live MLS Search | George K." />
        <meta property="og:description" content="Browse every active Temecula home. Updated daily. Free MLS access with George Khazanovskiy, Realtor®." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://temeculavalleyhomes.us/homes-for-sale-temecula/" />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Homes For Sale in Temecula | Live MLS Search | George K." />
        <meta name="twitter:description" content="Browse every active Temecula home. Updated daily. Free MLS access." />
        <meta name="twitter:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />

        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "RealEstateAgent",
          "name": "George Khazanovskiy",
          "url": "https://temeculavalleyhomes.us/homes-for-sale-temecula/",
          "image": "https://temeculavalleyhomes.us/images/george-photo.jpg",
          "telephone": "+1-619-277-2766",
          "areaServed": ["Temecula", "Murrieta", "Menifee", "Lake Elsinore", "Wildomar", "Winchester", "Fallbrook"],
          "address": { "@type": "PostalAddress", "addressRegion": "CA", "addressLocality": "Temecula" },
          "aggregateRating": { "@type": "AggregateRating", "ratingValue": "5" },
          "knowsLanguage": ["English", "Russian", "Ukrainian"],
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <StickyNavigation />

        {/* 1. HERO — H1 exact-match to "homes for sale in temecula" search query */}
        <section className="bg-[#0D2E3A] pt-24 pb-14 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold block mb-4">
              Live MLS Access · Updated Daily
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold text-white max-w-4xl mx-auto leading-tight">
              Homes For Sale in Temecula
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mt-5">
              Search every active listing in Temecula Valley — Wolf Creek, Harveston, Redhawk, La Cresta, Wine Country, and Old Town. Filter by price, beds, and neighborhood.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="#featured-listings"
                className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold px-8 py-4 rounded-md text-lg shadow-lg transition-colors"
              >
                Browse Listings
              </a>
              <a
                href="tel:6192772766"
                className="bg-white hover:bg-gray-100 text-[#12202A] font-bold px-8 py-4 rounded-md text-lg shadow-lg transition-colors"
              >
                Call (619) 277-2766
              </a>
            </div>
          </motion.div>
        </section>

        {/* 2. STATS — quick credibility bar */}
        <StatsBar />

        {/* 3. FEATURED LISTINGS — actual inventory above the fold (KEY for QS) */}
        <div id="featured-listings">
          <FeaturedListings />
        </div>

        {/* 4. NEIGHBORHOODS — answers "homes for sale in [neighborhood]" intent */}
        <NeighborhoodsGrid />

        {/* 5. SOCIAL PROOF */}
        <GoogleReviews />

        {/* 6. AGENT */}
        <AgentBioSection />

        {/* 7. SECONDARY CAPTURE — listing alerts */}
        <ListingAlertsSection />

        {/* 8. CONTACT */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ContactForm />
        </main>

        {/* 9. BILINGUAL BAND */}
        <BilingualBand />

        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
