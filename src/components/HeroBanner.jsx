import React from 'react';
import { motion } from 'framer-motion';
import { Search, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HeroBanner() {
  const scrollToSection = id => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative min-h-[85vh] flex items-center justify-center bg-background">
      <div className="absolute inset-0 w-full h-full">
        <img 
          className="absolute inset-0 w-full h-full object-cover" 
          alt="Beautiful Temecula wine country vineyard" 
          src="https://images.unsplash.com/photo-1698904738835-51c949c1cbaa" 
        />
        <div className="absolute inset-0 bg-secondary/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-secondary/80 to-transparent" />
      </div>
      
      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-secondary-foreground">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="space-y-8"
        >
          <p className="text-sm sm:text-base uppercase tracking-[0.3em] text-accent font-medium">
            Exclusive Properties & Estates
          </p>
          
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold leading-tight font-serif drop-shadow-xl">
            Elevating Your <br/><span className="text-accent italic">Temecula Valley</span> Experience
          </h2>
          
          <p className="text-lg sm:text-xl max-w-2xl mx-auto text-secondary-foreground/90 font-light leading-relaxed">
            Curated real estate guidance for discerning buyers and sellers in Southern California's premier wine country.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-6 pt-8">
            <Button 
              onClick={() => scrollToSection('search')} 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 rounded-none uppercase tracking-widest text-sm w-full sm:w-auto transition-all duration-300"
            >
              Explore Collection
            </Button>
            
            <Button 
              onClick={() => scrollToSection('contact')} 
              variant="outline" 
              className="border-accent text-accent hover:bg-accent hover:text-secondary px-8 py-6 rounded-none uppercase tracking-widest text-sm w-full sm:w-auto transition-all duration-300"
            >
              Request Consultation
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}