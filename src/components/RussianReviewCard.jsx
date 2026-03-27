import React from 'react';
import { motion } from 'framer-motion';

export default function RussianReviewCard({ text, name, details, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15 }}
      className="bg-white rounded-xl p-[28px] shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 flex flex-col"
    >
      <div className="text-[#C8920A] text-[18px] tracking-widest mb-4">
        ★★★★★
      </div>
      <p className="font-sans text-[14px] text-[#12202A] leading-[1.8] flex-grow mb-6 italic">
        "{text}"
      </p>
      <div>
        <p className="font-sans text-[13px] font-bold text-[#12202A] mb-1">
          {name}
        </p>
        <p className="font-sans text-[12px] text-gray-500">
          {details}
        </p>
      </div>
    </motion.div>
  );
}