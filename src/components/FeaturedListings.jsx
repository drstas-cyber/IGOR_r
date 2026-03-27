import React from 'react';
import { motion } from 'framer-motion';

export default function FeaturedListings() {
  const handleAction = () => {
    window.location.href = 'tel:6192772766';
  };

  const listings = [
    {
      id: 1,
      badgeText: 'New Listing',
      badgeColor: 'bg-[#C8920A] text-[#12202A]',
      price: '$749,000',
      address: '42187 Vineyard Ave, Temecula, CA 92591',
      details: '4 Beds · 3 Baths · 2,650 Sq Ft',
      amenity: 'Pool ✓',
      image: 'https://images.unsplash.com/photo-1700074788751-34099265f014'
    },
    {
      id: 2,
      badgeText: 'Price Reduced',
      badgeColor: 'bg-[#8B3018] text-white',
      price: '$589,500',
      address: '28903 Wolf Creek Dr, Temecula, CA 92592',
      details: '3 Beds · 2.5 Baths · 1,980 Sq Ft',
      amenity: 'Corner Lot',
      image: 'https://images.unsplash.com/photo-1577618163295-29d57a40e2b2'
    },
    {
      id: 3,
      badgeText: 'Just Listed',
      badgeColor: 'bg-[#3A5420] text-white',
      price: '$1,125,000',
      address: '35750 Wine Country Ln, Temecula, CA 92591',
      details: '5 Beds · 4 Baths · 3,900 Sq Ft · 1.2 ac Lot',
      amenity: null,
      image: 'https://images.unsplash.com/photo-1691272477702-0a2edae135f2'
    }
  ];

  return (
    <section className="bg-[#FAF6EF] py-[60px] px-6 lg:px-[80px]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="font-sans text-[12px] text-[#C8920A] uppercase tracking-[0.2em] font-semibold block mb-3">
              Hand-Picked Properties
            </span>
            <h2 className="font-serif text-[48px] text-[#12202A] leading-tight">
              Featured Temecula Homes
            </h2>
          </motion.div>
          <motion.button 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            onClick={handleAction}
            className="font-sans text-[14px] text-[#C8920A] hover:text-[#B38209] transition-colors flex items-center gap-2"
          >
            See All &rarr;
          </motion.button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {listings.map((listing, idx) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 * idx }}
              className="bg-white rounded-[8px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-[#C8920A] border border-transparent transition-all duration-300 group flex flex-col h-full"
            >
              <div className="relative h-[250px] overflow-hidden">
                <img 
                  src={listing.image} 
                  alt={listing.address} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className={`absolute top-4 left-4 px-3 py-1 text-[12px] font-bold uppercase tracking-wider rounded-sm shadow-md ${listing.badgeColor}`}>
                  {listing.badgeText}
                </div>
              </div>
              
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="font-serif text-[32px] text-[#C8920A] mb-1 leading-none">{listing.price}</h3>
                <p className="font-sans text-[14px] text-[#12202A] font-medium mb-4">{listing.address}</p>
                
                <div className="space-y-1 mb-6 flex-grow">
                  <p className="font-sans text-[13px] text-gray-500">{listing.details}</p>
                  {listing.amenity && (
                    <p className="font-sans text-[13px] text-[#C8920A] font-medium">{listing.amenity}</p>
                  )}
                </div>

                <a 
                  href="tel:6192772766"
                  className="w-full bg-[#8B3018] hover:bg-[#702613] text-white py-3 rounded text-[14px] font-medium transition-colors mt-auto text-center inline-block"
                >
                  Schedule a Showing &rarr;
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}