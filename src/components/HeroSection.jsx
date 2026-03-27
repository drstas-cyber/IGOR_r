import React, { useState } from 'react';
import { motion } from 'framer-motion';
import BuyForm from './BuyForm';
import SellForm from './SellForm';
import { trackPhoneClick } from '@/lib/tracking';

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState('buy');

  return (
    <section className="relative min-h-[100vh] lg:h-[100vh] flex items-center bg-secondary overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1698276427006-0573e67c4f6a"
          alt="Temecula Valley vineyard landscape"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D2E3A]/90 via-[#0D2E3A]/70 to-transparent" />
        <div className="absolute inset-0 bg-[#0D2E3A]/40 lg:hidden" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-16 w-full relative z-10 py-20 lg:py-0 flex flex-col lg:flex-row items-center justify-between gap-12">

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full lg:w-1/2 text-left"
        >
          <span className="block font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold mb-4">
            5.0★ Google Rating · 14+ Years · DRE #02034120
          </span>
          <h1 className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] text-white font-bold leading-[1.1] mb-6 drop-shadow-md">
            Temecula Homes Are Selling in 25 Days — Are You Ready?
          </h1>
          <p className="font-sans text-[16px] text-gray-200 leading-[1.6] max-w-lg font-light drop-shadow mb-8">
            Median price $740K, selling at 100.1% of asking. George Khazanovskiy — rated 5.0★ on Google, 14+ years local experience, and Temecula's only Russian & Ukrainian speaking Realtor.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#home-value"
              className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] px-8 py-3 rounded-md font-bold text-lg transition-colors shadow-lg"
            >
              Get Free Home Valuation
            </a>
            <a
              href="tel:6192772766"
              onClick={trackPhoneClick}
              className="border-2 border-white/60 hover:border-white text-white px-8 py-3 rounded-md font-bold text-lg transition-colors"
            >
              Call Now — (619) 277-2766
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="w-full lg:w-[450px] bg-[#FAF6EF] rounded-xl shadow-2xl p-6 sm:p-8"
        >
          <div className="flex border-b border-gray-200 mb-2">
            <button
              onClick={() => setActiveTab('buy')}
              className={`flex-1 pb-3 text-[15px] font-medium transition-colors relative ${
                activeTab === 'buy' ? 'text-secondary' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              I Want to Buy
              {activeTab === 'buy' && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#C8920A]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`flex-1 pb-3 text-[15px] font-medium transition-colors relative ${
                activeTab === 'sell' ? 'text-secondary' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              I Want to Sell
              {activeTab === 'sell' && (
                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#C8920A]" />
              )}
            </button>
          </div>

          <div className="mt-4">
            {activeTab === 'buy' ? <BuyForm /> : <SellForm />}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
