import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet';
import StickyNavigation from '@/components/StickyNavigation';
import AgentBioSection from '@/components/AgentBioSection';
import GoogleReviews from '@/components/GoogleReviews';
import BilingualBand from '@/components/BilingualBand';
import ContactForm from '@/components/ContactForm';
import MobileBottomBar from '@/components/MobileBottomBar';
import Footer from '@/components/Footer';

export default function AboutGeorgePage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>About George Khazanovskiy | Temecula Valley Realtor® | DRE #02034120</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/about-george/" />
        <meta name="description" content="Meet George Khazanovskiy — top-rated Temecula Valley Realtor with 14+ years local experience, five-star reviewed, and the only Russian/Ukrainian-speaking real estate agent in the region. Allison James Estates & Homes, DRE #02034120." />
        <meta name="keywords" content="George Khazanovskiy, Temecula realtor, Russian speaking realtor Temecula, Ukrainian realtor Temecula, Allison James, DRE 02034120, Temecula real estate agent, trilingual realtor" />

        <meta property="og:title" content="About George Khazanovskiy | Temecula Valley Realtor®" />
        <meta property="og:description" content="14+ yrs local experience, five-star reviewed, only Russian/Ukrainian-speaking realtor in Temecula Valley. Allison James Estates & Homes." />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content="https://temeculavalleyhomes.us/about-george/" />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/george-photo.jpg" />
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="800" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About George Khazanovskiy | Temecula Valley Realtor®" />
        <meta name="twitter:description" content="14+ yrs local experience, five-star reviewed, only Russian/Ukrainian-speaking realtor in Temecula Valley." />
        <meta name="twitter:image" content="https://temeculavalleyhomes.us/images/george-photo.jpg" />

        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "AboutPage",
              "@id": "https://temeculavalleyhomes.us/about-george/#aboutpage",
              "url": "https://temeculavalleyhomes.us/about-george/",
              "name": "About George Khazanovskiy | Temecula Valley Realtor®",
              "description": "Profile and credentials of George Khazanovskiy — Temecula Valley Realtor®, DRE #02034120, with Allison James Estates & Homes.",
              "isPartOf": { "@id": "https://temeculavalleyhomes.us/#website" },
              "mainEntity": { "@id": "https://temeculavalleyhomes.us/#person" },
              "about": { "@id": "https://temeculavalleyhomes.us/#agent" },
              "primaryImageOfPage": {
                "@type": "ImageObject",
                "url": "https://temeculavalleyhomes.us/images/george-photo.jpg",
                "width": 800,
                "height": 800
              }
            },
            {
              "@type": "Person",
              "@id": "https://temeculavalleyhomes.us/#person",
              "name": "George Khazanovskiy",
              "jobTitle": "Licensed Realtor®",
              "url": "https://temeculavalleyhomes.us/about-george/",
              "telephone": "+16192772766",
              "email": "askgeorgek@gmail.com",
              "image": "https://temeculavalleyhomes.us/images/george-photo.jpg",
              "knowsLanguage": ["English", "Russian", "Ukrainian"],
              "worksFor": { "@id": "https://temeculavalleyhomes.us/#brokerage" },
              "hasCredential": {
                "@type": "EducationalOccupationalCredential",
                "credentialCategory": "Real Estate License",
                "identifier": "DRE #02034120",
                "recognizedBy": {
                  "@type": "Organization",
                  "name": "California Department of Real Estate"
                }
              }
            },
            {
              "@type": ["RealEstateAgent", "LocalBusiness"],
              "@id": "https://temeculavalleyhomes.us/#agent",
              "name": "George Khazanovskiy - Temecula Valley Realtor",
              "url": "https://temeculavalleyhomes.us/about-george/",
              "telephone": "+16192772766",
              "email": "askgeorgek@gmail.com",
              "image": "https://temeculavalleyhomes.us/images/george-photo.jpg",
              "address": {
                "@type": "PostalAddress",
                "streetAddress": "30777 Rancho California Rd",
                "addressLocality": "Temecula",
                "addressRegion": "CA",
                "postalCode": "92592",
                "addressCountry": "US"
              },
              "founder": { "@id": "https://temeculavalleyhomes.us/#person" },
              "knowsLanguage": ["English", "Russian", "Ukrainian"],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "5.0",
                "bestRating": "5"
              }
            }
          ]
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <StickyNavigation />
        <AgentBioSection />
        <GoogleReviews />
        <BilingualBand />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ContactForm />
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
