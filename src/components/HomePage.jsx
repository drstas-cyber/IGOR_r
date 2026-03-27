import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import ScrollingTicker from '@/components/ScrollingTicker';
import StickyNavigation from '@/components/StickyNavigation';
import HeroSection from '@/components/HeroSection';
import StatsBar from '@/components/StatsBar';
import FeaturedListings from '@/components/FeaturedListings';
import HomeValueForm from '@/components/HomeValueForm';
import BilingualBand from '@/components/BilingualBand';
import GoogleReviews from '@/components/GoogleReviews';
import ContactForm from '@/components/ContactForm';
import AgentBioSection from '@/components/AgentBioSection';
import ListingAlertsSection from '@/components/ListingAlertsSection';
import MobileBottomBar from '@/components/MobileBottomBar';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { trackFormSubmission } from '@/lib/tracking';

export default function HomePage() {
  const { toast } = useToast();

  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>Temecula Valley Homes For Sale | George Khazanovskiy Realtor® | DRE #02034120</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/" />
        <meta name="description" content="Search all Temecula Valley homes for sale. Free instant home valuation. Russian & Ukrainian speaking Realtor. George Khazanovskiy, DRE #02034120, Allison James Estates & Homes." />
        <meta name="keywords" content="Temecula homes for sale, Temecula Valley real estate, Temecula Realtor, George Khazanovskiy, DRE #02034120, Russian speaking realtor, Ukrainian speaking realtor, Temecula Valley Homes, wine country real estate, Murrieta homes" />

        <meta property="og:title" content="Temecula Valley Homes For Sale | George Khazanovskiy Realtor® | DRE #02034120" />
        <meta property="og:description" content="Search all Temecula Valley homes for sale. Free instant home valuation. Russian & Ukrainian speaking Realtor. George Khazanovskiy, DRE #02034120, Allison James Estates & Homes." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://temeculavalleyhomes.us" />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Temecula Valley Homes For Sale | George Khazanovskiy Realtor® | DRE #02034120" />
        <meta name="twitter:description" content="Search all Temecula Valley homes for sale. Free instant home valuation. Russian & Ukrainian speaking Realtor. George Khazanovskiy, DRE #02034120, Allison James Estates & Homes." />
        <meta name="twitter:image" content="https://temeculavalleyhomes.us/images/og-image.jpg" />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <ScrollingTicker />
        <StickyNavigation />

        {/* 1. Hero + Buy/Sell Forms */}
        <HeroSection />
        <StatsBar />

        {/* 2. Social Proof — early for trust */}
        <GoogleReviews />

        {/* 3. Seller Lead Capture */}
        <HomeValueForm />

        {/* 4. Agent Credentials */}
        <AgentBioSection />

        {/* 5. Featured Listings */}
        <FeaturedListings />

        {/* 6. Contact Form */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ContactForm />
        </main>

        {/* 7. Bilingual Band */}
        <BilingualBand />

        {/* 8. Listing Alerts */}
        <ListingAlertsSection />

        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
