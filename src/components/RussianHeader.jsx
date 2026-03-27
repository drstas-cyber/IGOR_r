import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RussianHeader() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { label: 'Поиск Домов', target: 'home-value' },
    { label: 'Районы', target: 'home-value' },
    { label: 'Оценка', target: 'home-value' },
    { label: 'О Джордже', target: 'about-george' }
  ];

  return (
    <>
      <div className="flex w-full h-2">
        <div className="flex-1 bg-white"></div>
        <div className="flex-1 bg-blue-600"></div>
        <div className="flex-1 bg-red-600"></div>
      </div>

      <nav
        className={`hidden md:block sticky top-0 z-40 bg-background transition-all duration-300 border-b border-gray-100 ${
          isScrolled ? 'py-2 shadow-lg' : 'py-5 shadow-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between">

            <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <h1 className={`font-serif text-[#12202A] transition-all duration-300 ${isScrolled ? 'text-xl' : 'text-2xl'}`}>
                Temecula Valley Homes
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[#C8920A] text-[10px] font-bold uppercase tracking-wider">Русский</span>
                <span className="text-gray-300 text-[10px]">|</span>
                <Link to="/" className="text-muted-foreground text-[10px] hover:text-[#C8920A] transition-colors">
                  English
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {navLinks.map((link) => (
                <button
                  key={link.label}
                  onClick={() => scrollTo(link.target)}
                  className="text-[14px] text-foreground font-medium hover:text-accent relative after:absolute after:bottom-[-4px] after:left-0 after:w-full after:h-[2px] after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left transition-colors"
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-5">
              <Button
                onClick={() => scrollTo('home-value')}
                className="bg-accent hover:bg-accent/90 text-white rounded text-[14px] px-5 py-2 h-auto transition-transform hover:scale-105"
              >
                Оценить дом
              </Button>
              <a
                href="tel:16192772766"
                className="flex items-center gap-2 text-[#12202A] hover:text-accent font-semibold text-[14px] transition-colors"
              >
                <Phone className="w-4 h-4" />
                (619) 277-2766
              </a>
            </div>

          </div>
        </div>
      </nav>
    </>
  );
}
