import React from 'react';
import { motion } from 'framer-motion';

// Real, attributed Google reviews from George's live Birdeye/Google profile
// (verified 2026-07-26). Text is used verbatim — do not paraphrase, embellish,
// or add reviews without updating the source verification date/link below.
const SOURCE_URL = 'https://www.google.com/maps?q=place_id:ChIJPRmE4Vd_24ARRp3Jx_5WMq8';
const RATING = '5.0';
const REVIEW_COUNT = 17;

const reviews = [
  {
    id: 1,
    name: 'Rogelio Camp',
    text: "We met George from a referral who also bought with him a few years ago and was very happy… He asked us what we wanted in a house and what part of Temecula Valley we had interest in, drove us around several areas and shared his experience with each community. George showed up at every walk-thru…",
    excerpt: true,
  },
  {
    id: 2,
    name: 'Susan Hancock',
    text: "I was recommended to George by a friend and I'm so thankful I chose him as my realtor! Another realtor said the house needed so much work, which discouraged us. Once I spoke with George, that all changed. He had full confidence we'd have success and guided us every step. One month later we were officially closed — we couldn't have done it without George's support.",
    excerpt: false,
  },
  {
    id: 3,
    name: 'N. B.',
    text: "Professionalism and dedication!!! George helped me find my first home. Very knowledgeable, honest, patient, and available any time I needed. He guided me through every step, answered all my questions, and truly listened. Now I'm a happy homeowner! Highly recommend.",
    excerpt: false,
  },
  {
    id: 4,
    name: 'NaSh Appliance Group',
    text: "George helped us buy a home in Menifee. Always available, very responsive, and guided us through the entire process. Highly recommend.",
    excerpt: false,
  },
  {
    id: 5,
    name: 'Viacheslav',
    text: "Sincere gratitude to George for the outstanding work as our realtor during the search and purchase of our home. Always available at any time of day; we truly appreciated his constant communication and reliability. Thanks to his expertise and dedication we purchased our home quickly and smoothly…",
    excerpt: true,
  },
];

export default function GoogleReviews() {
  return (
    <section className="bg-[#FAF6EF] py-[60px] lg:py-[60px] px-[24px] lg:px-[80px]">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center md:text-left mb-12"
        >
          <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold block mb-3">
            Google Reviews
          </span>
          <h2 className="font-serif text-[32px] sm:text-[40px] md:text-[48px] text-[#12202A] leading-tight mb-3">
            What Clients Say on Google
          </h2>
          <p className="font-sans text-[16px] text-[#12202A] font-semibold">
            {RATING} <span className="text-[#C8920A]">★★★★★</span> · {REVIEW_COUNT} Google reviews
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {reviews.map((review, idx) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 * idx }}
              className="bg-white rounded-[8px] p-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 flex flex-col"
            >
              <div className="text-[#C8920A] text-[18px] tracking-widest mb-4">
                ★★★★★
              </div>
              <p className="font-sans text-[14px] text-[#12202A] leading-[1.8] flex-grow mb-4 italic">
                "{review.text}"
              </p>
              {review.excerpt && (
                <a
                  href={SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-[12px] text-[#C8920A] font-semibold hover:underline mb-4 inline-block"
                >
                  Read full review on Google →
                </a>
              )}
              <div>
                <p className="font-sans text-[14px] sm:text-[13px] font-bold text-[#12202A] mb-1">
                  {review.name}
                </p>
                <p className="font-sans text-[13px] sm:text-[12px] text-gray-500">
                  via Google
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex justify-center"
        >
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#C8920A] hover:bg-[#B38209] transition-colors rounded-[8px] py-[20px] px-[32px] shadow-md inline-flex items-center gap-3"
          >
            <span className="font-serif text-white text-xl font-bold bg-[#12202A] w-8 h-8 flex items-center justify-center rounded-full">G</span>
            <span className="font-sans text-[14px] text-[#12202A] font-bold">
              Read all reviews on Google
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}
