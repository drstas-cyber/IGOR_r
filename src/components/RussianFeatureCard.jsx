import React from 'react';
import { motion } from 'framer-motion';

export default function RussianFeatureCard({ icon, title, description, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md hover:border-[#C8920A] border border-transparent transition-all duration-300 flex flex-col items-start"
    >
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-sans text-[16px] text-[#12202A] font-bold mb-2">{title}</h3>
      <p className="font-sans text-[14px] text-gray-600 leading-relaxed">{description}</p>
    </motion.div>
  );
}