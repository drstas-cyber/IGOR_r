import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  const linkClasses = "block font-sans text-[14px] sm:text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors duration-300 py-1 sm:py-0";
  const headingClasses = "font-sans text-[14px] text-white font-bold mb-6 uppercase tracking-wider";

  return (
    <footer className="bg-[#0D2E3A] text-white pb-[70px] md:pb-0">
      {/* Main Footer Content */}
      <div className="py-[50px] px-[24px] md:px-[60px] max-w-7xl mx-auto">
        <div className="bg-[#C8920A] rounded-lg p-8 mb-12 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-serif text-[24px] text-[#12202A] font-bold">Ready to Make Your Move?</h3>
            <p className="font-sans text-[14px] text-[#12202A]/80">Free consultation. No obligation. Available 7 days a week.</p>
          </div>
          <a href="tel:6192772766" className="bg-[#12202A] hover:bg-[#1a3a4a] text-white font-bold py-4 px-8 rounded-lg text-[16px] transition-colors whitespace-nowrap">
            Call (619) 277-2766
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-12 lg:gap-[80px]">
          
          {/* Column 1: Brand */}
          <div className="flex flex-col space-y-4">
            <h2 className="font-serif text-[24px] text-white font-bold">
              Temecula Valley Homes
            </h2>
            <p className="font-sans text-[13px] text-gray-300 leading-[1.6]">
              Expert Real Estate Services in Temecula Valley. Dedicated to your long-term real estate success with George Khazanovskiy.
            </p>
            <div className="pt-2 flex flex-col space-y-2">
              <a href="tel:6192772766" className="font-sans text-[13px] text-[#C8920A] font-bold hover:text-white transition-colors">
                📞 619-277-2766
              </a>
              <a href="mailto:askgeorgek@gmail.com" className="font-sans text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors">
                askgeorgek@gmail.com
              </a>
              <a href="https://maps.google.com/?q=30777+Rancho+California+Rd,+Temecula,+CA+92592" target="_blank" rel="noopener noreferrer" className="font-sans text-[13px] text-gray-300 hover:text-[#C8920A] transition-colors">
                📍 30777 Rancho California Rd, Temecula, CA 92592
              </a>
            </div>
            <div className="pt-4">
              <Link to="/russian-speaking-realtor-temecula" className="inline-flex items-center gap-2 font-sans text-[13px] text-white font-bold hover:text-[#C8920A] transition-colors bg-white/10 px-4 py-2 rounded-md border border-white/20 hover:border-[#C8920A]/50">
                <span>🇷🇺</span> Русскоязычный риэлтор
              </Link>
            </div>
          </div>

          {/* Column 2: Buy a Home */}
          <div>
            <h3 className={headingClasses}>Buy a Home</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <a href="#search" className={linkClasses}>Search All Homes</a>
              <a href="#search" className={linkClasses}>Homes Under $600K</a>
              <a href="#search" className={linkClasses}>Wine Country Estates</a>
              <a href="#search" className={linkClasses}>New Construction</a>
              <a href="#alerts" className={linkClasses}>Listing Alerts</a>
              <a href="#about" className={linkClasses}>First-Time Buyer Guide</a>
            </div>
          </div>

          {/* Column 3: Sell Your Home */}
          <div>
            <h3 className={headingClasses}>Sell Your Home</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <a href="#homevalue" className={linkClasses}>Free Home Valuation</a>
              <a href="#homevalue" className={linkClasses}>What's My Home Worth?</a>
              <a href="#about" className={linkClasses}>How We Market Homes</a>
              <a href="#about" className={linkClasses}>Seller's Process</a>
              <a href="#about" className={linkClasses}>Free Seller's Guide</a>
            </div>
          </div>

          {/* Column 4: Important Links */}
          <div>
            <h3 className={headingClasses}>Important Links</h3>
            <div className="space-y-4 md:space-y-[24px]">
              <Link to="/homes-for-sale-temecula/" className={linkClasses}>Browse Temecula Homes</Link>
              <Link to="/sell-my-house/" className={linkClasses}>Free Home Valuation</Link>
              <Link to="/about-george/" className={linkClasses}>About George</Link>
              <Link to="/contact/" className={linkClasses}>Contact</Link>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#C8920A]">
        <div className="max-w-7xl mx-auto py-[20px] px-[24px] flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
          <p className="font-sans text-[12px] text-gray-300">
            © 2026 TemeculaValleyHomes.us · George Khazanovskiy, Realtor® · DRE #02034120 · Allison James Estates & Homes
          </p>
          <div className="font-sans text-[12px] text-gray-300 flex flex-wrap justify-center gap-2">
            <span>Equal Housing Opportunity</span>
            <span>|</span>
            <span>DRE #02034120</span>
            <span>|</span>
            <span>Allison James Estates & Homes</span>
          </div>
        </div>
      </div>
    </footer>
  );
}