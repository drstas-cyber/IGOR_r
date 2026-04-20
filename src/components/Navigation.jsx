import React from 'react';
import { Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Navigation() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.hash = id;
    }
  };

  const ruLinkStyles = {
    backgroundColor: '#3A5420',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'opacity 0.2s ease',
  };

  const navLinks = [
    { label: 'Search', id: 'search' },
    { label: 'Home Value', id: 'homevalue' },
    { label: 'About', id: 'about' },
    { label: 'Contact', id: 'contact', href: '/contact/' },
    { label: 'Alerts', id: 'alerts' }
  ];

  return (
    <nav className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-md shadow-md border-b border-accent/20 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="flex items-center justify-between py-5">
          <Link to="/" className="flex flex-col">
            <div className="text-2xl font-bold text-accent font-serif tracking-wide">George Khazanovskiy</div>
            <p className="text-xs text-secondary-foreground/70 uppercase tracking-widest mt-1">Temecula Valley</p>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((item) => (
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-secondary-foreground hover:text-accent transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
                >
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.id)}
                  className="text-sm font-medium text-secondary-foreground hover:text-accent transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-accent after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:origin-left"
                >
                  {item.label}
                </button>
              )
            ))}
          </div>
          
          <div className="flex items-center gap-3">
            <Link 
              to="/russian-speaking-realtor-temecula" 
              style={ruLinkStyles}
              className="hover:opacity-90 whitespace-nowrap"
            >
              🇷🇺 RU
            </Link>

            <a href="tel:16192772766" onClick={() => { if (window.gtag) { window.gtag('event', 'phone_click'); window.gtag('event', 'conversion', { send_to: 'AW-18044804522/LL2DCN-15ZEcEKq7t5xD', value: 50.0, currency: 'USD' }); } }}>
              <Button className="bg-accent hover:bg-accent/90 text-secondary font-semibold uppercase tracking-wider text-xs px-6 py-5 rounded-none border border-accent">
                <span className="hidden sm:inline">Inquire Now</span>
                <span className="sm:hidden">Call</span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}