import React from 'react';
import { motion } from 'motion/react';

export default function AgentBioSection() {

  return (
    <section id="about-george" className="bg-[#FAF6EF] py-[60px] px-[24px] lg:px-[80px]">
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center lg:text-left"
        >
          <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[2px] font-semibold block mb-3">
            George Khazanovskiy
          </span>
          <h2 className="font-serif text-[32px] sm:text-[40px] md:text-[48px] text-[#12202A] font-semibold leading-tight">
            Local Knowledge. Personal Service. Results That Speak.
          </h2>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left Column */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full lg:w-1/3 flex flex-col items-center lg:items-start text-center lg:text-left"
          >
            {/* Updated Circular Container */}
            <div className="w-[220px] h-[220px] md:w-[260px] md:h-[260px] lg:w-[300px] lg:h-[300px] rounded-full overflow-hidden mb-8 shadow-xl border-4 border-white ring-2 ring-[#C8920A]/20">
              <img
                src="/images/george-photo.jpg"
                alt="George Khazanovskiy Professional Headshot"
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>
            
            <h3 className="font-serif text-[24px] text-[#12202A] font-bold mb-1">
              George Khazanovskiy
            </h3>
            <p className="font-sans text-[14px] text-[#666666] mb-4">
              Realtor® &middot; Temecula Valley Specialist
            </p>
            
            <div className="space-y-1 mb-6">
              <p className="font-sans text-[13px] sm:text-[12px] text-[#666666]">
                DRE #02034120 &middot; Allison James Estates & Homes
              </p>
              <p className="font-sans text-[14px] sm:text-[12px] text-[#12202A] font-bold">
                Phone: 619-277-2766
              </p>
              <p className="font-sans text-[13px] sm:text-[12px] text-[#666666]">
                Address: 30777 Rancho California Rd, Temecula, CA 92592
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-sm">
              {['Top-Rated Realtor', '14+ Yrs Local Exp.', 'Trilingual Service', '7-Day Availability'].map((stat, i) => (
                <div key={i} className="bg-[#F5E6D3] text-[#12202A] font-sans text-[13px] sm:text-[12px] py-[10px] px-[16px] rounded-full text-center font-medium shadow-sm">
                  {stat}
                </div>
              ))}
            </div>

            <a 
              href="tel:6192772766"
              className="inline-block text-center bg-[#8B3018] hover:bg-[#702613] text-white font-sans text-[14px] py-[14px] px-[24px] rounded-lg transition-all hover:shadow-lg w-full max-w-sm font-medium"
            >
              📞 Call George — 619-277-2766
            </a>
          </motion.div>

          {/* Right Column */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="w-full lg:w-2/3"
          >
            <p className="font-sans text-[16px] text-[#12202A] leading-[1.8] mb-10">
              With over a decade of experience in the Temecula Valley and Southern California markets, I pride myself on delivering white-glove service to every client. Whether you are buying your first home, upgrading to a luxury estate, or looking for the perfect investment property in Wine Country, my deep local knowledge and relentless negotiation skills ensure you get the best possible outcome. Real estate is more than a transaction; it's about building lasting relationships and helping families achieve their dreams.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-12">
              <div className="flex items-start gap-4">
                <span className="text-[32px] leading-none">📊</span>
                <div>
                  <h4 className="font-sans text-[14px] font-bold text-[#12202A] mb-1">Local Market Knowledge</h4>
                  <p className="font-sans text-[14px] text-[#666666]">Deep familiarity with Temecula neighborhoods, pricing, and inventory.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-[32px] leading-none">🤝</span>
                <div>
                  <h4 className="font-sans text-[14px] font-bold text-[#12202A] mb-1">Negotiation Expert</h4>
                  <p className="font-sans text-[14px] text-[#666666]">Securing the best terms and price for your goals.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-[32px] leading-none">🌐</span>
                <div>
                  <h4 className="font-sans text-[14px] font-bold text-[#12202A] mb-1">Bilingual Service</h4>
                  <p className="font-sans text-[14px] text-[#666666]">Fluent in English, Russian, and Ukrainian.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-[32px] leading-none">⚡</span>
                <div>
                  <h4 className="font-sans text-[14px] font-bold text-[#12202A] mb-1">7-Day Availability</h4>
                  <p className="font-sans text-[14px] text-[#666666]">Always here when you need me, day or night.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}