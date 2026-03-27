import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function MarketReports() {
  const { toast } = useToast();

  const handleReportClick = () => {
    toast({
      title: "Market Intelligence",
      description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀",
    });
  };

  return (
    <motion.section 
      id="reports"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="bg-secondary text-secondary-foreground py-20 px-8 my-16 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className="text-sm uppercase tracking-[0.3em] text-accent mb-6">Market Intelligence</h2>
        <h3 className="text-4xl md:text-5xl font-serif mb-12 leading-tight">
          Temecula Valley <br/>
          <span className="italic opacity-80">Q3 Market Overview</span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 border-y border-accent/20 py-12">
          <div className="space-y-3">
            <div className="text-5xl font-serif text-accent">$1.2M</div>
            <div className="text-xs uppercase tracking-widest opacity-70">Avg. Luxury Sale Price</div>
          </div>
          <div className="space-y-3">
            <div className="text-5xl font-serif text-accent">14</div>
            <div className="text-xs uppercase tracking-widest opacity-70">Avg. Days on Market</div>
          </div>
          <div className="space-y-3">
            <div className="text-5xl font-serif text-accent">+8%</div>
            <div className="text-xs uppercase tracking-widest opacity-70">Year over Year Value</div>
          </div>
        </div>
        
        <button 
          onClick={handleReportClick}
          className="inline-flex items-center gap-3 text-sm uppercase tracking-widest text-accent hover:text-white transition-colors group"
        >
          <span>Download Full Report</span>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </motion.section>
  );
}