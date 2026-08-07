import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import StickyNavigation from '@/components/StickyNavigation';
import AgentBioSection from '@/components/AgentBioSection';
import GoogleReviews from '@/components/GoogleReviews';
import BilingualBand from '@/components/BilingualBand';
import ContactForm from '@/components/ContactForm';
import MobileBottomBar from '@/components/MobileBottomBar';
import Footer from '@/components/Footer';

export default function AboutGeorgePage() {
  // Scroll-reset on navigation is now handled centrally by
  // src/components/ScrollToTop.jsx (audit item 4) -- removed here to
  // avoid the redundant/inconsistent per-component pattern.
  return (
    <>
      <Helmet>
        <html lang="en" />
        <title>About George Khazanovskiy | Temecula Realtor</title>
        <link rel="canonical" href="https://temeculavalleyhomes.us/about-george/" />
        <meta name="description" content="Meet George Khazanovskiy — experienced Temecula, Murrieta & Menifee Realtor, a Russian & Ukrainian-speaking agent in the area." />
        <meta name="keywords" content="George Khazanovskiy, Temecula realtor, Russian speaking realtor Temecula, Ukrainian realtor Temecula, Allison James, DRE 02034120, Temecula real estate agent, trilingual realtor" />

        <meta property="og:title" content="About George Khazanovskiy | Temecula Valley Realtor®" />
        <meta property="og:description" content="Experienced, Russian/Ukrainian-speaking realtor serving Temecula, Murrieta + Menifee. Allison James Estates & Homes." />
        <meta property="og:type" content="profile" />
        <meta property="og:url" content="https://temeculavalleyhomes.us/about-george/" />
        <meta property="og:image" content="https://temeculavalleyhomes.us/images/george-photo.jpg" />
        <meta property="og:image:width" content="800" />
        <meta property="og:image:height" content="800" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="About George Khazanovskiy | Temecula Valley Realtor®" />
        <meta name="twitter:description" content="Experienced, Russian/Ukrainian-speaking realtor serving Temecula, Murrieta + Menifee." />
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
              "knowsLanguage": ["English", "Russian", "Ukrainian"]
            }
          ]
        })}</script>
      </Helmet>

      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary selection:text-white">
        <StickyNavigation />
        <main>
        <section className="bg-secondary px-6 py-14 text-center">
          <h1 className="font-serif text-[34px] sm:text-[44px] lg:text-[52px] text-white font-bold leading-tight max-w-3xl mx-auto">
            Meet George Khazanovskiy — Temecula Valley Realtor
          </h1>
          {/* Internal link — AI SEO audit Batch B Part 2 (2026-08-08).
              AgentBioSection below is shared with BuyerHomesPage.jsx, so
              the "existing bio paragraph" this link was drafted for isn't
              unique to this page -- weaving it there would leak the link
              onto the buyer page too. Placed here instead, in the one
              section unique to About. */}
          <p className="font-sans text-[15px] text-gray-300 mt-4 max-w-2xl mx-auto">
            George specializes in{' '}
            <Link to="/homes-for-sale-temecula/" className="underline hover:text-white transition-colors">helping buyers find a home</Link>{' '}
            across Temecula Valley.
          </p>
        </section>
        <AgentBioSection />
        <GoogleReviews />
        <BilingualBand />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ContactForm />
        </div>
        {/* Internal link — AI SEO audit Batch B Part 2 (2026-08-08) */}
        <p className="text-center text-sm text-gray-500 pb-10 px-4">
          <Link to="/blog/" className="underline hover:text-[#C8920A] transition-colors">Read more on the blog</Link>.
        </p>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    </>
  );
}
