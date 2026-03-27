import React from 'react';
import { Phone, Mail, Award } from 'lucide-react';

export default function TopStrip() {
  return (
    <div className="bg-secondary text-accent py-6 border-b border-accent/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm font-medium tracking-wide">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 uppercase tracking-widest text-xs">
              <Award className="w-4 h-4" />
              Luxury Real Estate
            </span>
            <span className="hidden sm:inline opacity-50">|</span>
            <span className="uppercase tracking-widest text-xs">DRE #02034120</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a 
              href="tel:6192772766" 
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>(619) 277-2766</span>
            </a>
            <span className="hidden sm:inline opacity-50">|</span>
            <a 
              href="mailto:askgeorgek@gmail.com"
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">askgeorgek@gmail.com</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}