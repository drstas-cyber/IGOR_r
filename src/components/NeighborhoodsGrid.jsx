import React from 'react';
import { motion } from 'framer-motion';
import { apexSearchUrl } from '@/lib/apexSearch';
import { trackNeighborhoodSearchClick } from '@/lib/tracking';

// City-scoped to Temecula — no per-neighborhood filtering exists on ApexIDX
// (confirmed empirically against the advancedsearch form — city/subdivision/
// area/location/neighborhood query params all no-op there), so every card
// and the "Explore Neighborhoods" control resolve to the same city-scoped
// search, distinguished only by utm_content for attribution. See
// src/lib/apexSearch.js for the URL itself and how it was captured.

export default function NeighborhoodsGrid() {
  const neighborhoods = [
    { name: "Wolf Creek", slug: "wolf_creek" },
    { name: "Redhawk", slug: "redhawk" },
    { name: "Wine Country", slug: "wine_country" },
    { name: "Paloma Del Sol", slug: "paloma_del_sol" },
    { name: "Old Town", slug: "old_town" },
    { name: "Vail Ranch", slug: "vail_ranch" },
    { name: "Morgan Hill", slug: "morgan_hill" },
    { name: "Crown Hill", slug: "crown_hill" }
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
            href={apexSearchUrl('explore_neighborhoods')}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackNeighborhoodSearchClick('explore_neighborhoods')}
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
              href={apexSearchUrl(`neighborhood_${hood.slug}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackNeighborhoodSearchClick(hood.slug)}
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="bg-[#FAF6EF] rounded-[8px] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 cursor-pointer group relative flex flex-col h-full no-underline"
            >
              <h3 className="font-serif text-[28px] text-[#12202A] mb-2">{hood.name}</h3>
              <p className="font-sans text-[14px] text-gray-500 mb-6 flex-grow">
                See Temecula-area listings near {hood.name}.
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-sans text-[14px] text-[#C8920A] font-bold">
                  Search Homes Near {hood.name}
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