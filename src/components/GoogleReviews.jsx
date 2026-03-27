import React from 'react';
import { motion } from 'framer-motion';

export default function GoogleReviews() {
  const reviews = [
    {
      id: 1,
      text: "George was always available to answer any questions we had. He made the process of buying our first home so smooth and stress-free. Highly recommend his services to anyone looking in Temecula!",
      name: "V.V. — Viacheslav",
      details: "Bought a Single Family home in Temecula, CA"
    },
    {
      id: 2,
      text: "As first-time homebuyers, we were nervous about the process. George guided us every step of the way, explaining everything clearly in both English and Russian. We couldn't be happier with our new home!",
      name: "Viktor Smirnov",
      details: "Bought a home in Murrieta, CA"
    },
    {
      id: 3,
      text: "The market was very competitive, but George's negotiation skills helped us get our dream home below asking price. His knowledge of the local wine country area is unmatched.",
      name: "Alina Kompaniyets",
      details: "Bought a home in Temecula Wine Country"
    }
  ];

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
            Client Stories
          </span>
          <h2 className="font-serif text-[40px] md:text-[48px] text-[#12202A] leading-tight mb-4">
            What Temecula Families Say
          </h2>
          <p className="font-sans text-[16px] text-gray-600 leading-[1.6]">
            Real reviews from real clients — straight from Google.
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
              <p className="font-sans text-[14px] text-[#12202A] leading-[1.8] flex-grow mb-6 italic">
                "{review.text}"
              </p>
              <div>
                <p className="font-sans text-[13px] font-bold text-[#12202A] mb-1">
                  {review.name}
                </p>
                <p className="font-sans text-[12px] text-gray-500">
                  {review.details}
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
            href="https://www.google.com/search?q=George+Khazanovskiy+Realtor+Temecula" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="bg-[#C8920A] hover:bg-[#B38209] transition-colors rounded-[8px] py-[20px] px-[32px] shadow-md inline-flex items-center gap-3"
          >
            <span className="font-serif text-white text-xl font-bold bg-[#12202A] w-8 h-8 flex items-center justify-center rounded-full">G</span>
            <span className="font-sans text-[14px] text-[#12202A] font-bold">
              See All Reviews on Google ★★★★★
            </span>
          </a>
        </motion.div>
      </div>
    </section>
  );
}