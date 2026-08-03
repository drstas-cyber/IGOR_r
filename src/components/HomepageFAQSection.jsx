import React from 'react';
import { motion } from 'framer-motion';
import { HOMEPAGE_FAQ } from '@/data/homepage-faq';

// Accessible by construction: native <details>/<summary> rather than a
// hand-rolled ARIA accordion — keyboard-operable (Enter/Space toggle,
// focus-visible by default), screen-reader-announced as expandable
// ("expanded"/"collapsed") with zero extra ARIA wiring, and degrades to
// fully-readable static content with JS disabled (every answer is present
// in the DOM either way, just closed by default). Renders directly from
// HOMEPAGE_FAQ — the same array HomePage.jsx's Helmet script and
// tools/seo-prerender.js's static injection both read — so this text and
// the FAQPage schema cannot drift apart.
export default function HomepageFAQSection() {
  return (
    <section id="faq" className="bg-[#FAF6EF] py-[60px] px-[24px] lg:px-[80px]">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10 text-center"
        >
          <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[2px] font-semibold block mb-3">
            Common Questions
          </span>
          <h2 className="font-serif text-[32px] sm:text-[40px] md:text-[48px] text-[#12202A] font-semibold leading-tight">
            Frequently Asked Questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="divide-y divide-[#12202A]/10 border-t border-b border-[#12202A]/10"
        >
          {HOMEPAGE_FAQ.map((item) => (
            <details key={item.question} className="group py-5">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-sans text-[16px] sm:text-[17px] font-semibold text-[#12202A]">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[#C8920A] text-[22px] leading-none transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="font-sans text-[15px] text-[#3A3A3A] leading-[1.7] mt-3 pr-8">
                {item.answer}
              </p>
            </details>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
