import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

export default function Reviews() {
  return (
    <motion.section 
      id="reviews"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="py-16"
    >
      <div className="text-center mb-16">
        <h2 className="text-4xl font-serif text-secondary mb-4">Client Endorsements</h2>
        <div className="w-12 h-0.5 bg-accent mx-auto" />
      </div>

      <div className="max-w-3xl mx-auto bg-card p-12 border border-accent/10 shadow-[0_10px_30px_rgba(0,0,0,0.02)] text-center relative">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-background px-4">
          <div className="flex gap-1 text-accent">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-6 h-6 fill-current" />
            ))}
          </div>
        </div>

        <blockquote className="text-xl md:text-2xl font-serif text-secondary/90 italic leading-relaxed mb-8 mt-4">
          "An absolute masterclass in real estate representation. George navigated our vineyard acquisition with unparalleled discretion and expertise. His understanding of the luxury market is truly exceptional."
        </blockquote>

        <div className="space-y-1">
          <div className="text-sm font-bold uppercase tracking-widest text-secondary">The Harrison Family</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Wine Country Estate</div>
        </div>
      </div>
    </motion.section>
  );
}