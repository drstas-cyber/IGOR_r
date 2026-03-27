import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import ScrollingTicker from '@/components/ScrollingTicker';
import StickyNavigation from '@/components/StickyNavigation';
import HeroSection from '@/components/HeroSection';
import StatsBar from '@/components/StatsBar';
import MLSSearchSection from '@/components/MLSSearchSection';
import FeaturedListings from '@/components/FeaturedListings';
import HomeValueForm from '@/components/HomeValueForm';
import BilingualBand from '@/components/BilingualBand';
import AboutSection from '@/components/AboutSection';
import SearchSection from '@/components/SearchSection';
import MarketReports from '@/components/MarketReports';
import GoogleReviews from '@/components/GoogleReviews';
import ContactForm from '@/components/ContactForm';
import AgentBioSection from '@/components/AgentBioSection';
import ListingAlertsSection from '@/components/ListingAlertsSection';
import Footer from '@/components/Footer';
import { useToast } from '@/components/ui/use-toast';
import { trackFormSubmission } from '@/lib/tracking';

export default function HomePage() {
  const { toast } = useToast();
  
  // Lifted Modal State
  const [showModal, setShowModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fbError, setFbError] = useState(false);

  useEffect(() => {
    // Initialize Facebook SDK
    window.fbAsyncInit = function() {
      if (window.FB) {
        window.FB.init({
          xfbml      : true,
          version    : 'v18.0'
        });
        
        // Parse XFBML to ensure proper rendering of Facebook plugins
        window.FB.XFBML.parse();
      }
    };

    // Load the SDK asynchronously
    (function(d, s, id) {
      var js, fjs = d.getElementsByTagName(s)[0];
      if (d.getElementById(id)) return;
      js = d.createElement(s); js.id = id;
      js.src = "https://connect.facebook.net/en_US/sdk.js";
      js.onerror = () => setFbError(true);
      fjs.parentNode.insertBefore(js, fjs);
    }(document, 'script', 'facebook-jssdk'));

    // Fallback error check if SDK blocked by adblockers
    const timeout = setTimeout(() => {
      if (!window.FB) {
        setFbError(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const form = e.target;
    const formData = new FormData(form);

    formData.append('_subject', 'MLS Search Lead - TemeculaValleyHomes.us');
    formData.append('_captcha', 'false');

    try {
      const response = await fetch("https://formsubmit.co/askgeorgek@gmail.com", {
        method: "POST",
        body: formData,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        trackFormSubmission('mls_search', { form_name: 'mls_search_lead' });
        setIsSubmitted(true);
        form.reset();
      } else {
        toast({
          title: "Submission Error",
          description: "There was a problem submitting your form. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Could not connect to the server. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

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
        
        {/* 1. HeroSection & Stats */}
        <HeroSection setShowModal={setShowModal} />
        <StatsBar />
        
        {/* 2. AboutSection */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <AboutSection />
        </div>

        {/* 3. HomeValueForm */}
        <HomeValueForm />

        {/* 4. GoogleReviews */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <GoogleReviews />
        </div>

        {/* 5. AgentBioSection */}
        <AgentBioSection />

        {/* 6. MLSSearchSection */}
        <MLSSearchSection 
          showModal={showModal} 
          setShowModal={setShowModal} 
          handleSubmit={handleSubmit}
          isSubmitted={isSubmitted}
          setIsSubmitted={setIsSubmitted}
          isLoading={isLoading}
        />
        
        {/* Supporting Search Sections & Featured Content */}
        <FeaturedListings />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-12">
            <SearchSection 
              showModal={showModal}
              setShowModal={setShowModal}
              handleSubmit={handleSubmit}
              isSubmitted={isSubmitted}
              setIsSubmitted={setIsSubmitted}
              isLoading={isLoading}
            />
            <MarketReports />
            
            <div className="grid grid-cols-1 gap-12">
              {/* 7. ContactForm */}
              <ContactForm />
            </div>
          </div>
        </main>

        {/* 8. Reordered BilingualBand (Moved to appear above ListingAlerts) */}
        <BilingualBand />
        
        {/* 9. ListingAlertsSection */}
        <ListingAlertsSection />

        {/* 10. Facebook Section */}
        <section className="bg-[#FAF6EF] py-16 px-4 flex flex-col items-center">
          <div className="max-w-7xl mx-auto w-full flex flex-col items-center text-center">
            <h2 className="font-serif text-[40px] md:text-[48px] text-[#0D2E3A] font-bold mb-4">
              Follow George on Facebook
            </h2>
            <p className="font-sans text-[16px] text-gray-600 mb-8">
              See latest listings, market updates & community news
            </p>
            
            <div className="w-full flex justify-center mb-8 relative">
              {fbError && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-2xl z-10 border border-gray-200">
                  <div className="text-gray-500 max-w-sm text-center px-4">
                    <p className="mb-4">We couldn't load the Facebook feed. Please check your adblocker or try visiting the page directly.</p>
                  </div>
                </div>
              )}
              {/* Added fb-page class to allow FB.XFBML.parse() to work dynamically if the iframe route is overridden by SDK */}
              <div className="fb-page" data-href="https://www.facebook.com/GeorgeKHomes/" data-tabs="timeline" data-width="500" data-height="600" data-small-header="false" data-adapt-container-width="true" data-hide-cover="false" data-show-facepile="true">
                <iframe 
                  src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FGeorgeKHomes%2F&tabs=timeline&width=500&height=600&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true" 
                  width="500" 
                  height="600" 
                  style={{ 
                    border: 'none', 
                    overflow: 'hidden', 
                    borderRadius: '16px', 
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    margin: '0 auto',
                    maxWidth: '100%'
                  }} 
                  scrolling="no" 
                  frameBorder="0" 
                  allowFullScreen={true} 
                  allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                  title="Facebook Page Plugin"
                ></iframe>
              </div>
            </div>

            <a 
              href="https://www.facebook.com/GeorgeKHomes/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-[#1877F2] hover:bg-[#166FE5] text-white rounded-full font-bold transition-colors inline-block text-center mt-4"
              style={{ padding: '14px 32px' }}
            >
              👍 Follow on Facebook
            </a>
          </div>
        </section>
        
        <Footer />
      </div>
    </>
  );
}