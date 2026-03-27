import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function MLSSearchSection({ 
  showModal, 
  setShowModal, 
  handleSubmit, 
  isSubmitted, 
  setIsSubmitted, 
  isLoading 
}) {
  const handleOpenModal = (e) => {
    if (e) e.preventDefault();
    setShowModal(true);
    if (setIsSubmitted) setIsSubmitted(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (setIsSubmitted) setIsSubmitted(false);
  };

  return (
    <section id="mls-search" className="bg-[#FAF6EF] py-[80px] px-6 lg:px-8">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <h2 className="font-serif text-[42px] md:text-[48px] text-[#12202A] leading-tight mb-4">
            Search Temecula Homes
          </h2>
          <p className="font-sans text-[16px] text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Browse all active MLS listings — updated daily from CRMLS
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col items-center gap-6"
        >
          <Button 
            onClick={handleOpenModal}
            size="lg"
            className="bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] font-bold text-lg px-8 py-6 rounded-md shadow-md"
          >
            ✨ Curate Your Search
          </Button>

          <div className="flex flex-wrap justify-center gap-3 mt-4">
            {['🐺 Wolf Creek', '🍷 Wine Country', '🦅 Redhawk', '🏛️ Old Town'].map((pill, index) => (
              <button 
                key={index}
                onClick={handleOpenModal} 
                className="bg-white hover:bg-gray-50 text-[#12202A] px-5 py-2.5 rounded-full border border-gray-200 shadow-sm text-sm font-medium transition-colors"
              >
                {pill}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Modal Overlay */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#12202A]/80 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative text-left"
              >
                <button 
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                  aria-label="Close modal"
                >
                  <span className="text-2xl leading-none">&times;</span>
                </button>

                <div className="p-8">
                  {isSubmitted ? (
                    <div className="text-center py-8">
                      <h3 className="text-[32px] mb-4 font-serif text-[#0D2E3A]">
                        ✅ Thank You!
                      </h3>
                      <p className="text-[16px] text-gray-600 font-sans">
                        George will be in touch with you within 24 hours.
                      </p>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-serif text-[28px] text-[#12202A] mb-2 leading-tight">
                        Unlock Full MLS Access
                      </h3>
                      <p className="font-sans text-[15px] text-gray-600 mb-6">
                        Enter your details to view full property details, photos, and virtual tours directly from the CRMLS.
                      </p>

                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                          <Input required type="text" name="name" placeholder="John Doe" className="bg-white border-gray-300 text-gray-900" />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                          <Input required type="email" name="email" placeholder="john@example.com" className="bg-white border-gray-300 text-gray-900" />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                          <Input type="tel" name="phone" placeholder="(619) 277-2766" className="bg-white border-gray-300 text-gray-900" />
                        </div>
                        
                        <Button 
                          type="submit" 
                          disabled={isLoading}
                          className="w-full bg-[#C8920A] hover:bg-[#B38209] text-[#12202A] py-6 rounded-md font-bold text-[16px] transition-colors mt-4 shadow-md"
                        >
                          {isLoading ? 'Submitting...' : 'View Listings Now →'}
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}