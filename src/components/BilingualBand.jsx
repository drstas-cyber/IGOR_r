import React from 'react';
import { motion } from 'framer-motion';

export default function BilingualBand() {
  return (
    <section className="bg-[#3A5420] py-[50px] px-[20px] md:px-[60px] overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
        
        {/* Left Side */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="flex-1 space-y-4 text-center md:text-left"
        >
          <div className="font-sans text-[32px] tracking-widest">
            🇺🇸 🇷🇺 🇺🇦
          </div>
          <h2 className="font-serif text-[32px] md:text-[40px] text-white font-bold leading-tight">
            Говорим по-русски и по-украински
          </h2>
          <p className="font-sans text-[14px] text-[#A6C48A] leading-relaxed">
            Your trusted Russian and Ukrainian-speaking real estate advisor in Southern California.
          </p>
          <p className="font-sans text-[16px] text-[#FAF6EF] italic pb-2">
            "Real estate in your language, your culture, your trust."
          </p>
          <a 
            href="tel:6192772766"
            className="inline-block bg-[#C8920A] hover:bg-[#A37508] text-[#12202A] font-sans text-[14px] font-bold py-[14px] px-[24px] rounded transition-colors"
          >
            📞 Позвонить сейчас — Call George
          </a>
        </motion.div>

        {/* Right Side Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full md:w-auto"
        >
          <div className="bg-[#FAF6EF] rounded-[8px] p-[24px] shadow-lg max-w-sm mx-auto md:mx-0 border border-[#C8920A]/20">
            <p className="font-sans text-[14px] text-[#12202A] text-center font-medium leading-relaxed">
              Единственный русскоязычный риэлтор<br />в долине Темекула
            </p>
            <div className="text-center">
              <a 
                href="/russian-speaking-realtor-temecula"
                className="bg-[#1a1a2e] text-white rounded-full px-4 py-2 text-sm font-semibold inline-flex items-center gap-2 mt-4 hover:bg-[#252545] transition-colors"
              >
                RU Русскоязычный риэлтор
              </a>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}