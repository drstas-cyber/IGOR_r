import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Phone } from 'lucide-react';

export default function StickyNavigation() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Search Homes', href: '#home-value' },
    { label: 'Home Value', href: '#home-value' },
    { label: 'About George', href: '#about-george' },
    { label: 'Contact', href: '#contact' }
  ];

  return (
    <nav
      className={`hidden md:block sticky top-0 z-40 bg-background transition-all duration-300 ${
        isScrolled ? 'py-2 shadow-lg' : 'py-5 shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between">

          <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className={`font-serif text-[#12202A] transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-2xl'}`}>
              Temecula Valley Homes
            </div>
            <p className={`text-muted-foreground transition-all duration-300 ${isScrolled ? 'text-[10px]' : 'text-[12px]'}`}>
              George Khazanovskiy · Realtor® · DRE #02034120
            </p>
          </div>

          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[14px] text-foreground font-medium hover:text-accent relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-5">
            <a href="#home-value">
              <Button className="bg-accent hover:bg-accent/90 text-white rounded text-[14px] px-5 py-2 h-auto transition-transform hover:scale-105">
                Free Home Value
              </Button>
            </a>
            <a
              href="tel:6192772766"
              className="flex items-center gap-2 text-[#12202A] hover:text-accent font-semibold text-[14px] transition-colors"
            >
              <Phone className="w-4 h-4" />
              (619) 277-2766
            </a>
          </div>

        </div>
      </div>
    </nav>
  );
}
