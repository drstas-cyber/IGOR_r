import React, { useState } from 'react';
import { motion } from 'framer-motion';
import BuyForm from './BuyForm';
import SellForm from './SellForm';

export default function HeroSection() {
  const [activeTab, setActiveTab] = useState('buy');

  return (
    <section className="relative min-h-[100vh] lg:h-[100vh] flex items-center bg-secondary overflow-hidden">
      <div className="absolute inset-0 z-0">
        <picture>
          <source
            type="image/avif"
            srcSet="/assets/hero/hero-400.avif 400w, /assets/hero/hero-800.avif 800w, /assets/hero/hero-1200.avif 1200w, /assets/hero/hero-1600.avif 1600w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/assets/hero/hero-400.webp 400w, /assets/hero/hero-800.webp 800w, /assets/hero/hero-1200.webp 1200w, /assets/hero/hero-1600.webp 1600w"
            sizes="100vw"
          />
          <img
            src="/assets/hero/hero-800.jpg"
            srcSet="/assets/hero/hero-400.jpg 400w, /assets/hero/hero-800.jpg 800w, /assets/hero/hero-1200.jpg 1200w, /assets/hero/hero-1600.jpg 1600w"
            sizes="100vw"
            width="1600"
            height="1067"
            fetchPriority="high"
            decoding="async"
            alt="Temecula Valley vineyard landscape"
            className="w-full h-full object-cover object-center"
          />
        </picture>
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
          <span className="block font-sans text-[13px] sm:text-[12px] text-[#C8920A] uppercase tracking-[0.15em] sm:tracking-[0.2em] font-semibold mb-4">
            Top-Rated Realtor · Licensed Since 2017 · DRE #02034120
          </span>
          <h1 className="font-serif text-[36px] sm:text-[48px] lg:text-[56px] text-white font-bold leading-[1.1] mb-6 drop-shadow-md">
            Your Temecula Valley Realtor — George Khazanovskiy
          </h1>
          <p className="font-sans text-[16px] text-gray-200 leading-[1.6] max-w-lg font-light drop-shadow mb-8">
            Temecula median price $740K. George Khazanovskiy — top-rated, in real estate since 2000, licensed Realtor since 2017, and Temecula's only Russian & Ukrainian speaking agent.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            <a
              href="#home-value"
              className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold text-lg transition-colors shadow-lg text-center"
            >
              Get Free Home Valuation
            </a>
            <a
              href="tel:6192772766"
              className="border-2 border-white/60 hover:border-white text-white px-8 py-3 min-h-[48px] flex items-center justify-center rounded-md font-bold text-lg transition-colors text-center"
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
                activeTab === 'buy' ? 'text-secondary' : 'text-gray-600 hover:text-gray-800'
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
                activeTab === 'sell' ? 'text-secondary' : 'text-gray-600 hover:text-gray-800'
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
