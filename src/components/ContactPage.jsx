import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Navigation from './Navigation';
import Footer from './Footer';
import { trackFormSubmission } from '@/lib/tracking';
import { validateSubmission, resetFormTimer } from '@/lib/antispam';

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    resetFormTimer();
    if (window.location.search.includes('submitted=true')) setSubmitted(true);
    window.scrollTo(0, 0);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);

    const check = validateSubmission({
      email: formData.get('email') || '',
      name: formData.get('name') || '',
      website_url: formData.get('website_url'),
    });
    if (check.blocked) { alert('Please check your information and try again.'); return; }

    formData.append('_subject', 'New Lead from Google Ads: ' + (formData.get('name') || 'Unknown'));
    formData.append('_next', 'https://temeculavalleyhomes.us/contact/?submitted=true');
    formData.append('_captcha', 'false');

    try {
      const response = await fetch('https://formsubmit.co/askgeorgek@gmail.com', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
        trackFormSubmission('contact_lead', { form_name: 'google_ads_contact' });
        if (window.gtag) {
          window.gtag('event', 'conversion', { send_to: 'AW-18044804522/J5XxCNy15ZEcEKq7t5xD', value: 100.0, currency: 'USD' });
          window.gtag('event', 'generate_lead', { currency: 'USD', value: 100 });
        }
        setSubmitted(true);
      }
    } catch {}
  };

  const inputClasses = "w-full px-4 py-3 border border-gray-200 rounded-lg text-[15px] focus:outline-none focus:border-[#C8920A] focus:ring-1 focus:ring-[#C8920A] min-h-[48px]";

  return (
    <>
      <Helmet>
        <title>Contact George Khazanovskiy | Temecula Valley Realtor | (619) 277-2766</title>
        <meta name="description" content="Contact George Khazanovskiy — top-rated Temecula Valley Realtor with 14+ years experience. Free consultation for buyers and sellers. Call (619) 277-2766." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navigation />
      <main className="bg-[#0D2E3A] min-h-screen">

        {/* ABOVE THE FOLD */}
        <section className="max-w-xl mx-auto px-4 pt-4 pb-10">

          {/* George's Profile */}
          <div className="text-center mb-4">
            <img
              src="/images/george-photo.jpg"
              alt="George Khazanovskiy — Temecula Valley Realtor"
              className="rounded-full mx-auto mb-3 object-cover"
              style={{width:'161px',height:'161px',objectPosition:'center 15%',border:'3px solid #C8920A',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}
            />
            <h1 className="text-2xl font-serif font-bold text-white mb-1">George Khazanovskiy</h1>
            <p className="text-[#C8920A] font-semibold text-sm mb-2">Licensed Realtor® · DRE #02034120 · Allison James Estates & Homes</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-300">
              <span className="flex items-center gap-1">
                <span className="text-[#C8920A]">★★★★★</span> 5.0 · 23 Reviews
              </span>
              <span>14+ Years Local Expert</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">English · Russian · Ukrainian</p>
            <p className="text-[#C8920A] text-xs font-medium mt-2">Sellers average 100.1% of asking price</p>
          </div>

          {/* Phone CTA */}
          <a
            href="tel:+16192772766"
            className="block w-full bg-[#C8920A] hover:bg-[#B38209] text-white text-center font-bold text-lg py-4 rounded-lg mb-2 transition-colors min-h-[56px] flex items-center justify-center gap-2 shadow-lg"
          >
            📞 CALL GEORGE — (619) 277-2766
          </a>

          {/* Text CTA */}
          <a
            href="sms:+16192772766"
            className="block w-full bg-transparent border border-[#C8920A]/50 hover:border-[#C8920A] text-[#C8920A] text-center font-semibold text-sm py-2.5 rounded-lg mb-5 transition-colors"
          >
            💬 Text George Instead
          </a>

          {submitted ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-lg">
              <div className="text-4xl mb-3">✓</div>
              <h2 className="text-xl font-bold text-[#0D2E3A] mb-2">Thank You!</h2>
              <p className="text-gray-600">George will contact you within 1 hour.</p>
              <p className="text-gray-500 text-sm mt-2">Or call now: <a href="tel:+16192772766" className="text-[#C8920A] font-bold">(619) 277-2766</a></p>
            </div>
          ) : (
            <>
              <div className="text-center text-gray-400 text-sm mb-3 flex items-center gap-3 justify-center">
                <span className="h-px w-12 bg-gray-600"></span> OR <span className="h-px w-12 bg-gray-600"></span>
              </div>

              {/* Contact Form */}
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-3">
                  {/* Honeypot — properly hidden */}
                  <div style={{position:'absolute',left:'-9999px',height:0,overflow:'hidden'}} aria-hidden="true">
                    <input type="text" name="website_url" tabIndex="-1" autoComplete="off" />
                  </div>

                  <input type="text" name="name" required placeholder="Your name" className={inputClasses} />
                  <input type="tel" name="phone" required placeholder="Your phone number" className={inputClasses} />
                  <input type="email" name="email" placeholder="Your email (optional)" className={inputClasses} />
                  <select name="intent" defaultValue="buy" className={inputClasses + " bg-white"}>
                    <option value="buy">I want to buy a home</option>
                    <option value="sell">I want to sell my home</option>
                    <option value="both">Buy and sell</option>
                    <option value="valuation">Get a free home valuation</option>
                  </select>
                  <button
                    type="submit"
                    className="w-full bg-[#0D2E3A] hover:bg-[#1a4a5e] text-white font-bold py-3.5 rounded-lg text-[16px] transition-colors min-h-[52px] shadow-md"
                  >
                    Talk to George — Free, No Obligation
                  </button>
                </form>
                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <p className="text-gray-400 text-xs">Your info is private. George responds within 1 hour.</p>
                </div>

                {/* Testimonial */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-gray-600 text-sm italic leading-relaxed">"George helped us find our dream home in Temecula in just 3 weeks. His knowledge of the area and responsiveness were outstanding."</p>
                  <p className="text-gray-400 text-xs mt-1">— Recent Google Review ★★★★★</p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* BELOW THE FOLD — Trust + Areas */}
        <section className="max-w-xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-serif font-bold text-white mb-4 text-center">Why George?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['100.1% Sale-to-List Ratio', 'George gets sellers above asking price on average.'],
              ['Homes Sell in 25 Days', 'Faster than the valley average — strategic pricing works.'],
              ['Only Trilingual Agent', 'English, Russian, Ukrainian — serving all families.'],
              ['Allison James Estates & Homes', '14+ years with a trusted, full-service brokerage.'],
            ].map(([title, desc], i) => (
              <div key={i} className="bg-[#12384a] rounded-lg p-4 border border-white/10">
                <div className="text-[#C8920A] font-bold text-sm mb-1">✓ {title}</div>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Areas served */}
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs">Serving: Temecula · Murrieta · Menifee · Wildomar · Lake Elsinore · Fallbrook · Winchester · Redhawk · Wine Country · Old Town</p>
          </div>

          {/* Email fallback */}
          <div className="text-center mt-6">
            <p className="text-gray-400 text-sm">Prefer email?</p>
            <a href="mailto:askgeorgek@gmail.com" className="text-[#C8920A] font-semibold hover:underline">
              askgeorgek@gmail.com
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
