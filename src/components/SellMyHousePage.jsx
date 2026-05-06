import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import Navigation from './Navigation';
import Footer from './Footer';
import { validateSubmission, resetFormTimer } from '@/lib/antispam';

export default function SellMyHousePage() {
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

    formData.append('_subject', 'Seller Lead — Home Valuation Request: ' + (formData.get('name') || 'Unknown'));
    formData.append('_next', 'https://temeculavalleyhomes.us/sell-my-house/?submitted=true');
    formData.append('_captcha', 'false');

    try {
      const response = await fetch('https://formsubmit.co/askgeorgek@gmail.com', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' },
      });
      if (response.ok) {
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
        <title>Sell Your Temecula Home for Top Dollar | George Khazanovskiy | (619) 277-2766</title>
        <meta name="description" content="Get a free home valuation from George Khazanovskiy — Temecula sellers average 100.1% of asking price and sell in just 25 days. 14+ years local expertise." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navigation />
      <main className="bg-[#0D2E3A] min-h-screen">

        {/* ── HERO ── */}
        <section className="max-w-2xl mx-auto px-4 pt-6 pb-8 text-center">
          <img
            src="/images/george-photo.jpg"
            alt="George Khazanovskiy — Temecula Valley Realtor"
            className="rounded-full mx-auto mb-4 object-cover"
            style={{width:'140px',height:'140px',objectPosition:'center 15%',border:'3px solid #C8920A',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}
          />
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white leading-tight mb-3">
            Sell Your Temecula Home<br className="hidden sm:block" /> for Top Dollar
          </h1>
          <p className="text-gray-300 text-base sm:text-lg max-w-md mx-auto mb-4">
            George Khazanovskiy has helped Temecula Valley homeowners net <span className="text-[#C8920A] font-semibold">above asking price</span> for over 14 years.
          </p>

          {/* Quick stats row */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-8 mb-6">
            {[
              ['100.1%', 'Sale-to-List'],
              ['25 Days', 'Avg. Sell Time'],
              ['14+ Years', 'Local Experience'],
            ].map(([stat, label]) => (
              <div key={label}>
                <div className="text-[#C8920A] font-bold text-2xl sm:text-3xl font-serif">{stat}</div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">{label}</div>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <a
            href="#valuation-form"
            className="inline-block w-full sm:w-auto bg-[#C8920A] hover:bg-[#B38209] text-white font-bold text-lg px-10 py-4 rounded-lg transition-colors shadow-lg"
          >
            GET MY FREE HOME VALUATION
          </a>
        </section>

        {/* ── STATS BAR ── */}
        <section className="bg-[#12202A] border-y border-white/10">
          <div className="max-w-3xl mx-auto px-4 py-5 flex flex-wrap justify-center gap-6 sm:gap-12 text-center">
            {[
              ['$740K', 'Temecula Median Price'],
              ['100.1%', 'Avg. Sale-to-List'],
              ['25 Days', 'Avg. Days on Market'],
            ].map(([val, label]) => (
              <div key={label}>
                <div className="text-white font-bold text-xl sm:text-2xl font-serif">{val}</div>
                <div className="text-gray-400 text-xs">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FORM SECTION ── */}
        <section id="valuation-form" className="max-w-xl mx-auto px-4 py-10">
          <h2 className="text-2xl font-serif font-bold text-white text-center mb-2">
            Get Your Free Home Valuation
          </h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Find out what your Temecula home is worth — no obligation, 100% free.
          </p>

          {submitted ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-lg">
              <div className="text-4xl mb-3">✓</div>
              <h3 className="text-xl font-bold text-[#0D2E3A] mb-2">Thank You!</h3>
              <p className="text-gray-600">George will prepare your personalized home valuation and contact you within 1 hour.</p>
              <p className="text-gray-500 text-sm mt-2">Or call now: <a href="tel:+16192772766" className="text-[#C8920A] font-bold">(619) 277-2766</a></p>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Honeypot — properly hidden */}
                <div style={{position:'absolute',left:'-9999px',height:0,overflow:'hidden'}} aria-hidden="true">
                  <input type="text" name="website_url" tabIndex="-1" autoComplete="off" />
                </div>

                <input type="text" name="address" required placeholder="Property address" className={inputClasses} />
                <input type="text" name="name" required placeholder="Your name" className={inputClasses} />
                <input type="tel" name="phone" required placeholder="Your phone number" className={inputClasses} />
                <input type="email" name="email" placeholder="Your email (optional)" className={inputClasses} />
                <select name="timeline" defaultValue="" className={inputClasses + " bg-white"}>
                  <option value="" disabled>When are you looking to sell?</option>
                  <option value="asap">As soon as possible</option>
                  <option value="1-3months">1–3 months</option>
                  <option value="3-6months">3–6 months</option>
                  <option value="6-12months">6–12 months</option>
                  <option value="just-curious">Just curious about my value</option>
                </select>
                <button
                  type="submit"
                  className="w-full bg-[#C8920A] hover:bg-[#B38209] text-white font-bold py-4 rounded-lg text-[16px] transition-colors min-h-[52px] shadow-md"
                >
                  GET MY FREE HOME VALUATION
                </button>
              </form>
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <p className="text-gray-400 text-xs">Your info is private. George responds within 1 hour.</p>
              </div>
            </div>
          )}
        </section>

        {/* ── WHY GEORGE (TRUST) ── */}
        <section className="max-w-2xl mx-auto px-4 pb-10">
          <h2 className="text-2xl font-serif font-bold text-white mb-5 text-center">
            Why Temecula Homeowners Choose George
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Sellers Average 100.1% of Asking Price', 'Strategic pricing backed by hyper-local data means you net more at closing.'],
              ['Homes Sell in Just 25 Days', 'Professional staging guidance, photography, and aggressive marketing cut days on market.'],
              ['14+ Years of Temecula Expertise', 'George knows every neighborhood, school zone, and price trend in the valley.'],
              ['Trilingual — English, Russian, Ukrainian', 'Reaching more qualified buyers expands your pool and drives competition.'],
              ['Full-Service Marketing Plan', 'MLS, Zillow, Realtor.com, social media, and targeted advertising from day one.'],
              ['No Obligation Free Consultation', 'Get a professional valuation and selling strategy with zero pressure.'],
            ].map(([title, desc], i) => (
              <div key={i} className="bg-[#12384a] rounded-lg p-4 border border-white/10">
                <div className="text-[#C8920A] font-bold text-sm mb-1">{title}</div>
                <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIAL ── */}
        <section className="max-w-xl mx-auto px-4 pb-10">
          <div className="bg-[#12384a] rounded-xl p-6 border border-white/10 text-center">
            <p className="text-gray-300 text-sm italic leading-relaxed mb-3">
              "George sold our Temecula home in under three weeks and we got over asking price. His market knowledge and negotiation skills are second to none. Highly recommend!"
            </p>
            <p className="text-gray-500 text-xs">— Recent Google Review <span className="text-[#C8920A]">★★★★★</span></p>
          </div>
        </section>

        {/* ── PHONE CTA ── */}
        <section className="max-w-xl mx-auto px-4 pb-12 text-center">
          <p className="text-gray-400 text-sm mb-3">Prefer to talk? Call George directly.</p>
          <a
            href="tel:+16192772766"
            className="inline-block w-full sm:w-auto bg-[#C8920A] hover:bg-[#B38209] text-white text-center font-bold text-lg py-4 px-10 rounded-lg transition-colors min-h-[56px] shadow-lg"
          >
            CALL (619) 277-2766
          </a>

          {/* Areas served */}
          <div className="mt-8">
            <p className="text-gray-500 text-xs">Serving: Temecula · Murrieta · Menifee · Wildomar · Lake Elsinore · Fallbrook · Winchester · Redhawk · Wine Country · Old Town</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
