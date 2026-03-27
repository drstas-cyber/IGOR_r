import React from 'react';
import { motion } from 'framer-motion';

export default function NeighborhoodsGrid() {
  const neighborhoods = [
    { name: "Wolf Creek", active: 32, price: "$620,000" },
    { name: "Redhawk", active: 18, price: "$545,000" },
    { name: "Wine Country", active: 14, price: "$1,200,000" },
    { name: "Paloma Del Sol", active: 21, price: "$575,000" },
    { name: "Old Town", active: 9, price: "$480,000" },
    { name: "Vail Ranch", active: 11, price: "$510,000" },
    { name: "Morgan Hill", active: 7, price: "$780,000" },
    { name: "Crown Hill", active: 5, price: "$850,000" }
  ];

  return (
    <section id="neighborhoods" className="bg-[#0D2E3A] py-[60px] px-6 lg:px-[80px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold block mb-3">
              Explore Communities
            </span>
            <h2 className="font-serif text-[48px] text-white leading-tight">
              Browse Temecula Neighborhoods
            </h2>
          </motion.div>
          <motion.a 
            href="#neighborhoods"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-sans text-[14px] text-[#C8920A] hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
          >
            Explore Neighborhoods &rarr;
          </motion.a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {neighborhoods.map((hood, idx) => (
            <motion.a
              href="#neighborhoods"
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="bg-[#FAF6EF] rounded-[8px] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 cursor-pointer group relative flex flex-col h-full no-underline"
            >
              <h3 className="font-serif text-[28px] text-[#12202A] mb-2">{hood.name}</h3>
              <p className="font-sans text-[14px] text-gray-500 mb-6 flex-grow">
                {hood.active} Active Listings
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-sans text-[14px] text-[#C8920A] font-bold">
                  From {hood.price}
                </span>
                <span className="font-sans text-[18px] text-[#C8920A] transform group-hover:translate-x-1 transition-transform">
                  &rarr;
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}