import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GOOGLE_RATING, GOOGLE_REVIEW_COUNT, GOOGLE_REVIEWS_URL } from '@/lib/reviews';
import { TESTIMONIALS } from '@/data/testimonials';

// Real, verbatim Google reviews -- see src/data/testimonials.js for the
// source capture, the verbatim policy, and why this section carries no
// AggregateRating/Review schema.
const SOURCE_URL = GOOGLE_REVIEWS_URL;
const RATING = GOOGLE_RATING;
const REVIEW_COUNT = GOOGLE_REVIEW_COUNT;

// Own component so each card's expand/collapse is independent local state.
// Quotes are always fully in the DOM -- line-clamp only hides overflow
// visually, it never removes the text -- so collapsed cards stay
// crawler/accessibility-readable, only the toggle changes what's visible.
function TestimonialCard({ review, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.15 * index }}
      className="bg-white rounded-[8px] p-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 flex flex-col"
    >
      <div className="text-[#C8920A] text-[18px] tracking-widest mb-4">
        ★★★★★
      </div>
      <p
        className={`font-sans text-[14px] text-[#12202A] leading-[1.8] flex-grow mb-2 italic whitespace-pre-line ${expanded ? '' : 'line-clamp-6'}`}
      >
        "{review.text}"
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="font-sans text-[12px] text-[#C8920A] font-semibold hover:underline mb-4 self-start"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
      <div>
        <p className="font-sans text-[14px] sm:text-[13px] font-bold text-[#12202A] mb-1">
          {review.reviewerName}
        </p>
        <p className="font-sans text-[13px] sm:text-[12px] text-gray-500">
          {review.displayDate} ·{' '}
          <a
            href={review.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#C8920A] hover:underline"
          >
            on Google
          </a>
        </p>
      </div>
    </motion.div>
  );
}

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
            What clients say
          </h2>
          <a
            href={SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[16px] text-[#12202A] font-semibold hover:underline inline-block"
          >
            {RATING} <span className="text-[#C8920A]">★★★★★</span> · {REVIEW_COUNT} Google reviews
          </a>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {TESTIMONIALS.map((review, idx) => (
            <TestimonialCard key={review.reviewerName} review={review} index={idx} />
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
