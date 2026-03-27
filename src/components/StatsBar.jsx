import React from 'react';
import { motion } from 'framer-motion';

export default function StatsBar() {
  const stats = [
    { value: "$740K", label: "Median Sale Price" },
    { value: "176 Sold", label: "January 2026" },
    { value: "100.1%", label: "Sale-to-List Ratio" },
    { value: "25 Days", label: "Hot Homes Sell" },
    { value: "5.0★", label: "George's Rating" },
  ];

  return (
    <div className="bg-[#0D2E3A] py-10 w-full">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 text-center divide-y sm:divide-y-0 lg:divide-x divide-[#C8920A]/20">
          {stats.map((stat, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center justify-center pt-6 sm:pt-0"
            >
              <span className="font-serif text-3xl lg:text-4xl font-semibold text-[#C8920A] mb-2">
                {stat.value}
              </span>
              <span className="font-sans text-[13px] uppercase tracking-widest text-white/80">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}