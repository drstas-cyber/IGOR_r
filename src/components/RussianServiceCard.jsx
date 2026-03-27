import React from 'react';
import { motion } from 'framer-motion';

export default function RussianServiceCard({ icon, title, description, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="bg-[#FAF6EF] p-[32px] rounded-xl text-[#12202A]"
    >
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="font-sans text-[18px] font-bold mb-3">{title}</h3>
      <p className="font-sans text-[15px] leading-relaxed text-gray-700">{description}</p>
    </motion.div>
  );
}