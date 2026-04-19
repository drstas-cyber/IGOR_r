import { validateSubmission, resetFormTimer } from '@/lib/antispam';
import React from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SearchSection({
  showModal,
  setShowModal,
  handleSubmit,
  isSubmitted,
  setIsSubmitted,
  isLoading
}) {
  const handleOpenModal = (e) => {
    e.preventDefault();
    setShowModal(true);
    if (setIsSubmitted) setIsSubmitted(false);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (setIsSubmitted) setIsSubmitted(false);
  };

  return (
    <motion.section 
      id="search"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16 bg-background relative"
    >
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif text-secondary mb-4">Curate Your Search</h2>
          <div className="w-12 h-0.5 bg-accent mx-auto" />
        </div>

        <form className="bg-card p-8 shadow-[0_10px_40px_rgba(0,0,0,0.03)] border border-accent/10">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="col-span-1 md:col-span-2 space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Location</label>
              <input
                type="text"
                placeholder="City, Neighborhood, or ZIP"
                className="w-full bg-transparent border-b border-border/50 py-3 focus:outline-none focus:border-accent transition-colors font-light text-lg rounded-none text-foreground"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Price Limit</label>
              <select className="w-full bg-transparent border-b border-border/50 py-3 focus:outline-none focus:border-accent transition-colors font-light text-lg appearance-none rounded-none text-foreground">
                <option value="">Any Price</option>
                <option value="1M">$1,000,000+</option>
                <option value="2M">$2,000,000+</option>
                <option value="5M">$5,000,000+</option>
              </select>
            </div>

            <div className="flex items-end pb-1">
              <Button 
                type="button" 
                onClick={handleOpenModal}
                className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground rounded-none py-6 uppercase tracking-widest text-sm"
              >
                <Search className="w-4 h-4 mr-2" />
                Explore
              </Button>
            </div>
          </div>
        </form>
      </div>

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
    </motion.section>
  );
}